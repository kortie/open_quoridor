import {
  initBoard,
  getMoves,
  applyMove,
  getWinner,
  getLegalPawnMoves,
  getLegalWallMoves,
  isWallLegal,
  decodeWallAction,
  encodeWallAction,
  decodePawnMove,
} from '../src/ai/board.js';
import { QState } from '../src/ai/types.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}\nExpected: ${expected}\nActual: ${actual}`);
  }
}

// Test 1: Initial board setup
function testInitBoard() {
  const board = initBoard();
  assertEqual(board.p1_row, 0, 'P1 starts at row 0');
  assertEqual(board.p1_col, 4, 'P1 starts at col 4');
  assertEqual(board.p2_row, 8, 'P2 starts at row 8');
  assertEqual(board.p2_col, 4, 'P2 starts at col 4');
  assertEqual(board.p1_walls, 10, 'P1 has 10 walls');
  assertEqual(board.p2_walls, 10, 'P2 has 10 walls');
  assertEqual(board.h_walls, 0n, 'No horizontal walls initially');
  assertEqual(board.v_walls, 0n, 'No vertical walls initially');
  assertEqual(board.turn, 0, 'P1 starts first');
  console.log('✓ Test 1: Initial board setup');
}

// Test 2: Initial legal moves count
function testInitialMoveCount() {
  const board = initBoard();
  const moves = getMoves(board);
  const pawnMoves = getLegalPawnMoves(board);
  const wallMoves = getLegalWallMoves(board);

  // P1 starts at (0,4): can move S, E, W (not N - out of bounds)
  assertEqual(pawnMoves.length, 3, 'P1 has 3 legal pawn moves at start (S, E, W)');
  // 128 walls total (8x8 grid for H-walls + 8x8 for V-walls)
  assertEqual(wallMoves.length, 128, 'P1 has 128 legal wall placements');
  assertEqual(moves.length, 131, 'P1 has 131 total legal moves');
  console.log('✓ Test 2: Initial legal moves count');
}

// Test 3: Pawn move decoding
function testPawnMoveDecode() {
  const move0 = decodePawnMove(0);
  assertEqual(move0?.dr, -1, 'Move 0 is north');
  assertEqual(move0?.dc, 0, 'Move 0 is north');

  const move1 = decodePawnMove(1);
  assertEqual(move1?.dr, 1, 'Move 1 is south');
  assertEqual(move1?.dc, 0, 'Move 1 is south');

  const moveInvalid = decodePawnMove(12);
  assertEqual(moveInvalid, null, 'Move 12 is invalid (wall action)');
  console.log('✓ Test 3: Pawn move decoding');
}

// Test 4: Wall action encoding/decoding
function testWallActionEncode() {
  // H-wall at (2, 3)
  const hAction = encodeWallAction(2, 3, 'horizontal');
  assertEqual(hAction, 12 + 2 * 8 + 3, 'H-wall encoding correct');

  const decoded = decodeWallAction(hAction);
  assertEqual(decoded?.row, 2, 'H-wall row decoded');
  assertEqual(decoded?.col, 3, 'H-wall col decoded');
  assertEqual(decoded?.direction, 'horizontal', 'H-wall direction decoded');

  // V-wall at (5, 7)
  const vAction = encodeWallAction(5, 7, 'vertical');
  assertEqual(vAction, 76 + 5 * 8 + 7, 'V-wall encoding correct');

  const decodedV = decodeWallAction(vAction);
  assertEqual(decodedV?.row, 5, 'V-wall row decoded');
  assertEqual(decodedV?.col, 7, 'V-wall col decoded');
  assertEqual(decodedV?.direction, 'vertical', 'V-wall direction decoded');
  console.log('✓ Test 4: Wall action encoding/decoding');
}

// Test 5: Simple pawn move
function testSimplePawnMove() {
  const board = initBoard();
  // P1 moves south (action 1)
  const newBoard = applyMove(board, 1);

  assertEqual(newBoard.p1_row, 1, 'P1 moved to row 1');
  assertEqual(newBoard.p1_col, 4, 'P1 col unchanged');
  assertEqual(newBoard.turn, 1, 'Turn switched to P2');
  assertEqual(newBoard.p1_walls, 10, 'P1 walls unchanged');
  console.log('✓ Test 5: Simple pawn move');
}

// Test 6: Wall placement
function testWallPlacement() {
  const board = initBoard();
  // Place H-wall at (4, 4)
  const wallAction = encodeWallAction(4, 4, 'horizontal');
  const newBoard = applyMove(board, wallAction);

  assertEqual(newBoard.p1_walls, 9, 'P1 walls decremented');
  assertEqual(newBoard.turn, 1, 'Turn switched to P2');
  assert((newBoard.h_walls & (1n << 36n)) !== 0n, 'Wall bit set in h_walls');
  console.log('✓ Test 6: Wall placement');
}

// Test 7: Winner detection
function testWinnerDetection() {
  let board = initBoard();

  // P1 moves to goal
  board.p1_row = 8;
  let winner = getWinner(board);
  assertEqual(winner, 1, 'P1 wins when reaching row 8');

  // Reset and test P2
  board = initBoard();
  board.p2_row = 0;
  winner = getWinner(board);
  assertEqual(winner, 2, 'P2 wins when reaching row 0');

  // Test ongoing
  board = initBoard();
  winner = getWinner(board);
  assertEqual(winner, 0, 'Game ongoing at start');
  console.log('✓ Test 7: Winner detection');
}

// Test 8: Wall overlap prevention
function testWallOverlapPrevention() {
  let board = initBoard();
  const wallAction = encodeWallAction(4, 4, 'horizontal');

  // First wall should be legal
  assert(isWallLegal(board, wallAction), 'First wall placement is legal');

  // Place the wall
  board = applyMove(board, wallAction);

  // Now try to place overlapping wall (same position)
  const overlappingAction = encodeWallAction(4, 4, 'horizontal');
  assert(!isWallLegal(board, overlappingAction), 'Overlapping wall is rejected');

  // Adjacent wall in same direction should be rejected
  const adjacentAction = encodeWallAction(4, 5, 'horizontal');
  assert(!isWallLegal(board, adjacentAction), 'Adjacent wall in same direction is rejected');
  console.log('✓ Test 8: Wall overlap prevention');
}

// Test 9: Multiple moves in sequence
function testMoveSequence() {
  let board = initBoard();

  // P1: move south
  board = applyMove(board, 1); // S
  assertEqual(board.p1_row, 1, 'P1 at row 1 after move 1');
  assertEqual(board.turn, 1, 'P2 turn after move 1');

  // P2: move north (action 0)
  board = applyMove(board, 0); // N
  assertEqual(board.p2_row, 7, 'P2 at row 7 after moving north');

  // P1: move south again
  board = applyMove(board, 1); // S
  assertEqual(board.p1_row, 2, 'P1 at row 2 after move 2');
  assertEqual(board.turn, 1, 'P2 turn again');

  console.log('✓ Test 9: Multiple moves in sequence');
}

// Test 10: Wall removes valid placements
function testWallBlocking() {
  let board = initBoard();

  // Place walls to block opponent's path
  // H-wall at (4, 4) blocks movement between rows 4 and 5
  const hWallAction = encodeWallAction(4, 4, 'horizontal');
  board = applyMove(board, hWallAction);

  // Wall should block some path
  assert(board.h_walls !== 0n, 'Wall is placed');
  console.log('✓ Test 10: Wall blocking');
}

// Test 11: Wall legality with path blocking
function testWallPathValidation() {
  let board = initBoard();

  // Try to place a wall that would completely block a player's path
  // This would require more complex board state setup
  // For now, just verify walls that block access still validate both players can reach goal
  let testBoard = { ...board };

  // Place multiple walls to create a test case
  const validMove = encodeWallAction(2, 3, 'horizontal');
  assert(isWallLegal(testBoard, validMove), 'Wall in open area is legal');

  console.log('✓ Test 11: Wall path validation');
}

// Test 12: Move count after walls
function testMoveCountAfterWalls() {
  let board = initBoard();

  // Place a wall
  const wallAction = encodeWallAction(4, 4, 'horizontal');
  board = applyMove(board, wallAction);

  // P2 turn now
  const p2Moves = getMoves(board);
  assert(p2Moves.length > 0, 'P2 has legal moves');
  assert(p2Moves.length <= 129, 'P2 has reasonable move count');

  console.log('✓ Test 12: Move count after walls');
}

// Test 13: Out of bounds move prevention
function testOutOfBoundsPrevention() {
  let board = initBoard();

  // Try all possible moves on initial board
  const moves = getMoves(board);

  // All moves should be valid actions (0-139)
  for (const move of moves) {
    assert(move >= 0 && move < 140, `Move ${move} is in valid range`);
  }

  console.log('✓ Test 13: Out of bounds prevention');
}

// Test 14: Wall count limit
function testWallCountLimit() {
  let board = initBoard();

  // Use up all walls
  let wallCount = 0;
  while (board.p1_walls > 0 && wallCount < 10) {
    const moves = getMoves(board);
    let wallFound = false;

    for (const move of moves) {
      if (move >= 12) {
        board = applyMove(board, move);
        wallCount++;
        wallFound = true;
        break;
      }
    }

    if (!wallFound) break;
  }

  // When walls are 0, no more wall moves should be legal
  const movesAfter = getLegalWallMoves(board);
  if (board.turn === 0) {
    if (board.p1_walls === 0) {
      assertEqual(movesAfter.length, 0, 'No wall moves when walls depleted');
    }
  }

  console.log('✓ Test 14: Wall count limit');
}

// Test 15: Straight jump over adjacent opponent
function testStraightJump() {
  const board: QState = { ...initBoard(), p1_row: 3, p1_col: 4, p2_row: 4, p2_col: 4 };
  const moves = getLegalPawnMoves(board);

  assert(moves.includes(5), 'SS jump (action 5) is legal over opponent');
  assert(!moves.includes(1), 'S (action 1) into opponent is not legal');
  assert(!moves.includes(10) && !moves.includes(11), 'No diagonals when straight jump is open');
  assert(moves.includes(0) && moves.includes(2) && moves.includes(3), 'N, E, W still legal');
  assertEqual(moves.length, 4, 'Exactly 4 pawn moves: N, E, W, SS');

  const after = applyMove(board, 5);
  assertEqual(after.p1_row, 5, 'P1 lands two rows down after jump');
  assertEqual(after.p1_col, 4, 'P1 column unchanged after jump');
  console.log('✓ Test 15: Straight jump over adjacent opponent');
}

// Test 16: Diagonal jump when straight jump blocked by wall
function testDiagonalJumpWall() {
  // H-wall anchored at (4,4) blocks (4,4)-(5,4) and (4,5)-(5,5)
  const board: QState = {
    ...initBoard(),
    p1_row: 3, p1_col: 4, p2_row: 4, p2_col: 4,
    h_walls: 1n << 36n,
  };
  const moves = getLegalPawnMoves(board);

  assert(!moves.includes(5), 'SS jump blocked by wall behind opponent');
  assert(moves.includes(10), 'SE diagonal (action 10) legal');
  assert(moves.includes(11), 'SW diagonal (action 11) legal');

  const se = applyMove(board, 10);
  assertEqual(se.p1_row, 4, 'SE lands on opponent row');
  assertEqual(se.p1_col, 5, 'SE lands one column right');
  const sw = applyMove(board, 11);
  assertEqual(sw.p1_col, 3, 'SW lands one column left');
  console.log('✓ Test 16: Diagonal jump when straight jump blocked by wall');
}

// Test 17: Diagonal jump when straight jump blocked by board edge
function testDiagonalJumpEdge() {
  const board: QState = { ...initBoard(), p1_row: 7, p1_col: 4, p2_row: 8, p2_col: 4 };
  const moves = getLegalPawnMoves(board);

  assert(!moves.includes(5), 'SS jump off board is not legal');
  assert(moves.includes(10) && moves.includes(11), 'SE and SW diagonals legal at edge');

  // V-wall anchored at (7,4) blocks (7,4)-(7,5) and (8,4)-(8,5), so SE is removed but SW remains
  const walled: QState = { ...board, v_walls: 1n << BigInt(7 * 8 + 4) };
  const m2 = getLegalPawnMoves(walled);
  assert(!m2.includes(10), 'SE blocked by V-wall covering bottom row');
  assert(m2.includes(11), 'SW still legal with V-wall on the right');
  console.log('✓ Test 17: Diagonal jump when straight jump blocked by board edge');
}

// Test 18: Anchor-column-7 H-wall blocks column 8 without aliasing into the next row
function testEdgeWallNoAliasing() {
  // H-wall at anchor (3,7) blocks (3,7)-(4,7) and (3,8)-(4,8)
  const board: QState = { ...initBoard(), p1_row: 3, p1_col: 8, h_walls: 1n << BigInt(3 * 8 + 7) };
  const moves = getLegalPawnMoves(board);
  assert(!moves.includes(1), 'S from (3,8) blocked by H-wall anchored at (3,7)');

  // H-wall at anchor (4,0) must NOT block (3,8)-(4,8)
  const other: QState = { ...initBoard(), p1_row: 3, p1_col: 8, h_walls: 1n << BigInt(4 * 8 + 0) };
  assert(getLegalPawnMoves(other).includes(1), 'S from (3,8) not affected by wall at (4,0)');
  console.log('✓ Test 18: Edge wall blocks column 8 without aliasing');
}

// Run all tests
export function runAllTests() {
  console.log('\n=== Running Phase 1 Board Tests ===\n');

  testInitBoard();
  testInitialMoveCount();
  testPawnMoveDecode();
  testWallActionEncode();
  testSimplePawnMove();
  testWallPlacement();
  testWinnerDetection();
  testWallOverlapPrevention();
  testMoveSequence();
  testWallBlocking();
  testWallPathValidation();
  testMoveCountAfterWalls();
  testOutOfBoundsPrevention();
  testWallCountLimit();
  testStraightJump();
  testDiagonalJumpWall();
  testDiagonalJumpEdge();
  testEdgeWallNoAliasing();

  console.log('\n✅ All Phase 1 tests passed!\n');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    runAllTests();
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}
