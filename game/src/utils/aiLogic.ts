import { GameState, Move, Position } from '../types';
import { getValidMoves, getValidWallPositions } from './gameLogic';

export function calculateDistance(from: Position, to: Position): number {
  return Math.abs(from.row - to.row) + Math.abs(from.col - to.col);
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

async function getEngineMove(state: GameState): Promise<Move | null> {
  try {
    const validMoves = getValidMoves(state.aiPos, state.board, state.playerPos);
    const validWalls = getValidWallPositions(state.board, state.playerPos, state.aiPos, 'ai');

    if (validMoves.length === 0) return null;

    const response = await fetch(`${API_BASE_URL}/game/ai-move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aiLevel: state.aiLevel,
        aiPos: state.aiPos,
        playerPos: state.playerPos,
        aiWallsLeft: state.aiWallsLeft,
        playerWallsLeft: state.playerWallsLeft,
        walls: state.walls,
        validMoves,
        validWalls,
      }),
    });

    if (!response.ok) {
      console.error('AI move API error:', response.statusText);
      return getFallbackMove(state);
    }

    const move = await response.json();
    return move as Move | null;
  } catch (error) {
    console.error('AI move request error:', error);
    return getFallbackMove(state);
  }
}

function getFallbackMove(state: GameState): Move | null {
  const validMoves = getValidMoves(state.aiPos, state.board, state.playerPos);
  if (validMoves.length === 0) return null;

  // Prefer moving toward goal
  const goalRow = 0;
  const bestMove = validMoves.reduce((best, current) => {
    const currentDist = calculateDistance(current, { row: goalRow, col: 4 });
    const bestDist = calculateDistance(best, { row: goalRow, col: 4 });
    return currentDist < bestDist ? current : best;
  });

  return {
    type: 'move',
    from: state.aiPos,
    to: bestMove,
    player: 'ai',
    timestamp: Date.now(),
  };
}

export async function getAIMove(state: GameState): Promise<Move | null> {
  return getEngineMove(state);
}
