import { initBoard, applyMove } from '../src/ai/board.js';
import { getDistance, canReachGoal, getPathDiversity, bfs } from '../src/ai/pathfind.js';

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

// Test 1: Initial distance on empty board
function testInitialDistance() {
  const board = initBoard();

  // P1 starts at (0,4), goal is row 8
  // Minimum distance is 8 (straight south)
  const p1Dist = getDistance(board, 0);
  assertEqual(p1Dist, 8, 'P1 distance to goal is 8');

  // P2 starts at (8,4), goal is row 0
  // Minimum distance is 8 (straight north)
  const p2Dist = getDistance(board, 1);
  assertEqual(p2Dist, 8, 'P2 distance to goal is 8');

  console.log('✓ Test 1: Initial distance on empty board');
}

// Test 2: Distance after pawn moves
function testDistanceAfterMove() {
  let board = initBoard();

  // P1 moves south to (1,4)
  board = applyMove(board, 1);
  const p1Dist = getDistance(board, 0);
  assertEqual(p1Dist, 7, 'P1 distance is 7 after moving south');

  // P2 moves north to (7,4)
  // P2 can now jump over P1 to reach (0,4) faster
  board = applyMove(board, 0);
  const p2Dist = getDistance(board, 1);
  // Distance is 6 because P2 can jump over P1: (7,4) -> (2,4) -> jump to (0,4) = 6 moves
  assertEqual(p2Dist, 6, 'P2 distance is 6 after moving north (can jump over P1)');

  console.log('✓ Test 2: Distance after pawn moves');
}

// Test 3: Can reach goal on empty board
function testCanReachGoalEmpty() {
  const board = initBoard();

  assert(canReachGoal(board, 0), 'P1 can reach goal on empty board');
  assert(canReachGoal(board, 1), 'P2 can reach goal on empty board');

  console.log('✓ Test 3: Can reach goal on empty board');
}

// Test 4: Wall doesn't block path with alternatives
function testWallWithAlternatives() {
  let board = initBoard();

  // Place a wall that doesn't block all paths
  // Place horizontal wall at (2, 3)
  const wallAction = 12 + 2 * 8 + 3; // H-wall at (2,3)
  board = applyMove(board, wallAction);
  board = applyMove(board, 0); // dummy P2 move

  const p1Dist = getDistance(board, 0);
  const p1Can = canReachGoal(board, 0);

  assert(p1Can, 'P1 can still reach goal with wall');
  assert(p1Dist !== Infinity, 'P1 distance is finite');

  console.log('✓ Test 4: Wall doesn\'t block path with alternatives');
}

// Test 5: Path diversity
function testPathDiversity() {
  const board = initBoard();

  const diversity = getPathDiversity(board, 0);
  assert(diversity > 0, 'Path diversity is positive');
  assert(diversity <= 9, 'Path diversity is at most board height');

  console.log('✓ Test 5: Path diversity');
}

// Test 6: Multiple walls don't block path
function testMultipleWallsWithPath() {
  let board = initBoard();

  // Place multiple walls but leave path open
  for (let i = 0; i < 3 && board.p1_walls > 0; i++) {
    const moves = [
      12 + 2 * 8 + 0, // wall at (2, 0)
      12 + 2 * 8 + 1, // wall at (2, 1)
      12 + 2 * 8 + 2, // wall at (2, 2)
    ];

    if (i < moves.length) {
      board = applyMove(board, moves[i]);
      board = applyMove(board, 0); // dummy move
    }
  }

  const p1Can = canReachGoal(board, 0);
  assert(p1Can, 'P1 can reach goal with multiple walls');

  console.log('✓ Test 6: Multiple walls don\'t block path');
}

// Test 7: Distance updates with wall placement
function testDistanceWithWall() {
  let board = initBoard();
  const initialDist = getDistance(board, 0);

  // Place a wall that may affect shortest path
  const wallAction = 12 + 3 * 8 + 4; // H-wall at (3,4)
  board = applyMove(board, wallAction);

  const afterWallDist = getDistance(board, 0);
  // Wall might increase distance or keep it same (if there are alternative paths)
  assert(afterWallDist >= initialDist - 1, 'Distance doesn\'t decrease unreasonably');
  assert(afterWallDist <= initialDist + 2, 'Distance doesn\'t increase too much');

  console.log('✓ Test 7: Distance updates with wall placement');
}

// Test 8: BFS result structure
function testBFSResult() {
  const board = initBoard();
  const startPos = { row: 0, col: 4 };
  const opponentPos = { row: 8, col: 4 };

  const result = bfs(startPos, 8, board.h_walls, board.v_walls, opponentPos);

  assert(result.distance === 8, 'BFS returns correct distance');
  assert(result.pathCells.size > 0, 'BFS returns path cells');
  assert(result.pathCells.has('0,4'), 'Start position is in path');

  console.log('✓ Test 8: BFS result structure');
}

// Test 9: Path distance is consistent
function testPathConsistency() {
  let board = initBoard();

  // Make a few moves
  board = applyMove(board, 1); // P1 south
  board = applyMove(board, 0); // P2 north

  const p1Dist = getDistance(board, 0);
  const p1Can = canReachGoal(board, 0);

  const p2Dist = getDistance(board, 1);
  const p2Can = canReachGoal(board, 1);

  // If distance is finite, player can reach goal
  assert((p1Dist === Infinity) === !p1Can, 'P1 distance and reachability consistent');
  assert((p2Dist === Infinity) === !p2Can, 'P2 distance and reachability consistent');

  console.log('✓ Test 9: Path distance is consistent');
}

// Test 10: Distance decreases as player moves toward goal
function testDistanceDecreasing() {
  let board = initBoard();
  const initialDist = getDistance(board, 0);

  // Move south toward goal (just one move)
  board = applyMove(board, 1); // P1 south
  const p1AfterMove = getDistance(board, 0);

  // After P1 moves, P2 has a turn, but we measure P1 distance at P1's position
  // P1 went from (0,4) to (1,4), distance should decrease by 1
  assert(
    p1AfterMove < initialDist,
    `Distance decreased (was ${initialDist}, now ${p1AfterMove})`
  );

  console.log('✓ Test 10: Distance decreases as player moves toward goal');
}

// Run all tests
export function runAllTests() {
  console.log('\n=== Running Phase 2 Pathfinding Tests ===\n');

  testInitialDistance();
  testDistanceAfterMove();
  testCanReachGoalEmpty();
  testWallWithAlternatives();
  testPathDiversity();
  testMultipleWallsWithPath();
  testDistanceWithWall();
  testBFSResult();
  testPathConsistency();
  testDistanceDecreasing();

  console.log('\n✅ All Phase 2 tests passed!\n');
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
