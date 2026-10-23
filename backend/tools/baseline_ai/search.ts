import { QState, Action, DifficultyLevel, EvalWeights } from './types.js';
import {
  getMoves,
  getLegalPawnMoves,
  wallLegalityChecker,
  applyMove,
  getWinner,
} from './board.js';
import { evaluate, WIN_THRESHOLD, LOSS_THRESHOLD } from './eval.js';
import { getDistance, shortestPath, splitWalls, anchorSet, Walls } from './pathfind.js';
import { hashState, initZobrist } from './zobrist.js';
import { getDifficultyConfig, getEvalWeights, DifficultyConfig } from './config.js';

const EXACT = 0;
const LOWER = 1;
const UPPER = 2;
type Bound = typeof EXACT | typeof LOWER | typeof UPPER;

interface TTEntry {
  depth: number;
  score: number;
  bound: Bound;
}

class TranspositionTable {
  private entries: Map<bigint, TTEntry> = new Map();
  private readonly maxSize = 65536;

  set(hash: bigint, depth: number, score: number, bound: Bound): void {
    if (this.entries.size >= this.maxSize) {
      this.entries.clear();
    }
    this.entries.set(hash, { depth, score, bound });
  }

  /** A stored cutoff score is only reusable when it still lies outside the current window. */
  probe(hash: bigint, depth: number, alpha: number, beta: number): number | null {
    const e = this.entries.get(hash);
    if (!e || e.depth < depth) return null;
    if (e.bound === EXACT) return e.score;
    if (e.bound === LOWER && e.score >= beta) return e.score;
    if (e.bound === UPPER && e.score <= alpha) return e.score;
    return null;
  }
}

interface SearchState {
  tt: TranspositionTable;
  rootPlayer: 0 | 1;
  startTime: number;
  timeLimit: number;
  nodesEvaluated: number;
  weights: EvalWeights;
  aborted: boolean;
}

const MAX_WALL_CANDIDATES = 20;

function isTimeExceeded(s: SearchState): boolean {
  return Date.now() - s.startTime > s.timeLimit;
}

/** True if any wall anchor exists in the 3x3 neighbourhood of anchor (r,c). */
function touchesExistingWall(w: Walls, r: number, c: number): boolean {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (anchorSet(w, true, r + dr, c + dc) || anchorSet(w, false, r + dr, c + dc)) return true;
    }
  }
  return false;
}

const pathMask = new Uint8Array(81);

/**
 * Geometric wall prefilter (spec §2.4). A wall anchored at (r,c) spans cells
 * (r..r+1, c..c+1); keep it if it touches the opponent's shortest path, lies
 * within Chebyshev distance 2 of either pawn, or extends an existing wall.
 * Legality is checked afterwards, only for survivors.
 */
function candidateWalls(state: QState, opPathCells: number[], legal: (a: Action) => boolean): Action[] {
  const wallsLeft = state.turn === 0 ? state.p1_walls : state.p2_walls;
  if (wallsLeft <= 0) return [];

  const w = splitWalls(state.h_walls, state.v_walls);
  pathMask.fill(0);
  for (const cell of opPathCells) pathMask[cell] = 1;

  const meR = state.turn === 0 ? state.p1_row : state.p2_row;
  const meC = state.turn === 0 ? state.p1_col : state.p2_col;
  const opR = state.turn === 0 ? state.p2_row : state.p1_row;
  const opC = state.turn === 0 ? state.p2_col : state.p1_col;

  const out: Action[] = [];
  for (let action = 12; action < 140; action++) {
    const idx = (action - 12) & 63;
    const r = idx >> 3;
    const c = idx & 7;

    const nearPawn =
      (Math.abs(r - meR) <= 2 && Math.abs(c - meC) <= 2) ||
      (Math.abs(r - opR) <= 2 && Math.abs(c - opC) <= 2);
    const onPath =
      pathMask[r * 9 + c] | pathMask[r * 9 + c + 1] | pathMask[(r + 1) * 9 + c] | pathMask[(r + 1) * 9 + c + 1];

    if ((nearPawn || onPath !== 0 || touchesExistingWall(w, r, c)) && legal(action)) {
      out.push(action);
    }
  }
  return out;
}

/**
 * Generate and order search moves: shortest-path pawn moves first, then walls
 * sorted by net gain in (D_op - D_me), then remaining pawn moves.
 */
function searchMoves(state: QState): Action[] {
  const me = state.turn;
  const op: 0 | 1 = me === 0 ? 1 : 0;
  const myPath = shortestPath(state, me);
  const opPath = shortestPath(state, op);
  const dMe = myPath.distance;
  const dOp = opPath.distance;
  const legal = wallLegalityChecker(
    state,
    me === 0 ? [myPath.cells, opPath.cells] : [opPath.cells, myPath.cells]
  );

  const pathMoves: Action[] = [];
  const otherPawn: Action[] = [];
  for (const action of getLegalPawnMoves(state)) {
    if (getDistance(applyMove(state, action), me) < dMe) pathMoves.push(action);
    else otherPawn.push(action);
  }

  const walls: { action: Action; gain: number }[] = [];
  for (const action of candidateWalls(state, opPath.cells, legal)) {
    const next = applyMove(state, action);
    const opGain = getDistance(next, op) - dOp;
    if (opGain <= 0) continue;
    walls.push({ action, gain: opGain - (getDistance(next, me) - dMe) });
  }
  walls.sort((a, b) => b.gain - a.gain);

  return [...pathMoves, ...walls.slice(0, MAX_WALL_CANDIDATES).map((w) => w.action), ...otherPawn];
}

/** Score from the root player's perspective. */
function terminalScore(winner: 1 | 2, ply: number, s: SearchState): number {
  const rootWon = winner === s.rootPlayer + 1;
  return rootWon ? WIN_THRESHOLD - ply : LOSS_THRESHOLD + ply;
}

function leafScore(state: QState, ply: number, s: SearchState): number {
  const score = evaluate(state, getLegalPawnMoves(state), ply, s.weights);
  return state.turn === s.rootPlayer ? score : -score;
}

function alphabeta(
  state: QState,
  depth: number,
  ply: number,
  alpha: number,
  beta: number,
  s: SearchState
): number {
  s.nodesEvaluated++;
  if (isTimeExceeded(s)) s.aborted = true;
  if (s.aborted) return 0;

  const winner = getWinner(state);
  if (winner !== 0) return terminalScore(winner, ply, s);

  const hash = hashState(state);
  const cached = s.tt.probe(hash, depth, alpha, beta);
  if (cached !== null) return cached;

  if (depth === 0) {
    const score = leafScore(state, ply, s);
    s.tt.set(hash, depth, score, EXACT);
    return score;
  }

  const moves = searchMoves(state);
  if (moves.length === 0) return 0;

  const alphaOrig = alpha;
  const betaOrig = beta;
  const maximizing = state.turn === s.rootPlayer;
  let best = maximizing ? -Infinity : Infinity;

  for (const move of moves) {
    const score = alphabeta(applyMove(state, move), depth - 1, ply + 1, alpha, beta, s);
    if (s.aborted) return 0;

    if (maximizing) {
      if (score > best) best = score;
      if (best > alpha) alpha = best;
    } else {
      if (score < best) best = score;
      if (best < beta) beta = best;
    }
    if (beta <= alpha) break;
  }

  const bound: Bound = best <= alphaOrig ? UPPER : best >= betaOrig ? LOWER : EXACT;
  s.tt.set(hash, depth, best, bound);
  return best;
}

interface RootResult {
  move: Action;
  score: number;
}

function searchRoot(state: QState, depth: number, moves: Action[], s: SearchState): RootResult[] | null {
  const results: RootResult[] = [];
  let alpha = -Infinity;

  for (const move of moves) {
    const score = alphabeta(applyMove(state, move), depth - 1, 1, alpha, Infinity, s);
    if (s.aborted) return null;
    results.push({ move, score });
    if (score > alpha) alpha = score;
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Iterative deepening alpha-beta. Returns the best action index (0..139).
 */
export function getBestMove(
  state: QState,
  difficulty: DifficultyLevel,
  overrides: Partial<DifficultyConfig> = {}
): Action {
  initZobrist();

  const config = { ...getDifficultyConfig(difficulty), ...overrides };
  const s: SearchState = {
    tt: new TranspositionTable(),
    rootPlayer: state.turn,
    startTime: Date.now(),
    timeLimit: config.timeLimit,
    nodesEvaluated: 0,
    weights: getEvalWeights(difficulty),
    aborted: false,
  };

  const ordered = searchMoves(state);
  if (ordered.length === 0) {
    const legal = getMoves(state);
    return legal.length > 0 ? legal[0] : 0;
  }

  let best: RootResult[] = ordered.map((move) => ({ move, score: 0 }));

  for (let depth = 1; depth <= config.maxDepth; depth++) {
    const results = searchRoot(state, depth, ordered, s);
    if (results === null) break;
    best = results;
    if (best[0].score >= WIN_THRESHOLD - config.maxDepth) break;
    if (isTimeExceeded(s)) break;
  }

  if (config.allowRandomization && Math.random() < 0.3) {
    const top = best.slice(0, Math.min(3, best.length));
    return top[Math.floor(Math.random() * top.length)].move;
  }

  return best[0].move;
}
