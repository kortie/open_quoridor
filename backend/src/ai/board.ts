import { QState, Action, Position, PAWN_MOVES, WallPlacement } from './types.js';
import {
  anchorBit,
  hasAnchor,
  splitWalls,
  blocked,
  shortestPath,
  canReachGoal,
  Walls,
} from './pathfind.js';

export function initBoard(): QState {
  return {
    p1_row: 0,
    p1_col: 4,
    p2_row: 8,
    p2_col: 4,
    p1_walls: 10,
    p2_walls: 10,
    h_walls: 0n,
    v_walls: 0n,
    turn: 0,
  };
}

export function getCurrentPos(state: QState): Position {
  return state.turn === 0
    ? { row: state.p1_row, col: state.p1_col }
    : { row: state.p2_row, col: state.p2_col };
}

export function getOpponentPos(state: QState): Position {
  return state.turn === 0
    ? { row: state.p2_row, col: state.p2_col }
    : { row: state.p1_row, col: state.p1_col };
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r <= 8 && c >= 0 && c <= 8;
}

export function decodePawnMove(action: Action): { dr: number; dc: number } | null {
  if (action < 0 || action >= 12) return null;
  return PAWN_MOVES[action];
}

export function decodeWallAction(action: Action): WallPlacement | null {
  if (action >= 12 && action < 76) {
    const idx = action - 12;
    return { row: Math.floor(idx / 8), col: idx % 8, direction: 'horizontal' };
  }
  if (action >= 76 && action < 140) {
    const idx = action - 76;
    return { row: Math.floor(idx / 8), col: idx % 8, direction: 'vertical' };
  }
  return null;
}

export function encodeWallAction(
  row: number,
  col: number,
  direction: 'horizontal' | 'vertical'
): Action {
  const idx = row * 8 + col;
  return direction === 'horizontal' ? 12 + idx : 76 + idx;
}

/**
 * Same-orientation walls may not share an anchor or half-overlap with a
 * neighbouring anchor along their length; opposite orientations may not cross
 * at the same anchor.
 */
function wallConflicts(wall: WallPlacement, h_walls: bigint, v_walls: bigint): boolean {
  const { row: r, col: c } = wall;
  if (wall.direction === 'horizontal') {
    return (
      hasAnchor(h_walls, r, c) ||
      hasAnchor(h_walls, r, c - 1) ||
      hasAnchor(h_walls, r, c + 1) ||
      hasAnchor(v_walls, r, c)
    );
  }
  return (
    hasAnchor(v_walls, r, c) ||
    hasAnchor(v_walls, r - 1, c) ||
    hasAnchor(v_walls, r + 1, c) ||
    hasAnchor(h_walls, r, c)
  );
}

function withWall(state: QState, wall: WallPlacement): QState {
  const bit = anchorBit(wall.row, wall.col);
  return wall.direction === 'horizontal'
    ? { ...state, h_walls: state.h_walls | bit }
    : { ...state, v_walls: state.v_walls | bit };
}

/** A Walls set containing only this one anchor. */
function singleWall(wall: WallPlacement): Walls {
  const idx = wall.row * 8 + wall.col;
  const lo = idx < 32 ? (1 << idx) >>> 0 : 0;
  const hi = idx >= 32 ? (1 << (idx - 32)) >>> 0 : 0;
  return wall.direction === 'horizontal'
    ? { hLo: lo, hHi: hi, vLo: 0, vHi: 0 }
    : { hLo: 0, hHi: 0, vLo: lo, vHi: hi };
}

/**
 * True if the new wall severs an edge of this shortest path. A wall that leaves
 * the current shortest path intact cannot disconnect the player, so callers can
 * skip the BFS in that case. Jump edges are treated conservatively as cut.
 */
function cutsPath(wall: WallPlacement, cells: number[]): boolean {
  if (cells.length === 0) return true;
  const w = singleWall(wall);
  for (let i = 1; i < cells.length; i++) {
    const a = cells[i - 1];
    const b = cells[i];
    const ar = (a / 9) | 0;
    const ac = a - ar * 9;
    const br = (b / 9) | 0;
    const bc = b - br * 9;
    if (Math.abs(ar - br) + Math.abs(ac - bc) !== 1) return true;
    if (blocked(w, ar, ac, br, bc)) return true;
  }
  return false;
}

/**
 * Returns a predicate for wall legality in `state`. Both players' shortest paths
 * are computed once (or supplied) so most candidates need no BFS at all.
 */
export function wallLegalityChecker(
  state: QState,
  paths?: [number[], number[]]
): (action: Action) => boolean {
  const p1 = paths ? paths[0] : shortestPath(state, 0).cells;
  const p2 = paths ? paths[1] : shortestPath(state, 1).cells;

  return (action: Action) => {
    const wall = decodeWallAction(action);
    if (!wall) return false;
    if (wallConflicts(wall, state.h_walls, state.v_walls)) return false;

    const test = withWall(state, wall);
    if (cutsPath(wall, p1) && !canReachGoal(test, 0)) return false;
    if (cutsPath(wall, p2) && !canReachGoal(test, 1)) return false;
    return true;
  };
}

export function isWallLegal(state: QState, action: Action): boolean {
  return wallLegalityChecker(state)(action);
}

export function getLegalPawnMoves(state: QState): Action[] {
  const moves: Action[] = [];
  const w = splitWalls(state.h_walls, state.v_walls);
  const me = getCurrentPos(state);
  const op = getOpponentPos(state);

  for (let action = 0; action < 4; action++) {
    const delta = PAWN_MOVES[action];
    const nr = me.row + delta.dr;
    const nc = me.col + delta.dc;
    if (!inBounds(nr, nc) || blocked(w, me.row, me.col, nr, nc)) continue;

    if (nr !== op.row || nc !== op.col) {
      moves.push(action);
      continue;
    }

    // Opponent occupies (nr,nc): straight jump lands one further in the same direction
    const jr = nr + delta.dr;
    const jc = nc + delta.dc;
    if (inBounds(jr, jc) && !blocked(w, nr, nc, jr, jc)) {
      moves.push(4 + action);
      continue;
    }

    // Straight jump blocked by wall or board edge: diagonals perpendicular to the blocked direction
    const perpendicular = delta.dr !== 0 ? [2, 3] : [0, 1];
    for (const perpAction of perpendicular) {
      const perp = PAWN_MOVES[perpAction];
      const gr = nr + perp.dr;
      const gc = nc + perp.dc;
      if (!inBounds(gr, gc) || blocked(w, nr, nc, gr, gc)) continue;
      moves.push(diagonalAction(gr - me.row, gc - me.col));
    }
  }

  return moves;
}

function diagonalAction(dr: number, dc: number): Action {
  if (dr === -1) return dc === 1 ? 8 : 9; // NE, NW
  return dc === 1 ? 10 : 11; // SE, SW
}

export function getLegalWallMoves(state: QState): Action[] {
  const wallsLeft = state.turn === 0 ? state.p1_walls : state.p2_walls;
  if (wallsLeft <= 0) return [];

  const legal = wallLegalityChecker(state);
  const moves: Action[] = [];
  for (let action = 12; action < 140; action++) {
    if (legal(action)) moves.push(action);
  }
  return moves;
}

export function getMoves(state: QState): Action[] {
  return [...getLegalPawnMoves(state), ...getLegalWallMoves(state)];
}

/**
 * Apply a move and return the new state. Does not validate legality.
 */
export function applyMove(state: QState, action: Action): QState {
  let next: QState;

  if (action < 12) {
    const delta = PAWN_MOVES[action];
    const pos = getCurrentPos(state);
    next = state.turn === 0
      ? { ...state, p1_row: pos.row + delta.dr, p1_col: pos.col + delta.dc }
      : { ...state, p2_row: pos.row + delta.dr, p2_col: pos.col + delta.dc };
  } else {
    const wall = decodeWallAction(action);
    if (!wall) return { ...state };
    next = withWall(state, wall);
    if (state.turn === 0) next.p1_walls--;
    else next.p2_walls--;
  }

  next.turn = state.turn === 0 ? 1 : 0;
  return next;
}

/**
 * 0 = ongoing, 1 = P1 wins, 2 = P2 wins
 */
export function getWinner(state: QState): 0 | 1 | 2 {
  if (state.p1_row === 8) return 1;
  if (state.p2_row === 0) return 2;
  return 0;
}
