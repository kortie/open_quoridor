import { GameState, Move, Position } from '../types';
import { getValidMoves, getValidWallPositions } from './gameLogic';
import { DQNAgent, encodeGameState } from './dqnModel';

export function calculateDistance(from: Position, to: Position): number {
  return Math.abs(from.row - to.row) + Math.abs(from.col - to.col);
}

// Global DQN agent instance for Normal/Hard modes
let dqnAgent: DQNAgent | null = null;

function initDQNAgent(): void {
  if (!dqnAgent) {
    // State size: 81 (9x9 board) + 4 (positions) + 2 (walls) + 3 (distances) = 90
    // Action size: 81 (max piece moves + walls)
    dqnAgent = new DQNAgent(90, 81);
  }
}

// Fast evaluation function for Easy mode
function evaluateMoveScore(move: Move, playerPos: Position, isAI: boolean): number {
  let score = 0;

  if (move.type === 'move') {
    const toPos = move.to!;
    const goalPos = isAI ? { row: 0, col: 4 } : { row: 8, col: 4 };

    // Most important: progress toward goal
    const distToGoal = calculateDistance(toPos, goalPos);
    score += (8 - distToGoal) * 100;

    // Secondary: opponent proximity
    const distToOpponent = calculateDistance(toPos, playerPos);
    if (distToOpponent < 2) {
      score += 20;
    } else if (distToOpponent < 4) {
      score += 10;
    }

    return score;
  }

  // Wall placement scoring
  if (move.type === 'placeWall' && move.wall) {
    const wall = move.wall;
    const distToOpponent = calculateDistance(wall, playerPos);

    if (distToOpponent < 3) {
      score += 50;
    } else if (distToOpponent < 5) {
      score += 30;
    }

    return score;
  }

  return score;
}

export function getEasyMove(state: GameState): Move | null {
  const validMoves = getValidMoves(state.aiPos, state.board, state.playerPos);

  if (validMoves.length === 0) return null;

  // 80% random moves, 20% wall
  if (Math.random() < 0.8 || state.aiWallsLeft === 0) {
    const move = validMoves[Math.floor(Math.random() * validMoves.length)];
    return {
      type: 'move',
      from: state.aiPos,
      to: move,
      player: 'ai',
      timestamp: Date.now(),
    };
  }

  // Place wall randomly
  const validWalls = getValidWallPositions(state.board, state.playerPos, state.aiPos, 'ai');
  if (validWalls.length > 0) {
    return {
      type: 'placeWall',
      wall: validWalls[Math.floor(Math.random() * validWalls.length)],
      player: 'ai',
      timestamp: Date.now(),
    };
  }

  const move = validMoves[Math.floor(Math.random() * validMoves.length)];
  return {
    type: 'move',
    from: state.aiPos,
    to: move,
    player: 'ai',
    timestamp: Date.now(),
  };
}

export function getNormalMove(state: GameState): Move | null {
  try {
    initDQNAgent();
    if (!dqnAgent) return getEasyMove(state);

    const validPieceMoves = getValidMoves(state.aiPos, state.board, state.playerPos);
    if (validPieceMoves.length === 0) return null;

    // Build legal action indices
    const legalActions: number[] = [];

    // Add piece move actions (0 to validPieceMoves.length - 1)
    for (let i = 0; i < validPieceMoves.length; i++) {
      legalActions.push(i);
    }

    // Add wall placement actions
    if (state.aiWallsLeft > 0) {
      try {
        const validWalls = getValidWallPositions(state.board, state.playerPos, state.aiPos, 'ai');
        for (let i = 0; i < Math.min(5, validWalls.length); i++) {
          legalActions.push(validPieceMoves.length + i);
        }
      } catch (e) {
        // If wall validation fails, just use piece moves
      }
    }

    // Encode game state for neural network
    const encodedState = encodeGameState(state, true);

    // Get Q-values from DQN
    const qValues = dqnAgent.predictQValues(encodedState);

    // Choose action using epsilon-greedy
    const selectedAction = dqnAgent.chooseAction(qValues, legalActions);

    // Convert action to move
    if (selectedAction < validPieceMoves.length) {
      // Piece move
      const movePos = validPieceMoves[selectedAction];
      qValues.dispose();
      return {
        type: 'move',
        from: state.aiPos,
        to: movePos,
        player: 'ai',
        timestamp: Date.now(),
      };
    } else {
      // Wall placement
      try {
        const validWalls = getValidWallPositions(state.board, state.playerPos, state.aiPos, 'ai');
        const wallIndex = selectedAction - validPieceMoves.length;
        if (wallIndex < validWalls.length) {
          qValues.dispose();
          return {
            type: 'placeWall',
            wall: validWalls[wallIndex],
            player: 'ai',
            timestamp: Date.now(),
          };
        }
      } catch (e) {
        // Fallback to piece move
      }

      const movePos = validPieceMoves[0];
      qValues.dispose();
      return {
        type: 'move',
        from: state.aiPos,
        to: movePos,
        player: 'ai',
        timestamp: Date.now(),
      };
    }
  } catch (error) {
    console.error('DQN move error:', error);
    // Fallback to simple evaluation
    return getSimpleMove(state);
  }
}

export function getSmartMove(state: GameState): Move | null {
  // Same as Normal but with lower epsilon for more deterministic play
  return getNormalMove(state);
}

// Fallback: Simple heuristic evaluation
function getSimpleMove(state: GameState): Move | null {
  const validMoves = getValidMoves(state.aiPos, state.board, state.playerPos);

  if (validMoves.length === 0) return null;

  interface ScoredMove {
    move: Move;
    score: number;
  }

  const scoredMoves: ScoredMove[] = [];

  for (const movePos of validMoves) {
    const move: Move = {
      type: 'move',
      from: state.aiPos,
      to: movePos,
      player: 'ai',
      timestamp: Date.now(),
    };
    const score = evaluateMoveScore(move, state.playerPos, true);
    scoredMoves.push({ move, score });
  }

  if (state.aiWallsLeft > 0) {
    try {
      const validWalls = getValidWallPositions(state.board, state.playerPos, state.aiPos, 'ai');
      for (let i = 0; i < Math.min(3, validWalls.length); i++) {
        const move: Move = {
          type: 'placeWall',
          wall: validWalls[i],
          player: 'ai',
          timestamp: Date.now(),
        };
        const score = evaluateMoveScore(move, state.playerPos, true);
        scoredMoves.push({ move, score });
      }
    } catch (e) {
      // Ignore
    }
  }

  scoredMoves.sort((a, b) => b.score - a.score);
  return scoredMoves[0]?.move || null;
}

export function getAIMove(state: GameState): Move | null {
  switch (state.aiLevel) {
    case 'Easy':
      return getEasyMove(state);
    case 'Normal':
      return getNormalMove(state);
    case 'Hard':
    case 'VeryHard':
    case 'Expert':
      return getSmartMove(state);
    default:
      return getNormalMove(state);
  }
}
