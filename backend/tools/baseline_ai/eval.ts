import { QState, EvalWeights } from './types.js';
import { getDistance, getPathDiversity } from './pathfind.js';

// Special score thresholds
export const WIN_THRESHOLD = 100000;
export const LOSS_THRESHOLD = -100000;
export const INF_PENALTY = 1000; // Penalize infinite distances

/**
 * Default evaluation weights
 */
export const DEFAULT_WEIGHTS: EvalWeights = {
  w1: 10.0,  // distance advantage
  w2: 1.5,   // wall advantage
  w3: 0.5,   // mobility
  w4: 0.8,   // path diversity
};

/**
 * Get number of legal moves (mobility)
 */
function getMobility(moves: number[]): number {
  return moves.length;
}

/**
 * Calculate game phase bonus
 * Early game: prefer keeping walls
 * Late game: distance becomes critical
 */
function getPhaseBonus(
  d_me: number,
  d_op: number,
  w_me: number,
  w_op: number,
  weights: EvalWeights
): number {
  const totalWallsUsed = (10 - w_me) + (10 - w_op);

  // Early game (combined walls used ≤ 4)
  if (totalWallsUsed <= 4) {
    return 0.5 * w_me; // Bonus for keeping walls
  }

  // Late game: if opponent has no walls, distance is critical
  if (w_op === 0) {
    return 50 * (d_op - d_me); // Amplify distance advantage
  }

  // Mid game: slight bonus for walls
  if (totalWallsUsed <= 10) {
    return 0.2 * w_me;
  }

  return 0;
}

/**
 * Evaluate a board position from the current player's perspective
 * Returns a score where higher = better for current player
 *
 * @param state Game state
 * @param depth Search depth (used for mate scoring penalty)
 * @param moves Legal moves available (for mobility calculation)
 * @param weights Evaluation weights
 */
export function evaluate(
  state: QState,
  moves: number[],
  depth: number = 0,
  weights: EvalWeights = DEFAULT_WEIGHTS
): number {
  // Get current player info
  const isP1 = state.turn === 0;
  const d_me = getDistance(state, state.turn);
  const d_op = getDistance(state, state.turn === 0 ? 1 : 0);

  // Check for terminal states
  if (d_me === 0) {
    // Current player wins
    return WIN_THRESHOLD - depth; // Prefer faster wins
  }

  if (d_op === 0) {
    // Opponent wins
    return LOSS_THRESHOLD + depth; // Prefer losing slower
  }

  // Handle unreachable positions (shouldn't happen with valid wall placement)
  if (d_me === Infinity) {
    return LOSS_THRESHOLD + depth; // Can't reach goal = loss
  }

  if (d_op === Infinity) {
    return WIN_THRESHOLD - depth; // Opponent can't reach goal = win
  }

  // Feature calculations
  const w_me = isP1 ? state.p1_walls : state.p2_walls;
  const w_op = isP1 ? state.p2_walls : state.p1_walls;
  const m_me = getMobility(moves);
  const p_me = Math.min(getPathDiversity(state, state.turn), 4); // Cap at 4

  // Calculate base score
  let score = 0;
  score += weights.w1 * (d_op - d_me);  // Distance advantage
  score += weights.w2 * (w_me - w_op);  // Wall advantage
  score += weights.w3 * (m_me / 5.0);   // Mobility (normalized)
  score += weights.w4 * p_me;           // Path diversity

  // Add phase bonus
  score += getPhaseBonus(d_me, d_op, w_me, w_op, weights);

  return score;
}

/**
 * Evaluate without depth penalty (for transposition table)
 */
export function evaluateForTT(
  state: QState,
  moves: number[],
  weights: EvalWeights = DEFAULT_WEIGHTS
): number {
  return evaluate(state, moves, 0, weights);
}
