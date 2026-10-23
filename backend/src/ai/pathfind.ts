import { QState, Position } from './types.js';

export interface PathfindResult {
  distance: number;
  pathCells: Set<string>;
}

export interface FastPath {
  distance: number;
  /** Cell indices (row*9+col) from start to goal; empty when unreachable. */
  cells: number[];
}

/** Anchor bitboards split into 32-bit words so the inner loops use plain number ops. */
export interface Walls {
  hLo: number;
  hHi: number;
  vLo: number;
  vHi: number;
}

const MASK32 = 0xffffffffn;

export function splitWalls(h_walls: bigint, v_walls: bigint): Walls {
  return {
    hLo: Number(h_walls & MASK32),
    hHi: Number(h_walls >> 32n),
    vLo: Number(v_walls & MASK32),
    vHi: Number(v_walls >> 32n),
  };
}

export function anchorBit(r: number, c: number): bigint {
  return 1n << BigInt(r * 8 + c);
}

export function hasAnchor(bits: bigint, r: number, c: number): boolean {
  if (r < 0 || r > 7 || c < 0 || c > 7) return false;
  return (bits & anchorBit(r, c)) !== 0n;
}

export function anchorSet(w: Walls, horizontal: boolean, r: number, c: number): boolean {
  if (r < 0 || r > 7 || c < 0 || c > 7) return false;
  const idx = r * 8 + c;
  if (horizontal) {
    return idx < 32 ? ((w.hLo >>> idx) & 1) === 1 : ((w.hHi >>> (idx - 32)) & 1) === 1;
  }
  return idx < 32 ? ((w.vLo >>> idx) & 1) === 1 : ((w.vHi >>> (idx - 32)) & 1) === 1;
}

/**
 * Walls are stored one bit per 8x8 anchor. An H-wall at anchor (r,c) blocks
 * (r,c)<->(r+1,c) and (r,c+1)<->(r+1,c+1); a V-wall at (r,c) blocks
 * (r,c)<->(r,c+1) and (r+1,c)<->(r+1,c+1). A gap is therefore covered by
 * either of two neighbouring anchors. Cells must be orthogonally adjacent.
 */
export function blocked(w: Walls, fr: number, fc: number, tr: number, tc: number): boolean {
  if (fr !== tr) {
    const r = fr < tr ? fr : tr;
    return anchorSet(w, true, r, fc) || anchorSet(w, true, r, fc - 1);
  }
  const c = fc < tc ? fc : tc;
  return anchorSet(w, false, fr, c) || anchorSet(w, false, fr - 1, c);
}

export function isWallBetween(from: Position, to: Position, h_walls: bigint, v_walls: bigint): boolean {
  const dr = to.row - from.row;
  const dc = to.col - from.col;
  if (Math.abs(dr) + Math.abs(dc) !== 1) return false;
  return blocked(splitWalls(h_walls, v_walls), from.row, from.col, to.row, to.col);
}

const N = 81;
const DR = [-1, 1, 0, 0]; // N, S, E, W — same order as PAWN_MOVES[0..3]
const DC = [0, 0, 1, -1];

// Scratch buffers; the engine is single-threaded and these are never held across calls.
const distBuf = new Int16Array(N);
const parentBuf = new Int8Array(N);
const queueBuf = new Int8Array(N);
const fwdBuf = new Int16Array(N);
const bwdBuf = new Int16Array(N);

/**
 * Per-row blocking masks for the walls currently loaded. Bit c of downBlk[r] is set
 * when (r,c)<->(r+1,c) is walled; bit c of rightBlk[r] when (r,c)<->(r,c+1) is.
 * Rebuilt only when the wall set changes, so a BFS costs no per-edge bit lookups.
 */
const downBlk = new Int32Array(8);
const rightBlk = new Int32Array(9);
let loadedHLo = -1;
let loadedHHi = -1;
let loadedVLo = -1;
let loadedVHi = -1;

function anchorRow(lo: number, hi: number, r: number): number {
  return r < 4 ? (lo >>> (r * 8)) & 255 : (hi >>> ((r - 4) * 8)) & 255;
}

export function loadWalls(w: Walls): void {
  if (w.hLo === loadedHLo && w.hHi === loadedHHi && w.vLo === loadedVLo && w.vHi === loadedVHi) return;
  loadedHLo = w.hLo;
  loadedHHi = w.hHi;
  loadedVLo = w.vLo;
  loadedVHi = w.vHi;
  let prevV = 0;
  for (let r = 0; r < 9; r++) {
    if (r < 8) {
      const h = anchorRow(w.hLo, w.hHi, r);
      downBlk[r] = h | (h << 1);
    }
    const v = r < 8 ? anchorRow(w.vLo, w.vHi, r) : 0;
    rightBlk[r] = v | prevV;
    prevV = v;
  }
}

/** True if a step from (r,c) in direction dir (N,S,E,W) leaves the board or crosses a loaded wall. */
export function stepBlocked(r: number, c: number, dir: number): boolean {
  switch (dir) {
    case 0:
      return r === 0 || ((downBlk[r - 1] >> c) & 1) === 1;
    case 1:
      return r === 8 || ((downBlk[r] >> c) & 1) === 1;
    case 2:
      return c === 8 || ((rightBlk[r] >> c) & 1) === 1;
    default:
      return c === 0 || ((rightBlk[r] >> (c - 1)) & 1) === 1;
  }
}

function tryVisit(next: number, d: number, from: number, tail: number): number {
  if (distBuf[next] >= 0) return tail;
  distBuf[next] = d;
  parentBuf[next] = from;
  queueBuf[tail] = next;
  return tail + 1;
}

/**
 * BFS from `start` to any cell in `goalRow`, treating the opponent (cell index, or -1)
 * as a jumpable obstacle per the move rules. Returns the goal cell reached or -1.
 * distBuf/parentBuf hold the result.
 */
function runBfs(w: Walls, start: number, goalRow: number, opp: number): number {
  loadWalls(w);
  distBuf.fill(-1);
  distBuf[start] = 0;
  parentBuf[start] = -1;
  queueBuf[0] = start;
  let head = 0;
  let tail = 1;

  while (head < tail) {
    const cur = queueBuf[head++];
    const cr = (cur / 9) | 0;
    const cc = cur - cr * 9;
    if (cr === goalRow) return cur;
    const d = distBuf[cur] + 1;

    for (let dir = 0; dir < 4; dir++) {
      if (stepBlocked(cr, cc, dir)) continue;
      const nr = cr + DR[dir];
      const nc = cc + DC[dir];
      const next = nr * 9 + nc;

      if (next !== opp) {
        tail = tryVisit(next, d, cur, tail);
        continue;
      }

      if (!stepBlocked(nr, nc, dir)) {
        tail = tryVisit((nr + DR[dir]) * 9 + nc + DC[dir], d, cur, tail);
        continue;
      }

      const p0 = DR[dir] !== 0 ? 2 : 0;
      for (let k = 0; k < 2; k++) {
        if (stepBlocked(nr, nc, p0 + k)) continue;
        tail = tryVisit((nr + DR[p0 + k]) * 9 + nc + DC[p0 + k], d, cur, tail);
      }
    }
  }
  return -1;
}

/** Distance from `start` to `goalRow` with the opponent at cell `opp` (-1 for none); Infinity if cut off. */
export function wallsDistance(w: Walls, start: number, goalRow: number, opp: number): number {
  const goal = runBfs(w, start, goalRow, opp);
  return goal < 0 ? Infinity : distBuf[goal];
}

export function wallsReachable(w: Walls, start: number, goalRow: number, opp: number): boolean {
  return runBfs(w, start, goalRow, opp) >= 0;
}

/** Like wallsDistance but also returns the cells of one shortest path. */
export function wallsPath(w: Walls, start: number, goalRow: number, opp: number): FastPath {
  const goal = runBfs(w, start, goalRow, opp);
  if (goal < 0) return { distance: Infinity, cells: [] };
  const cells: number[] = [];
  for (let n = goal; n >= 0; n = parentBuf[n]) cells.push(n);
  cells.reverse();
  return { distance: distBuf[goal], cells };
}

function cellOf(state: QState, player: 0 | 1): number {
  return player === 0 ? state.p1_row * 9 + state.p1_col : state.p2_row * 9 + state.p2_col;
}

function runFor(state: QState, player: 0 | 1): number {
  const w = splitWalls(state.h_walls, state.v_walls);
  const opp: 0 | 1 = player === 0 ? 1 : 0;
  return runBfs(w, cellOf(state, player), player === 0 ? 8 : 0, cellOf(state, opp));
}

export function shortestPath(state: QState, player: 0 | 1): FastPath {
  const goal = runFor(state, player);
  if (goal < 0) return { distance: Infinity, cells: [] };
  const cells: number[] = [];
  for (let n = goal; n >= 0; n = parentBuf[n]) cells.push(n);
  cells.reverse();
  return { distance: distBuf[goal], cells };
}

export function getDistance(state: QState, player: 0 | 1): number {
  const goal = runFor(state, player);
  return goal < 0 ? Infinity : distBuf[goal];
}

export function canReachGoal(state: QState, player: 0 | 1): boolean {
  return runFor(state, player) >= 0;
}

/** Position-based BFS kept for callers/tests that work in (row, col) terms. */
export function bfs(
  startPos: Position,
  goalRow: number,
  h_walls: bigint,
  v_walls: bigint,
  opponentPos: Position
): PathfindResult {
  const w = splitWalls(h_walls, v_walls);
  const goal = runBfs(w, startPos.row * 9 + startPos.col, goalRow, opponentPos.row * 9 + opponentPos.col);
  if (goal < 0) return { distance: Infinity, pathCells: new Set() };
  const pathCells = new Set<string>();
  for (let n = goal; n >= 0; n = parentBuf[n]) pathCells.add(`${(n / 9) | 0},${n % 9}`);
  return { distance: distBuf[goal], pathCells };
}

/** Plain multi-source BFS over the whole board, ignoring pawns. Walls must be loaded. */
function fillDistances(out: Int16Array, sources: number[]): void {
  out.fill(-1);
  let head = 0;
  let tail = 0;
  for (const s of sources) {
    out[s] = 0;
    queueBuf[tail++] = s;
  }
  while (head < tail) {
    const cur = queueBuf[head++];
    const cr = (cur / 9) | 0;
    const cc = cur - cr * 9;
    const d = out[cur] + 1;
    for (let dir = 0; dir < 4; dir++) {
      if (stepBlocked(cr, cc, dir)) continue;
      const next = (cr + DR[dir]) * 9 + cc + DC[dir];
      if (out[next] < 0) {
        out[next] = d;
        queueBuf[tail++] = next;
      }
    }
  }
}

const GOALS: number[][] = [[], []];
for (let c = 0; c < 9; c++) {
  GOALS[0].push(8 * 9 + c);
  GOALS[1].push(c);
}

/**
 * Marks in `out` (length 81) every cell lying on at least one shortest path from
 * `start` to `goalRow` (pawns ignored) and returns how many there are.
 */
export function wallsCorridor(w: Walls, start: number, goalRow: number, out?: Uint8Array): number {
  loadWalls(w);
  const goals = goalRow === 8 ? GOALS[0] : GOALS[1];
  fillDistances(fwdBuf, [start]);
  fillDistances(bwdBuf, goals);

  let best = 32767;
  for (const g of goals) if (fwdBuf[g] >= 0 && fwdBuf[g] < best) best = fwdBuf[g];
  if (out) out.fill(0);
  if (best === 32767) return 0;

  let width = 0;
  for (let i = 0; i < N; i++) {
    if (fwdBuf[i] >= 0 && bwdBuf[i] >= 0 && fwdBuf[i] + bwdBuf[i] === best) {
      width++;
      if (out) out[i] = 1;
    }
  }
  return width;
}

/**
 * "Width" of the shortest-path corridor: the number of distinct cells that lie
 * on at least one shortest path to the goal row (pawns ignored). A wide corridor
 * is harder to cut off with a single wall.
 */
export function getPathDiversity(state: QState, player: 0 | 1): number {
  return wallsCorridor(splitWalls(state.h_walls, state.v_walls), cellOf(state, player), player === 0 ? 8 : 0);
}
