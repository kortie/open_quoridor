import { GameState, Move, Position } from '../types';
import { getValidMoves, getValidWallPositions } from './gameLogic';
import { OFFLINE } from '../config';

export function calculateDistance(from: Position, to: Position): number {
  return Math.abs(from.row - to.row) + Math.abs(from.col - to.col);
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const AI_REQUEST_TIMEOUT_MS = 10000;

async function getEngineMove(state: GameState): Promise<Move | null> {
  try {
    const validMoves = getValidMoves(state.aiPos, state.board, state.playerPos);
    const validWalls = getValidWallPositions(state.board, state.playerPos, state.aiPos, 'ai', state.walls);

    if (validMoves.length === 0) return null;

    // Expert searches for up to 3s; allow for that plus queueing before giving up.
    const response = await fetch(`${API_BASE_URL}/game/ai-move`, {
      method: 'POST',
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
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

/** Offline (Android) build: same request shape, answered by the on-device engine. */
async function getOfflineMove(state: GameState): Promise<Move | null> {
  const validMoves = getValidMoves(state.aiPos, state.board, state.playerPos);
  if (validMoves.length === 0) return null;
  // Loaded on demand so the web build does not ship the engine.
  const { getLocalAIMove } = await import('../engine/localAi');
  return getLocalAIMove({
    aiLevel: state.aiLevel,
    aiPos: state.aiPos,
    playerPos: state.playerPos,
    aiWallsLeft: state.aiWallsLeft,
    playerWallsLeft: state.playerWallsLeft,
    walls: state.walls,
    validMoves,
    validWalls: getValidWallPositions(state.board, state.playerPos, state.aiPos, 'ai', state.walls),
  });
}

export async function getAIMove(state: GameState): Promise<Move | null> {
  return OFFLINE ? getOfflineMove(state) : getEngineMove(state);
}
