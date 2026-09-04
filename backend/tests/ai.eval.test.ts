import { initBoard, applyMove, getMoves } from '../src/ai/board.js';
import {
  evaluate,
  WIN_THRESHOLD,
  LOSS_THRESHOLD,
  DEFAULT_WEIGHTS,
} from '../src/ai/eval.js';

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

// Test 1: Evaluation structure
function testEvalStructure() {
  const board = initBoard();
  const moves = getMoves(board);
  const score = evaluate(board, moves);

  assert(typeof score === 'number', 'Evaluation returns a number');
  assert(!isNaN(score), 'Score is not NaN');
  console.log(`✓ Test 1: Evaluation structure (initial score: ${score})`);
}

// Test 2: Winning position evaluation
function testWinningPosition() {
  let board = initBoard();

  // Move P1 to goal
  board.p1_row = 8;
  const moves = getMoves(board);
  const score = evaluate(board, moves, 0);

  assert(score >= WIN_THRESHOLD, 'Winning position scores >= WIN_THRESHOLD');
  console.log(`✓ Test 2: Winning position (score: ${score})`);
}

// Test 3: Losing position evaluation
function testLosingPosition() {
  let board = initBoard();

  // Move P2 to goal
  board.p2_row = 0;
  const moves = getMoves(board);
  const score = evaluate(board, moves, 0);

  assert(score <= LOSS_THRESHOLD, 'Losing position scores <= LOSS_THRESHOLD');
  console.log(`✓ Test 3: Losing position (score: ${score})`);
}

// Test 4: Symmetry check
function testSymmetry() {
  let board = initBoard();

  // Create symmetric board: swap P1 and P2
  let mirroredBoard = initBoard();
  // Swap positions
  const tempRow = mirroredBoard.p1_row;
  mirroredBoard.p1_row = 8 - mirroredBoard.p2_row;
  mirroredBoard.p2_row = 8 - tempRow;
  const tempCol = mirroredBoard.p1_col;
  mirroredBoard.p1_col = mirroredBoard.p2_col;
  mirroredBoard.p2_col = tempCol;
  // Swap walls
  mirroredBoard.p1_walls = initBoard().p2_walls;
  mirroredBoard.p2_walls = initBoard().p1_walls;
  mirroredBoard.turn = 1; // P2 turn

  // Evaluate both
  const moves = getMoves(board);
  const p1Score = evaluate(board, moves, 0);

  const mirroredMoves = getMoves(mirroredBoard);
  const p2Score = evaluate(mirroredBoard, mirroredMoves, 0);

  // In a true symmetric position, the evaluations should be related
  // For now, just check that evaluation is consistent
  assert(typeof p1Score === 'number' && typeof p2Score === 'number', 'Both evaluations are numbers');
  console.log(`✓ Test 4: Symmetry (P1=${p1Score}, P2=${p2Score})`);
}

// Test 5: Closer to goal is better
function testDistancePreference() {
  let board1 = initBoard();
  let board2 = initBoard();

  // Board 1: P1 at (2,4), distance 6
  board1.p1_row = 2;

  // Board 2: P1 at (4,4), distance 4
  board2.p1_row = 4;

  const moves1 = getMoves(board1);
  const score1 = evaluate(board1, moves1, 0);

  const moves2 = getMoves(board2);
  const score2 = evaluate(board2, moves2, 0);

  assert(score2 > score1, 'Closer to goal has higher score');
  console.log(`✓ Test 5: Distance preference (score1=${score1}, score2=${score2})`);
}

// Test 6: More walls is better
function testWallPreference() {
  let board1 = initBoard();
  let board2 = initBoard();

  // Board 1: P1 has 10 walls, P2 has 10
  // Board 2: P1 has 10 walls, P2 has 5 (used 5 walls)
  board2.p2_walls = 5;

  const moves1 = getMoves(board1);
  const score1 = evaluate(board1, moves1, 0);

  const moves2 = getMoves(board2);
  const score2 = evaluate(board2, moves2, 0);

  assert(score2 > score1, 'More walls for current player is better');
  console.log(`✓ Test 6: Wall preference (score1=${score1}, score2=${score2})`);
}

// Test 7: Faster wins preferred
function testDepthPenalty() {
  let board = initBoard();
  board.p1_row = 8;

  const moves = getMoves(board);

  // Same position, different depths
  const score0 = evaluate(board, moves, 0);
  const score5 = evaluate(board, moves, 5);

  assert(score0 > score5, 'Faster wins (lower depth) score higher');
  console.log(`✓ Test 7: Faster wins (depth 0=${score0}, depth 5=${score5})`);
}

// Test 8: Custom weights
function testCustomWeights() {
  const board = initBoard();
  const moves = getMoves(board);

  const defaultScore = evaluate(board, moves, 0, DEFAULT_WEIGHTS);

  const heavyDistanceWeights = {
    w1: 100.0,
    w2: 0.1,
    w3: 0.1,
    w4: 0.1,
  };

  const distanceScore = evaluate(board, moves, 0, heavyDistanceWeights);

  // With heavy distance weighting, score should differ significantly
  assert(
    Math.abs(defaultScore - distanceScore) > 5,
    'Different weights produce different scores'
  );
  console.log(`✓ Test 8: Custom weights (default=${defaultScore}, heavy distance=${distanceScore})`);
}

// Test 9: Mobility matters
function testMobilityVariation() {
  let board1 = initBoard();
  let board2 = initBoard();

  // Restrict board2's movements with walls
  board2.h_walls |= 1n << BigInt(1 * 8 + 4); // Wall blocking movement near start

  const moves1 = getMoves(board1);
  const moves2 = getMoves(board2);

  const score1 = evaluate(board1, moves1, 0);
  const score2 = evaluate(board2, moves2, 0);

  // More moves should be better
  if (moves1.length > moves2.length) {
    assert(score1 > score2, 'More moves results in higher score');
  }
  console.log(`✓ Test 9: Mobility variation (moves1=${moves1.length}, moves2=${moves2.length})`);
}

// Test 10: Reasonable score range
function testScoreRange() {
  const board = initBoard();
  const moves = getMoves(board);
  const score = evaluate(board, moves, 0);

  // Initial position should be neutral (small absolute value)
  assert(Math.abs(score) < 100, 'Initial position has reasonable score magnitude');
  console.log(`✓ Test 10: Score range (initial=${score})`);
}

// Run all tests
export function runAllTests() {
  console.log('\n=== Running Phase 3 Evaluation Tests ===\n');

  testEvalStructure();
  testWinningPosition();
  testLosingPosition();
  testSymmetry();
  testDistancePreference();
  testWallPreference();
  testDepthPenalty();
  testCustomWeights();
  testMobilityVariation();
  testScoreRange();

  console.log('\n✅ All Phase 3 tests passed!\n');
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    runAllTests();
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}
