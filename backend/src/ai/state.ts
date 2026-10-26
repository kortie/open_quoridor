import { QState, Action, PAWN_MOVES } from './types.js';
import { Walls, splitWalls, loadWalls, stepBlocked, wallsReachable } from './pathfind.js';

/**
 * Search-internal game state. Walls are four 32-bit words instead of bigints and the
 * Zobrist hash is carried along and updated incrementally, so the hot path never
 * touches bigint arithmetic. Convert from the public QState once per search.
 */
export interface EState {
  /** Pawn cells (row*9+col) for P1 and P2. */
  p0: number;
  p1: number;
  /** Walls left for P1 and P2. */
  n0: number;
  n1: number;
  w: Walls;
  turn: 0 | 1;
  /** Zobrist hash halves. */
  k0: number;
  k1: number;
}

// --- Zobrist --------------------------------------------------------------------

const Z_POS = new Uint32Array(2 * 2 * 81); // [player][cell] -> (lo, hi)
const Z_H = new Uint32Array(2 * 64);
const Z_V = new Uint32Array(2 * 64);
let Z_TURN0 = 0;
let Z_TURN1 = 0;

(function initZobrist() {
  let s = 0x9e3779b9;
  const next = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s;
  };
  for (let i = 0; i < Z_POS.length; i++) Z_POS[i] = next();
  for (let i = 0; i < Z_H.length; i++) Z_H[i] = next();
  for (let i = 0; i < Z_V.length; i++) Z_V[i] = next();
  Z_TURN0 = next();
  Z_TURN1 = next();
})();

function posKey(player: 0 | 1, cell: number): number {
  return (player * 81 + cell) * 2;
}

function xorWord(table: Uint32Array, word: number, base: number, k: [number, number]): void {
  let x = word >>> 0;
  while (x !== 0) {
    const lsb = x & -x;
    const i = (base + 31 - Math.clz32(lsb)) * 2;
    k[0] ^= table[i];
    k[1] ^= table[i + 1];
    x = (x ^ lsb) >>> 0;
  }
}

function fullHash(s: EState): [number, number] {
  const k: [number, number] = [0, 0];
  const a = posKey(0, s.p0);
  const b = posKey(1, s.p1);
  k[0] = Z_POS[a] ^ Z_POS[b];
  k[1] = Z_POS[a + 1] ^ Z_POS[b + 1];
  xorWord(Z_H, s.w.hLo, 0, k);
  xorWord(Z_H, s.w.hHi, 32, k);
  xorWord(Z_V, s.w.vLo, 0, k);
  xorWord(Z_V, s.w.vHi, 32, k);
  if (s.turn === 1) {
    k[0] ^= Z_TURN0;
    k[1] ^= Z_TURN1;
  }
  // Wall counts matter: same walls on board with a different split is a different position.
  k[0] ^= Math.imul(s.n0 + 1, 0x27d4eb2d) ^ Math.imul(s.n1 + 1, 0x165667b1);
  return [k[0] >>> 0, k[1] >>> 0];
}

/** A 53-bit number key suitable for Map lookups. */
export function hashKey(s: EState): number {
  return (s.k1 & 0x1fffff) * 4294967296 + (s.k0 >>> 0);
}

// --- Conversion -----------------------------------------------------------------

export function fromQState(q: QState): EState {
  const s: EState = {
    p0: q.p1_row * 9 + q.p1_col,
    p1: q.p2_row * 9 + q.p2_col,
    n0: q.p1_walls,
    n1: q.p2_walls,
    w: splitWalls(q.h_walls, q.v_walls),
    turn: q.turn,
    k0: 0,
    k1: 0,
  };
  [s.k0, s.k1] = fullHash(s);
  return s;
}

// --- Rules ----------------------------------------------------------------------

export function myCell(s: EState): number {
  return s.turn === 0 ? s.p0 : s.p1;
}

export function opCell(s: EState): number {
  return s.turn === 0 ? s.p1 : s.p0;
}

export function goalRow(player: 0 | 1): number {
  return player === 0 ? 8 : 0;
}

export function wallsLeft(s: EState, player: 0 | 1): number {
  return player === 0 ? s.n0 : s.n1;
}

/** 0 = ongoing, 1 = P1 wins, 2 = P2 wins. */
export function winnerOf(s: EState): 0 | 1 | 2 {
  if (s.p0 >= 72) return 1;
  if (s.p1 < 9) return 2;
  return 0;
}

const DR = [-1, 1, 0, 0];
const DC = [0, 0, 1, -1];

function diagonalAction(dr: number, dc: number): Action {
  if (dr === -1) return dc === 1 ? 8 : 9; // NE, NW
  return dc === 1 ? 10 : 11; // SE, SW
}

/** Legal pawn actions for the side to move, in the same order as board.getLegalPawnMoves. */
export function pawnMoves(s: EState): Action[] {
  loadWalls(s.w);
  const me = myCell(s);
  const op = opCell(s);
  const mr = (me / 9) | 0;
  const mc = me - mr * 9;
  const moves: Action[] = [];

  for (let dir = 0; dir < 4; dir++) {
    if (stepBlocked(mr, mc, dir)) continue;
    const nr = mr + DR[dir];
    const nc = mc + DC[dir];
    if (nr * 9 + nc !== op) {
      moves.push(dir);
      continue;
    }
    if (!stepBlocked(nr, nc, dir)) {
      moves.push(4 + dir);
      continue;
    }
    const p0 = DR[dir] !== 0 ? 2 : 0;
    for (let k = 0; k < 2; k++) {
      if (stepBlocked(nr, nc, p0 + k)) continue;
      moves.push(diagonalAction(nr + DR[p0 + k] - mr, nc + DC[p0 + k] - mc));
    }
  }
  return moves;
}

function anchorIn(lo: number, hi: number, r: number, c: number): boolean {
  if (r < 0 || r > 7 || c < 0 || c > 7) return false;
  const idx = r * 8 + c;
  return idx < 32 ? ((lo >>> idx) & 1) === 1 : ((hi >>> (idx - 32)) & 1) === 1;
}

/** Overlap/crossing rules only (no path check). */
export function wallConflicts(w: Walls, action: Action): boolean {
  const horizontal = action < 76;
  const idx = horizontal ? action - 12 : action - 76;
  const r = idx >> 3;
  const c = idx & 7;
  if (horizontal) {
    return (
      anchorIn(w.hLo, w.hHi, r, c) ||
      anchorIn(w.hLo, w.hHi, r, c - 1) ||
      anchorIn(w.hLo, w.hHi, r, c + 1) ||
      anchorIn(w.vLo, w.vHi, r, c)
    );
  }
  return (
    anchorIn(w.vLo, w.vHi, r, c) ||
    anchorIn(w.vLo, w.vHi, r - 1, c) ||
    anchorIn(w.vLo, w.vHi, r + 1, c) ||
    anchorIn(w.hLo, w.hHi, r, c)
  );
}

export function addWall(w: Walls, action: Action): Walls {
  const horizontal = action < 76;
  const idx = horizontal ? action - 12 : action - 76;
  const lo = idx < 32 ? (1 << idx) >>> 0 : 0;
  const hi = idx >= 32 ? (1 << (idx - 32)) >>> 0 : 0;
  return horizontal
    ? { hLo: (w.hLo | lo) >>> 0, hHi: (w.hHi | hi) >>> 0, vLo: w.vLo, vHi: w.vHi }
    : { hLo: w.hLo, hHi: w.hHi, vLo: (w.vLo | lo) >>> 0, vHi: (w.vHi | hi) >>> 0 };
}

/**
 * True if the wall severs an edge of this path. Non-orthogonal steps (jumps) are
 * treated conservatively as cut. A wall that leaves a shortest path intact can
 * neither disconnect that player nor lengthen their distance.
 */
export function wallCutsPath(action: Action, cells: number[]): boolean {
  if (cells.length === 0) return true;
  const horizontal = action < 76;
  const idx = horizontal ? action - 12 : action - 76;
  const wr = idx >> 3;
  const wc = idx & 7;
  for (let i = 1; i < cells.length; i++) {
    const a = cells[i - 1];
    const b = cells[i];
    const ar = (a / 9) | 0;
    const ac = a - ar * 9;
    const br = (b / 9) | 0;
    const bc = b - br * 9;
    const dr = br - ar;
    const dc = bc - ac;
    if (Math.abs(dr) + Math.abs(dc) !== 1) return true;
    if (dr !== 0) {
      if (horizontal && wr === (dr > 0 ? ar : br) && (wc === ac || wc === ac - 1)) return true;
    } else if (!horizontal && wc === (dc > 0 ? ac : bc) && (wr === ar || wr === ar - 1)) {
      return true;
    }
  }
  return false;
}

/**
 * Full legality for a wall action given both players' current shortest paths
 * (P1 first). Only walls that cut a path pay for a reachability BFS.
 */
export function wallLegal(s: EState, action: Action, path0: number[], path1: number[]): boolean {
  if (wallConflicts(s.w, action)) return false;
  const w = addWall(s.w, action);
  if (wallCutsPath(action, path0) && !wallsReachable(w, s.p0, 8, s.p1)) return false;
  if (wallCutsPath(action, path1) && !wallsReachable(w, s.p1, 0, s.p0)) return false;
  return true;
}

export function applyAction(s: EState, action: Action): EState {
  let k0 = s.k0 ^ Z_TURN0;
  let k1 = s.k1 ^ Z_TURN1;

  if (action < 12) {
    const d = PAWN_MOVES[action];
    const from = myCell(s);
    const to = from + d.dr * 9 + d.dc;
    const a = posKey(s.turn, from);
    const b = posKey(s.turn, to);
    k0 ^= Z_POS[a] ^ Z_POS[b];
    k1 ^= Z_POS[a + 1] ^ Z_POS[b + 1];
    return s.turn === 0
      ? { p0: to, p1: s.p1, n0: s.n0, n1: s.n1, w: s.w, turn: 1, k0: k0 >>> 0, k1: k1 >>> 0 }
      : { p0: s.p0, p1: to, n0: s.n0, n1: s.n1, w: s.w, turn: 0, k0: k0 >>> 0, k1: k1 >>> 0 };
  }

  const horizontal = action < 76;
  const idx = horizontal ? action - 12 : action - 76;
  const table = horizontal ? Z_H : Z_V;
  k0 ^= table[idx * 2];
  k1 ^= table[idx * 2 + 1];
  // Wall count term: remove the old count contribution, add the new one.
  if (s.turn === 0) k0 ^= Math.imul(s.n0 + 1, 0x27d4eb2d) ^ Math.imul(s.n0, 0x27d4eb2d);
  else k0 ^= Math.imul(s.n1 + 1, 0x165667b1) ^ Math.imul(s.n1, 0x165667b1);

  const w = addWall(s.w, action);
  return s.turn === 0
    ? { p0: s.p0, p1: s.p1, n0: s.n0 - 1, n1: s.n1, w, turn: 1, k0: k0 >>> 0, k1: k1 >>> 0 }
    : { p0: s.p0, p1: s.p1, n0: s.n0, n1: s.n1 - 1, w, turn: 0, k0: k0 >>> 0, k1: k1 >>> 0 };
}

/** Recompute the hash from scratch; used by tests to check incremental updates. */
export function recomputeHash(s: EState): [number, number] {
  return fullHash(s);
}
