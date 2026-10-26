import { QState, EvalWeights } from './types.js';
import { wallsDistance, wallsCorridor } from './pathfind.js';
import { EState, fromQState } from './state.js';

// Special score thresholds
export const WIN_THRESHOLD = 100000;
export const LOSS_THRESHOLD = -100000;
export const INF_PENALTY = 1000; // Penalize infinite distances

/**
 * Scores at or above this magnitude are decided outcomes (actual wins, or races
 * the evaluator can prove). They carry a ply term and must be ply-adjusted in the TT.
 */
export const KNOWN_WIN = 50000;

/**
 * Default evaluation weights. One step of distance is worth w1 = 10.
 */
export const DEFAULT_WEIGHTS: Required<EvalWeights> = {
  w1: 10.0, // distance advantage
  w2: 6.0, // scale on the wall value table (selfplay: 1 → 57% vs baseline, 6 → 93%)
  w3: 0.5, // own mobility
  w4: 0.8, // own shortest-path corridor width
  w5: 0.8, // opponent corridor width (narrow = good for me)
  tempo: 5.0, // side to move wins equal races
};

/**
 * Value of holding n walls. Concave: the last wall is worth far more than the
 * tenth, because the final walls are what decide a close race.
 */
const WALL_VALUE = [0, 6, 11, 15, 18, 20.5, 22.5, 24, 25, 25.5, 26];

export type EvalFeatures = 'basic' | 'full';

export interface EvalOptions {
  weights: Required<EvalWeights>;
  features: EvalFeatures;
  /** Recognise races that are already decided once walls run out. */
  endgame: boolean;
}

export function withDefaults(weights: EvalWeights): Required<EvalWeights> {
  return { ...DEFAULT_WEIGHTS, ...weights };
}

/**
 * Decided outcomes once walls are gone, from the side to move's perspective, or
 * null. With no walls left anywhere the game is a pure race the mover wins iff
 * D_me <= D_op; a margin of 2 covers the one step a pawn jump can swing. If only
 * the opponent is out of walls, nothing can lengthen my path, so being strictly
 * ahead is enough.
 */
export function knownOutcome(dMe: number, dOp: number, wMe: number, wOp: number, ply: number): number | null {
  if (wOp === 0 && dOp - dMe >= (wMe === 0 ? 2 : 1)) return KNOWN_WIN - ply - 2 * dMe;
  if (wMe === 0 && wOp === 0 && dMe - dOp >= 2) return -(KNOWN_WIN - ply - 2 * dOp);
  return null;
}

/**
 * Evaluate from the side to move's perspective; higher is better for the mover.
 * `mobility` is the number of legal pawn moves for the side to move.
 */
export function evaluateState(s: EState, mobility: number, ply: number, opts: EvalOptions): number {
  const me = s.turn;
  const myCell = me === 0 ? s.p0 : s.p1;
  const opCell = me === 0 ? s.p1 : s.p0;
  const myGoal = me === 0 ? 8 : 0;
  const opGoal = me === 0 ? 0 : 8;
  // Pawns are ignored: a distant opponent is not a jump the mover can count on.
  const dMe = wallsDistance(s.w, myCell, myGoal, -1);
  const dOp = wallsDistance(s.w, opCell, opGoal, -1);

  if (dMe === 0) return WIN_THRESHOLD - ply;
  if (dOp === 0) return LOSS_THRESHOLD + ply;
  if (dMe === Infinity) return LOSS_THRESHOLD + ply;
  if (dOp === Infinity) return WIN_THRESHOLD - ply;

  const wMe = me === 0 ? s.n0 : s.n1;
  const wOp = me === 0 ? s.n1 : s.n0;
  const w = opts.weights;

  if (opts.endgame) {
    const known = knownOutcome(dMe, dOp, wMe, wOp, ply);
    if (known !== null) return known;
  }

  let score = w.w1 * (dOp - dMe) + w.tempo;
  score += w.w2 * (WALL_VALUE[wMe] - WALL_VALUE[wOp]);
  if (opts.features === 'basic') return score;

  score += w.w3 * (mobility / 5.0);
  // Corridor widths only matter while the race is close; skip the extra BFS otherwise.
  if (Math.abs(dOp - dMe) < 4) {
    score += w.w4 * Math.min(wallsCorridor(s.w, myCell, myGoal), 4);
    if (wMe > 0) score -= w.w5 * Math.min(wallsCorridor(s.w, opCell, opGoal), 4);
  }
  return score;
}

/**
 * Evaluate a board position from the current player's perspective.
 * Returns a score where higher = better for current player.
 *
 * @param state Game state
 * @param moves Legal moves available (for mobility calculation)
 * @param depth Search depth (used for mate scoring penalty)
 * @param weights Evaluation weights
 */
export function evaluate(
  state: QState,
  moves: number[],
  depth: number = 0,
  weights: EvalWeights = DEFAULT_WEIGHTS
): number {
  return evaluateState(fromQState(state), moves.length, depth, {
    weights: withDefaults(weights),
    features: 'full',
    endgame: false,
  });
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
