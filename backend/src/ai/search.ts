import { QState, Action, DifficultyLevel, EvalWeights } from './types.js';
import { getMoves } from './board.js';
import { evaluateState, WIN_THRESHOLD, LOSS_THRESHOLD } from './eval.js';
import { wallsDistance, wallsPath, anchorSet, Walls } from './pathfind.js';
import {
  EState,
  fromQState,
  applyAction,
  pawnMoves,
  wallLegal,
  wallCutsPath,
  winnerOf,
  hashKey,
} from './state.js';
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
  private entries: Map<number, TTEntry> = new Map();
  private readonly maxSize = 65536;

  set(hash: number, depth: number, score: number, bound: Bound): void {
    if (this.entries.size >= this.maxSize) {
      this.entries.clear();
    }
    this.entries.set(hash, { depth, score, bound });
  }

  /** A stored cutoff score is only reusable when it still lies outside the current window. */
  probe(hash: number, depth: number, alpha: number, beta: number): number | null {
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

function distanceOf(s: EState, player: 0 | 1): number {
  return player === 0 ? wallsDistance(s.w, s.p0, 8, s.p1) : wallsDistance(s.w, s.p1, 0, s.p0);
}

const pathMask = new Uint8Array(81);

/**
 * Generate and order search moves: shortest-path pawn moves first, then walls
 * sorted by net gain in (D_op - D_me), then remaining pawn moves.
 *
 * A wall that leaves the opponent's current shortest path intact cannot raise
 * D_op, so such walls are dropped before any BFS. Survivors must also pass the
 * geometric prefilter (spec §2.4): touch the opponent's path, lie within
 * Chebyshev distance 2 of either pawn, or extend an existing wall.
 */
function searchMoves(state: EState): Action[] {
  const me = state.turn;
  const op: 0 | 1 = me === 0 ? 1 : 0;
  const meCell = me === 0 ? state.p0 : state.p1;
  const opCell = me === 0 ? state.p1 : state.p0;
  const myPath = wallsPath(state.w, meCell, me === 0 ? 8 : 0, opCell);
  const opPath = wallsPath(state.w, opCell, op === 0 ? 8 : 0, meCell);
  const dMe = myPath.distance;
  const dOp = opPath.distance;
  const path0 = me === 0 ? myPath.cells : opPath.cells;
  const path1 = me === 0 ? opPath.cells : myPath.cells;

  const pathMoves: Action[] = [];
  const otherPawn: Action[] = [];
  for (const action of pawnMoves(state)) {
    if (distanceOf(applyAction(state, action), me) < dMe) pathMoves.push(action);
    else otherPawn.push(action);
  }

  const walls: { action: Action; gain: number }[] = [];
  const left = me === 0 ? state.n0 : state.n1;
  if (left > 0) {
    pathMask.fill(0);
    for (const cell of opPath.cells) pathMask[cell] = 1;
    const meR = (meCell / 9) | 0;
    const meC = meCell - meR * 9;
    const opR = (opCell / 9) | 0;
    const opC = opCell - opR * 9;

    for (let action = 12; action < 140; action++) {
      if (!wallCutsPath(action, opPath.cells)) continue;
      const idx = (action - 12) & 63;
      const r = idx >> 3;
      const c = idx & 7;
      const nearPawn =
        (Math.abs(r - meR) <= 2 && Math.abs(c - meC) <= 2) ||
        (Math.abs(r - opR) <= 2 && Math.abs(c - opC) <= 2);
      const onPath =
        pathMask[r * 9 + c] | pathMask[r * 9 + c + 1] | pathMask[(r + 1) * 9 + c] | pathMask[(r + 1) * 9 + c + 1];
      if (!nearPawn && onPath === 0 && !touchesExistingWall(state.w, r, c)) continue;
      if (!wallLegal(state, action, path0, path1)) continue;

      const next = applyAction(state, action);
      const opGain = distanceOf(next, op) - dOp;
      if (opGain <= 0) continue;
      const myGain = wallCutsPath(action, myPath.cells) ? distanceOf(next, me) - dMe : 0;
      walls.push({ action, gain: opGain - myGain });
    }
    walls.sort((a, b) => b.gain - a.gain);
  }

  return [...pathMoves, ...walls.slice(0, MAX_WALL_CANDIDATES).map((w) => w.action), ...otherPawn];
}

/** Score from the root player's perspective. */
function terminalScore(winner: 1 | 2, ply: number, s: SearchState): number {
  const rootWon = winner === s.rootPlayer + 1;
  return rootWon ? WIN_THRESHOLD - ply : LOSS_THRESHOLD + ply;
}

function leafScore(state: EState, ply: number, s: SearchState): number {
  const score = evaluateState(state, pawnMoves(state).length, ply, s.weights);
  return state.turn === s.rootPlayer ? score : -score;
}

function alphabeta(
  state: EState,
  depth: number,
  ply: number,
  alpha: number,
  beta: number,
  s: SearchState
): number {
  s.nodesEvaluated++;
  if (isTimeExceeded(s)) s.aborted = true;
  if (s.aborted) return 0;

  const winner = winnerOf(state);
  if (winner !== 0) return terminalScore(winner, ply, s);

  const hash = hashKey(state);
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
    const score = alphabeta(applyAction(state, move), depth - 1, ply + 1, alpha, beta, s);
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

function searchRoot(state: EState, depth: number, moves: Action[], s: SearchState): RootResult[] | null {
  const results: RootResult[] = [];
  let alpha = -Infinity;

  for (const move of moves) {
    const score = alphabeta(applyAction(state, move), depth - 1, 1, alpha, Infinity, s);
    if (s.aborted) return null;
    results.push({ move, score });
    if (score > alpha) alpha = score;
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

export interface SearchInfo {
  move: Action;
  /** Deepest fully completed iteration. */
  depth: number;
  nodes: number;
  elapsedMs: number;
  /** Root moves of the last completed iteration, best first. */
  root: RootResult[];
}

/** Iterative deepening alpha-beta with full diagnostics. `overrides` is for tools and tests. */
export function searchBestMove(
  state: QState,
  difficulty: DifficultyLevel,
  overrides: Partial<DifficultyConfig> = {}
): SearchInfo {
  const config = { ...getDifficultyConfig(difficulty), ...overrides };
  const root = fromQState(state);
  const s: SearchState = {
    tt: new TranspositionTable(),
    rootPlayer: root.turn,
    startTime: Date.now(),
    timeLimit: config.timeLimit,
    nodesEvaluated: 0,
    weights: getEvalWeights(difficulty),
    aborted: false,
  };

  const ordered = searchMoves(root);
  if (ordered.length === 0) {
    const legal = getMoves(state);
    const move = legal.length > 0 ? legal[0] : 0;
    return { move, depth: 0, nodes: 0, elapsedMs: 0, root: [] };
  }

  let best: RootResult[] = ordered.map((move) => ({ move, score: 0 }));
  let completed = 0;

  for (let depth = 1; depth <= config.maxDepth; depth++) {
    const results = searchRoot(root, depth, ordered, s);
    if (results === null) break;
    best = results;
    completed = depth;
    if (best[0].score >= WIN_THRESHOLD - config.maxDepth) break;
    if (isTimeExceeded(s)) break;
  }

  let move = best[0].move;
  if (config.allowRandomization && Math.random() < 0.3) {
    const top = best.slice(0, Math.min(3, best.length));
    move = top[Math.floor(Math.random() * top.length)].move;
  }

  return { move, depth: completed, nodes: s.nodesEvaluated, elapsedMs: Date.now() - s.startTime, root: best };
}

/**
 * Iterative deepening alpha-beta. Returns the best action index (0..139).
 */
export function getBestMove(state: QState, difficulty: DifficultyLevel): Action {
  return searchBestMove(state, difficulty).move;
}
