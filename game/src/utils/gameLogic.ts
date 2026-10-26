import { Cell, Wall, Position, GameState } from '../types';

export function initializeBoard(): Cell[][] {
  const board: Cell[][] = Array(9)
    .fill(null)
    .map(() =>
      Array(9)
        .fill(null)
        .map(() => ({
          isPassable: true,
          walls: {
            top: false,
            bottom: false,
            left: false,
            right: false,
          },
        }))
    );
  return board;
}

export function initializeGame(level: string): Partial<GameState> {
  return {
    board: initializeBoard(),
    playerPos: { row: 0, col: 4 },
    aiPos: { row: 8, col: 4 },
    playerWallsLeft: 10,
    aiWallsLeft: 10,
    walls: [],
    currentTurn: 'player',
    gameStatus: 'playing',
    aiLevel: level as any,
    moveHistory: [],
    selectedCell: null,
    validMoves: [],
    validWalls: [],
    hoverCell: null,
  };
}

export function isWallBlocking(
  from: Position,
  to: Position,
  board: Cell[][]
): boolean {
  const dr = to.row - from.row;
  const dc = to.col - from.col;

  if (dr === -1) return board[from.row][from.col].walls.top;
  if (dr === 1) return board[from.row][from.col].walls.bottom;
  if (dc === -1) return board[from.row][from.col].walls.left;
  if (dc === 1) return board[from.row][from.col].walls.right;

  return false;
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row <= 8 && col >= 0 && col <= 8;
}

/**
 * Pawn moves per the official rules (same as the AI engine's board.ts):
 * - one step orthogonally unless a wall is in the way;
 * - onto the opponent: jump straight over it, provided no wall stands behind it;
 * - if that straight jump is blocked by a wall or the board edge, step diagonally
 *   to either side of the opponent instead (unless a wall blocks that side).
 */
export function getValidMoves(
  pos: Position,
  board: Cell[][],
  opponentPos: Position
): Position[] {
  const valid: Position[] = [];
  const directions = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];

  for (const { dr, dc } of directions) {
    const next = { row: pos.row + dr, col: pos.col + dc };
    if (!inBounds(next.row, next.col)) continue;
    if (isWallBlocking(pos, next, board)) continue;

    if (next.row !== opponentPos.row || next.col !== opponentPos.col) {
      valid.push(next);
      continue;
    }

    const jump = { row: next.row + dr, col: next.col + dc };
    if (inBounds(jump.row, jump.col) && !isWallBlocking(next, jump, board)) {
      valid.push(jump);
      continue;
    }

    // Straight jump blocked: the two cells beside the opponent, perpendicular to the move.
    const sides = dr !== 0 ? [{ dr: 0, dc: -1 }, { dr: 0, dc: 1 }] : [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }];
    for (const side of sides) {
      const diag = { row: next.row + side.dr, col: next.col + side.dc };
      if (!inBounds(diag.row, diag.col) || isWallBlocking(next, diag, board)) continue;
      if (!valid.some((m) => m.row === diag.row && m.col === diag.col)) valid.push(diag);
    }
  }

  return valid;
}

export function applyWallToBoard(board: Cell[][], wall: Wall): void {
  if (wall.direction === 'horizontal') {
    // Horizontal wall blocks movement between row and row+1
    board[wall.row][wall.col].walls.bottom = true;
    if (wall.col + 1 <= 8) {
      board[wall.row][wall.col + 1].walls.bottom = true;
    }
    // Also mark the cells below
    if (wall.row + 1 <= 8) {
      board[wall.row + 1][wall.col].walls.top = true;
      if (wall.col + 1 <= 8) {
        board[wall.row + 1][wall.col + 1].walls.top = true;
      }
    }
  } else {
    // Vertical wall blocks movement between col and col+1
    board[wall.row][wall.col].walls.right = true;
    if (wall.row + 1 <= 8) {
      board[wall.row + 1][wall.col].walls.right = true;
    }
    // Also mark the cells to the right
    if (wall.col + 1 <= 8) {
      board[wall.row][wall.col + 1].walls.left = true;
      if (wall.row + 1 <= 8) {
        board[wall.row + 1][wall.col + 1].walls.left = true;
      }
    }
  }
}

export function canReachGoal(
  board: Cell[][],
  startPos: Position,
  goalRow: number
): boolean {
  const visited = new Set<string>();
  const queue = [startPos];

  while (queue.length > 0) {
    const { row, col } = queue.shift()!;
    const key = `${row},${col}`;

    if (visited.has(key)) continue;
    visited.add(key);

    if (row === goalRow) return true;

    const directions = [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
    ];

    for (const { dr, dc } of directions) {
      const newRow = row + dr;
      const newCol = col + dc;

      if (newRow < 0 || newRow > 8 || newCol < 0 || newCol > 8) continue;
      if (visited.has(`${newRow},${newCol}`)) continue;
      if (isWallBlocking({ row, col }, { row: newRow, col: newCol }, board)) continue;

      queue.push({ row: newRow, col: newCol });
    }
  }

  return false;
}

/**
 * `walls` are the walls already on the board. They are needed for the crossing rule: a
 * horizontal and a vertical wall may not share the same centre point, and the per-cell
 * flags cannot tell one wall there from two walls meeting end to end.
 */
export function isValidWallPlacement(
  wall: Wall,
  board: Cell[][],
  playerPos: Position,
  aiPos: Position,
  walls: Wall[]
): boolean {
  if (wall.row < 0 || wall.col < 0 || wall.row >= 8 || wall.col >= 8) return false;

  // Overlap with a wall of the same orientation (fully or by half).
  if (wall.direction === 'horizontal') {
    if (board[wall.row][wall.col].walls.bottom) return false;
    if (board[wall.row][wall.col + 1].walls.bottom) return false;
  } else {
    if (board[wall.row][wall.col].walls.right) return false;
    if (board[wall.row + 1][wall.col].walls.right) return false;
  }
  if (walls.some((w) => w.row === wall.row && w.col === wall.col && w.direction !== wall.direction)) return false;

  // Both players must still be able to reach their goal row.
  const testBoard: Cell[][] = JSON.parse(JSON.stringify(board));
  applyWallToBoard(testBoard, wall);
  return canReachGoal(testBoard, playerPos, 8) && canReachGoal(testBoard, aiPos, 0);
}

export function getValidWallPositions(
  board: Cell[][],
  playerPos: Position,
  aiPos: Position,
  placedBy: 'player' | 'ai',
  walls: Wall[]
): Wall[] {
  const valid: Wall[] = [];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      for (const direction of ['horizontal', 'vertical'] as const) {
        const wall: Wall = { row, col, direction, placedBy };
        if (isValidWallPlacement(wall, board, playerPos, aiPos, walls)) valid.push(wall);
      }
    }
  }

  return valid;
}
