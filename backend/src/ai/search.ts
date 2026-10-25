import { QState, Action, DifficultyLevel } from './types.js';
import { getMoves } from './board.js';
import { evaluateState, knownOutcome, EvalOptions, WIN_THRESHOLD, KNOWN_WIN } from './eval.js';
import { wallsDistance, wallsPath, wallsCorridor, FastPath, Walls } from './pathfind.js';
import {
  EState,
  fromQState,
  applyAction,
  pawnMoves,
  addWall,
  wallConflicts,
  wallLegal,
  wallCutsPath,
  winnerOf,
  hashKey,
} from './state.js';
import { getDifficultyConfig, getEvalWeights, DifficultyConfig } from './config.js';

const INF = 1e9;
/** Null-window width; scores are fractional. */
const NW = 0.01;
/** Scores beyond this magnitude depend on ply and are stored ply-relative in the TT. */
const DECIDED = KNOWN_WIN - 1000;
const MAX_PLY = 128;

// --- Transposition table ----------------------------------------------------------
// One slot per index, generation-stamped so a new search never trusts entries written
// under another difficulty's evaluation. Same-generation slots prefer deeper entries.

const EXACT = 0;
const LOWER = 1;
const UPPER = 2;
const NO_MOVE = 255;

const TT_BITS = 18;
const TT_SIZE = 1 << TT_BITS;
const TT_MASK = TT_SIZE - 1;
const ttK0 = new Uint32Array(TT_SIZE);
const ttK1 = new Uint32Array(TT_SIZE);
const ttGen = new Uint16Array(TT_SIZE);
const ttDepth = new Int8Array(TT_SIZE);
const ttScore = new Float32Array(TT_SIZE);
const ttBound = new Uint8Array(TT_SIZE);
const ttMove = new Uint8Array(TT_SIZE);
let generation = 0;

function nextGeneration(): void {
  generation++;
  if (generation > 0xffff) {
    ttGen.fill(0);
    generation = 1;
  }
}

function ttIndex(s: EState): number {
  const i = s.k0 & TT_MASK;
  return ttGen[i] === generation && ttK0[i] === s.k0 && ttK1[i] === s.k1 ? i : -1;
}

function toTT(score: number, ply: number): number {
  if (score >= DECIDED) return score + ply;
  if (score <= -DECIDED) return score - ply;
  return score;
}

function fromTT(score: number, ply: number): number {
  if (score >= DECIDED) return score - ply;
  if (score <= -DECIDED) return score + ply;
  return score;
}

function ttStore(s: EState, depth: number, score: number, bound: number, move: Action, ply: number): void {
  const i = s.k0 & TT_MASK;
  if (ttGen[i] === generation && ttDepth[i] > depth && !(ttK0[i] === s.k0 && ttK1[i] === s.k1)) return;
  ttK0[i] = s.k0;
  ttK1[i] = s.k1;
  ttGen[i] = generation;
  ttDepth[i] = depth;
  ttScore[i] = toTT(score, ply);
  ttBound[i] = bound;
  ttMove[i] = move < 0 ? NO_MOVE : move;
}

// --- Search context ---------------------------------------------------------------

interface Ctx {
  cfg: DifficultyConfig;
  evalOpts: EvalOptions;
  hardStop: number;
  nodes: number;
  aborted: boolean;
  killers: Int16Array; // [ply][2]
  history: Int32Array; // [side][action]
  strategic: Map<number, WallGain[]>;
}

function timeUp(c: Ctx): boolean {
  if ((c.nodes & 255) === 0 && Date.now() >= c.hardStop) c.aborted = true;
  return c.aborted;
}

function cellsOf(s: EState): { me: number; op: number; myGoal: number; opGoal: number } {
  return s.turn === 0
    ? { me: s.p0, op: s.p1, myGoal: 8, opGoal: 0 }
    : { me: s.p1, op: s.p0, myGoal: 0, opGoal: 8 };
}

interface NodePaths {
  my: FastPath;
  op: FastPath;
  /** P1's and P2's paths, as wallLegal expects them. */
  path0: number[];
  path1: number[];
}

/**
 * Shortest paths ignoring pawns, matching the evaluator. Wall legality uses the
 * rules' pawn-aware reachability, so a path running through the other pawn is not
 * trusted as a legality shortcut (an empty path forces the full BFS check).
 */
function nodePaths(s: EState): NodePaths {
  const k = cellsOf(s);
  const my = wallsPath(s.w, k.me, k.myGoal, -1);
  const op = wallsPath(s.w, k.op, k.opGoal, -1);
  const myLegal = my.cells.includes(k.op) ? [] : my.cells;
  const opLegal = op.cells.includes(k.me) ? [] : op.cells;
  return s.turn === 0
    ? { my, op, path0: myLegal, path1: opLegal }
    : { my, op, path0: opLegal, path1: myLegal };
}

function moverWalls(s: EState): number {
  return s.turn === 0 ? s.n0 : s.n1;
}

function evalNode(c: Ctx, s: EState, ply: number): number {
  return evaluateState(s, pawnMoves(s).length, ply, c.evalOpts);
}

function terminal(s: EState, ply: number): number | null {
  const winner = winnerOf(s);
  if (winner === 0) return null;
  return winner === s.turn + 1 ? WIN_THRESHOLD - ply : -(WIN_THRESHOLD - ply);
}

// --- Move generation --------------------------------------------------------------

interface WallGain {
  action: Action;
  gain: number;
}

/**
 * Walls for the side to move that lengthen the opponent's path, best net gain
 * (ΔD_op − ΔD_me) first. Only walls cutting the opponent's current shortest path
 * can lengthen it, so everything else is skipped before any BFS.
 */
function attackingWalls(s: EState, p: NodePaths, minGain: number, limit: number): WallGain[] {
  const k = cellsOf(s);
  const out: WallGain[] = [];
  for (let action = 12; action < 140; action++) {
    if (!wallCutsPath(action, p.op.cells)) continue;
    if (!wallLegal(s, action, p.path0, p.path1)) continue;
    const w = addWall(s.w, action);
    const opGain = wallsDistance(w, k.op, k.opGoal, -1) - p.op.distance;
    if (opGain < minGain) continue;
    const myGain = wallCutsPath(action, p.my.cells) ? wallsDistance(w, k.me, k.myGoal, -1) - p.my.distance : 0;
    out.push({ action, gain: opGain - myGain });
  }
  out.sort((a, b) => b.gain - a.gain);
  return out.length > limit ? out.slice(0, limit) : out;
}

/**
 * Largest increase in a player's distance that one more wall could cause. `path`
 * must be a current shortest path for that player under `w`. Legality is only
 * approximated (overlap rules, and the player must stay connected).
 */
function maxCut(w: Walls, start: number, goal: number, path: FastPath): number {
  let best = 0;
  for (let action = 12; action < 140; action++) {
    if (!wallCutsPath(action, path.cells) || wallConflicts(w, action)) continue;
    const d = wallsDistance(addWall(w, action), start, goal, -1);
    if (d !== Infinity && d - path.distance > best) best = d - path.distance;
  }
  return best;
}

const myPathMask = new Uint8Array(81);
const corridorMask = new Uint8Array(81);

function touchesMask(mask: Uint8Array, action: Action): boolean {
  const idx = (action - 12) & 63;
  const r = idx >> 3;
  const c = idx & 7;
  return (mask[r * 9 + c] | mask[r * 9 + c + 1] | mask[(r + 1) * 9 + c] | mask[(r + 1) * 9 + c + 1]) !== 0;
}

/**
 * Set-up walls: they do not lengthen the opponent's path yet, but make the best
 * follow-up wall cut deeper than anything available now. Traps are built this way
 * (a zero-gain wall, then one that costs three steps), and a generator that only
 * offers immediate gains never sees them coming. Expensive; shallow plies only.
 */
function setupWalls(s: EState, p: NodePaths, limit: number, exclude: Set<Action>): WallGain[] {
  if (moverWalls(s) < 2) return [];
  const k = cellsOf(s);
  const now = maxCut(s.w, k.op, k.opGoal, p.op);
  wallsCorridor(s.w, k.op, k.opGoal, corridorMask);

  const out: WallGain[] = [];
  for (let action = 12; action < 140; action++) {
    if (exclude.has(action) || wallCutsPath(action, p.op.cells) || !touchesMask(corridorMask, action)) continue;
    if (wallCutsPath(action, p.my.cells)) continue;
    if (!wallLegal(s, action, p.path0, p.path1)) continue;
    // The opponent's path is untouched, so it is still a shortest path after the wall.
    const next = maxCut(addWall(s.w, action), k.op, k.opGoal, p.op);
    if (next >= 2 && next > now) out.push({ action, gain: next - now });
  }
  out.sort((a, b) => b.gain - a.gain);
  return out.slice(0, limit);
}

/**
 * Walls that leave the mover's distance unchanged but reduce the most damaging
 * wall the opponent could place against them next turn. Root only: each candidate
 * costs a scan of the opponent's replies.
 */
function defensiveWalls(s: EState, p: NodePaths, limit: number, exclude: Set<Action>): WallGain[] {
  if (moverWalls(s) === 0 || (s.turn === 0 ? s.n1 : s.n0) === 0) return [];
  const k = cellsOf(s);
  const threat = maxCut(s.w, k.me, k.myGoal, p.my);
  if (threat < 2) return [];

  myPathMask.fill(0);
  for (const cell of p.my.cells) myPathMask[cell] = 1;
  const out: WallGain[] = [];
  for (let action = 12; action < 140; action++) {
    if (exclude.has(action) || wallCutsPath(action, p.my.cells) || !touchesMask(myPathMask, action)) continue;
    if (!wallLegal(s, action, p.path0, p.path1)) continue;
    const benefit = threat - maxCut(addWall(s.w, action), k.me, k.myGoal, p.my);
    if (benefit >= 1) out.push({ action, gain: benefit });
  }
  out.sort((a, b) => b.gain - a.gain);
  return out.slice(0, limit);
}

/** Set-up and defensive walls, cached per position since they are costly to find. */
function strategicWalls(c: Ctx, s: EState, p: NodePaths, attacks: WallGain[]): WallGain[] {
  const key = hashKey(s);
  const cached = c.strategic.get(key);
  if (cached) return cached;
  const taken = new Set(attacks.map((w) => w.action));
  const setup = c.cfg.setupWalls > 0 ? setupWalls(s, p, c.cfg.setupWalls, taken) : [];
  for (const w of setup) taken.add(w.action);
  const defence = c.cfg.defensiveWalls > 0 ? defensiveWalls(s, p, c.cfg.defensiveWalls, taken) : [];
  const out = [...setup, ...defence];
  c.strategic.set(key, out);
  return out;
}

interface GenOptions {
  ply: number;
  ttMove: number;
  walls: boolean;
}

function generate(c: Ctx, s: EState, p: NodePaths, o: GenOptions): Action[] {
  const me = s.turn;
  const k = cellsOf(s);
  const scored: { action: Action; score: number }[] = [];
  const hist = me * 140;

  for (const action of pawnMoves(s)) {
    const child = applyAction(s, action);
    const d = wallsDistance(child.w, me === 0 ? child.p0 : child.p1, k.myGoal, -1);
    let score: number;
    if (d === 0) score = 2e9;
    else if (d < p.my.distance) score = 1e8 + (p.my.distance - d) * 1e6;
    else score = -1e8 + c.history[hist + action];
    scored.push({ action, score });
  }

  if (o.walls && moverWalls(s) > 0) {
    // Opening walls are rarely worth it unless they cost the opponent two or more steps.
    const opening = s.n0 === 10 && s.n1 === 10 && p.op.distance >= 6;
    const attacks = attackingWalls(s, p, opening ? c.cfg.openingWallMinGain : 1, c.cfg.wallCandidates);
    for (const w of attacks) scored.push({ action: w.action, score: 1e7 + w.gain * 1e5 + c.history[hist + w.action] });

    if (o.ply <= c.cfg.strategicPly && (c.cfg.setupWalls > 0 || c.cfg.defensiveWalls > 0)) {
      for (const w of strategicWalls(c, s, p, attacks)) scored.push({ action: w.action, score: 5e6 + w.gain * 1e5 });
    }
  }

  const k0 = c.killers[o.ply * 2];
  const k1 = c.killers[o.ply * 2 + 1];
  for (const m of scored) {
    if (m.action === o.ttMove) m.score = 3e9;
    else if (m.score < 1e9 && m.action === k0) m.score = Math.max(m.score, 9e7);
    else if (m.score < 1e9 && m.action === k1) m.score = Math.max(m.score, 8e7);
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((m) => m.action);
}

// --- Search -----------------------------------------------------------------------

/** Leaf search over the side to move's strongest walls, with stand-pat. */
function quiesce(c: Ctx, s: EState, ply: number, alpha: number, beta: number, q: number): number {
  c.nodes++;
  if (timeUp(c)) return 0;
  const t = terminal(s, ply);
  if (t !== null) return t;

  const stand = evalNode(c, s, ply);
  if (q <= 0 || Math.abs(stand) >= DECIDED || moverWalls(s) === 0 || ply >= MAX_PLY - 1) return stand;
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;

  let best = stand;
  for (const w of attackingWalls(s, nodePaths(s), 2, 3)) {
    const score = -quiesce(c, applyAction(s, w.action), ply + 1, -beta, -alpha, q - 1);
    if (c.aborted) return 0;
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

function search(c: Ctx, s: EState, depth: number, ply: number, alpha: number, beta: number, ext: number): number {
  if (depth <= 0 || ply >= MAX_PLY - 1) return quiesce(c, s, ply, alpha, beta, c.cfg.quiescencePlies);

  c.nodes++;
  if (timeUp(c)) return 0;
  const t = terminal(s, ply);
  if (t !== null) return t;

  const alphaOrig = alpha;
  const ti = ttIndex(s);
  let ttMv = -1;
  if (ti >= 0) {
    ttMv = ttMove[ti] === NO_MOVE ? -1 : ttMove[ti];
    if (ttDepth[ti] >= depth) {
      const score = fromTT(ttScore[ti], ply);
      const bound = ttBound[ti];
      if (bound === EXACT) return score;
      if (bound === LOWER && score >= beta) return score;
      if (bound === UPPER && score <= alpha) return score;
    }
  }

  const p = nodePaths(s);
  if (c.cfg.endgameSolver) {
    const known = knownOutcome(p.my.distance, p.op.distance, moverWalls(s), s.turn === 0 ? s.n1 : s.n0, ply);
    if (known !== null) return known;
  }

  const moves = generate(c, s, p, { ply, ttMove: ttMv, walls: true });
  if (moves.length === 0) return evalNode(c, s, ply);

  // Without walls the mover only has a handful of pawn moves; look further for free.
  const extend = ext > 0 && moverWalls(s) === 0;
  const childDepth = extend ? depth : depth - 1;
  const childExt = extend ? ext - 1 : ext;

  let best = -INF;
  let bestMove = moves[0];
  for (let i = 0; i < moves.length; i++) {
    const child = applyAction(s, moves[i]);
    let score: number;
    if (i === 0) {
      score = -search(c, child, childDepth, ply + 1, -beta, -alpha, childExt);
    } else {
      // Late moves (after the well-ordered head of the list) get a reduced null-window
      // probe first; only those that beat alpha are searched at full depth.
      const reduce = c.cfg.lmr && depth >= 3 && i >= 4 && moves[i] !== c.killers[ply * 2] ? 1 : 0;
      score = -search(c, child, childDepth - reduce, ply + 1, -alpha - NW, -alpha, childExt);
      if (reduce && score > alpha && !c.aborted) {
        score = -search(c, child, childDepth, ply + 1, -alpha - NW, -alpha, childExt);
      }
      if (score > alpha && score < beta && !c.aborted) {
        score = -search(c, child, childDepth, ply + 1, -beta, -alpha, childExt);
      }
    }
    if (c.aborted) return 0;

    if (score > best) {
      best = score;
      bestMove = moves[i];
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) {
      const m = moves[i];
      c.history[s.turn * 140 + m] += depth * depth;
      if (c.killers[ply * 2] !== m) {
        c.killers[ply * 2 + 1] = c.killers[ply * 2];
        c.killers[ply * 2] = m;
      }
      break;
    }
  }

  const bound = best <= alphaOrig ? UPPER : best >= beta ? LOWER : EXACT;
  ttStore(s, depth, best, bound, bestMove, ply);
  return best;
}

interface RootResult {
  move: Action;
  score: number;
}

/**
 * One root iteration. Moves after the first are tested against (best − margin), so
 * every move within `margin` of the best gets an exact score; the rest only an
 * upper bound. Returns the moves searched so far, best first, and whether all were.
 */
function searchRoot(
  c: Ctx,
  s: EState,
  depth: number,
  moves: Action[],
  margin: number,
  guess: number | null
): { results: RootResult[]; complete: boolean } {
  const results: RootResult[] = [];
  let best = -INF;
  const extend = c.cfg.pawnOnlyExtensions > 0 && moverWalls(s) === 0;
  const childDepth = extend ? depth : depth - 1;
  const childExt = extend ? c.cfg.pawnOnlyExtensions - 1 : c.cfg.pawnOnlyExtensions;

  for (let i = 0; i < moves.length; i++) {
    const child = applyAction(s, moves[i]);
    let score: number;
    if (i === 0) {
      if (guess !== null && depth >= 3 && Math.abs(guess) < DECIDED) {
        const lo = guess - 15;
        const hi = guess + 15;
        score = -search(c, child, childDepth, 1, -hi, -lo, childExt);
        if (!c.aborted && (score <= lo || score >= hi)) score = -search(c, child, childDepth, 1, -INF, INF, childExt);
      } else {
        score = -search(c, child, childDepth, 1, -INF, INF, childExt);
      }
    } else {
      const bound = best - margin;
      score = -search(c, child, childDepth, 1, -bound - NW, -bound, childExt);
      if (score > bound && !c.aborted) score = -search(c, child, childDepth, 1, -INF, -bound, childExt);
    }
    if (c.aborted) break;
    results.push({ move: moves[i], score });
    if (score > best) best = score;
  }

  results.sort((a, b) => b.score - a.score);
  return { results, complete: results.length === moves.length };
}

export interface SearchInfo {
  move: Action;
  /** Deepest fully completed iteration. */
  depth: number;
  nodes: number;
  elapsedMs: number;
  /** Root moves of the last iteration, best first (scores of weak moves are upper bounds). */
  root: RootResult[];
}

function pickMove(results: RootResult[], cfg: DifficultyConfig, rng: () => number): Action {
  const best = results[0];
  if (!cfg.allowRandomization || Math.abs(best.score) >= DECIDED) return best.move;

  if (cfg.softmaxT > 0) {
    const weights = results.map((r) => Math.exp((r.score - best.score) / cfg.softmaxT));
    let x = rng() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < results.length; i++) {
      x -= weights[i];
      if (x <= 0) return results[i].move;
    }
    return best.move;
  }
  if (cfg.tieDelta > 0) {
    const near = results.filter((r) => r.score >= best.score - cfg.tieDelta);
    return near[Math.floor(rng() * near.length)].move;
  }
  return best.move;
}

/** Iterative deepening PVS with full diagnostics. `overrides` is for tools and tests. */
export function searchBestMove(
  state: QState,
  difficulty: DifficultyLevel,
  overrides: Partial<DifficultyConfig> = {},
  rng: () => number = Math.random
): SearchInfo {
  const cfg: DifficultyConfig = { ...getDifficultyConfig(difficulty), ...overrides };
  const start = Date.now();
  nextGeneration();
  const c: Ctx = {
    cfg,
    evalOpts: {
      weights: { ...getEvalWeights(difficulty), ...cfg.evalWeights },
      features: cfg.evalFeatures,
      endgame: cfg.endgameSolver,
    },
    hardStop: start + cfg.timeLimit,
    nodes: 0,
    aborted: false,
    killers: new Int16Array(MAX_PLY * 2).fill(-1),
    history: new Int32Array(2 * 140),
    strategic: new Map(),
  };
  const done = (move: Action, depth: number, root: RootResult[]): SearchInfo => ({
    move,
    depth,
    nodes: c.nodes,
    elapsedMs: Date.now() - start,
    root,
  });

  const root = fromQState(state);
  const p = nodePaths(root);
  const useWalls = cfg.wallUseProb >= 1 || rng() < cfg.wallUseProb;
  let moves = generate(c, root, p, { ply: 0, ttMove: -1, walls: useWalls });
  if (moves.length === 0) {
    const legal = getMoves(state);
    return done(legal.length > 0 ? legal[0] : 0, 0, []);
  }
  // An immediate win is always taken, at every level.
  for (const m of moves) {
    if (m < 12 && winnerOf(applyAction(root, m)) !== 0) return done(m, 0, [{ move: m, score: WIN_THRESHOLD }]);
  }
  if (moves.length === 1) return done(moves[0], 0, [{ move: moves[0], score: 0 }]);

  const margin = !cfg.allowRandomization ? 0 : cfg.softmaxT > 0 ? 4 * cfg.softmaxT : cfg.tieDelta;
  let results: RootResult[] = moves.map((move) => ({ move, score: 0 }));
  let completed = 0;
  let bestChanged = false;

  for (let depth = 1; depth <= cfg.maxDepth; depth++) {
    // The next iteration usually costs several times the last one; do not start it late.
    const elapsed = Date.now() - start;
    const startBudget = cfg.timeLimit * Math.min(0.9, cfg.iterationStart * (cfg.timeExtension && bestChanged ? 1.5 : 1));
    if (depth > 1 && elapsed > startBudget) break;

    const guess = completed > 0 ? results[0].score : null;
    const r = searchRoot(c, root, depth, moves, margin, guess);
    if (!r.complete) {
      // The first root move is the previous best, searched first; whatever leads the partial
      // iteration has been compared against it at the new depth and can be trusted.
      if (r.results.length > 0) {
        const seen = new Set(r.results.map((x) => x.move));
        results = [...r.results, ...results.filter((x) => !seen.has(x.move))];
      }
      break;
    }

    bestChanged = completed > 0 && r.results[0].move !== results[0].move;
    results = r.results;
    completed = depth;
    moves = results.map((x) => x.move);
    if (Math.abs(results[0].score) >= DECIDED) break;
  }

  return done(pickMove(results, cfg, rng), completed, results);
}

/**
 * Iterative deepening alpha-beta. Returns the best action index (0..139).
 */
export function getBestMove(state: QState, difficulty: DifficultyLevel): Action {
  return searchBestMove(state, difficulty).move;
}
