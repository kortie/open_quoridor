/**
 * Quoridor AI Engine
 * Main entry point exporting all AI functionality
 */

export { initBoard, getMoves, applyMove, getWinner, decodeWallAction, decodePawnMove } from './board.js';
export { PAWN_MOVES, DIFFICULTY_LEVELS } from './types.js';
export { bfs, getDistance, canReachGoal, getPathDiversity } from './pathfind.js';
export { evaluate, evaluateForTT, WIN_THRESHOLD, LOSS_THRESHOLD } from './eval.js';
export { getBestMove } from './search.js';
export { getDifficultyConfig, getEvalWeights } from './config.js';
export type {
  QState,
  Action,
  Position,
  DifficultyLevel,
  EvalWeights,
  MoveInfo,
  WallPlacement,
} from './types.js';
