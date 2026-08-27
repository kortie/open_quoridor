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
    const newRow = pos.row + dr;
    const newCol = pos.col + dc;

    if (newRow < 0 || newRow > 8 || newCol < 0 || newCol > 8) continue;
    if (isWallBlocking(pos, { row: newRow, col: newCol }, board)) continue;

    if (newRow === opponentPos.row && newCol === opponentPos.col) {
      const jumpRow = newRow + dr;
      const jumpCol = newCol + dc;

      if (jumpRow >= 0 && jumpRow <= 8 && jumpCol >= 0 && jumpCol <= 8) {
        if (!isWallBlocking({ row: newRow, col: newCol }, { row: jumpRow, col: jumpCol }, board)) {
          valid.push({ row: jumpRow, col: jumpCol });
        }
      }
    } else {
      valid.push({ row: newRow, col: newCol });
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

export function isValidWallPlacement(
  wall: Wall,
  board: Cell[][],
  playerPos: Position,
  aiPos: Position
): boolean {
  // Check bounds
  if (wall.row < 0 || wall.col < 0) {
    return false;
  }

  if (wall.direction === 'horizontal') {
    if (wall.row >= 8 || wall.col >= 8) return false;
    // Check if wall already exists
    if (board[wall.row][wall.col].walls.bottom) return false;
    if (wall.col + 1 <= 8 && board[wall.row][wall.col + 1].walls.bottom) return false;
  } else {
    if (wall.col >= 8 || wall.row >= 8) return false;
    // Check if wall already exists
    if (board[wall.row][wall.col].walls.right) return false;
    if (wall.row + 1 <= 8 && board[wall.row + 1][wall.col].walls.right) return false;
  }

  // Create test board
  const testBoard = JSON.parse(JSON.stringify(board));
  applyWallToBoard(testBoard, wall);

  // Check if opponent can still reach goal
  const targetRow = wall.placedBy === 'player' ? 0 : 8;
  const opponentPos = wall.placedBy === 'player' ? aiPos : playerPos;

  return canReachGoal(testBoard, opponentPos, targetRow);
}

export function getValidWallPositions(
  board: Cell[][],
  playerPos: Position,
  aiPos: Position,
  placedBy: 'player' | 'ai'
): Wall[] {
  const walls: Wall[] = [];

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      // Horizontal walls
      const hWall: Wall = { row, col, direction: 'horizontal', placedBy };
      if (isValidWallPlacement(hWall, board, playerPos, aiPos)) {
        walls.push(hWall);
      }

      // Vertical walls
      const vWall: Wall = { row, col, direction: 'vertical', placedBy };
      if (isValidWallPlacement(vWall, board, playerPos, aiPos)) {
        walls.push(vWall);
      }
    }
  }

  return walls;
}
