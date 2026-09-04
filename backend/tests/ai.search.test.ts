import { initBoard, applyMove, getMoves, getWinner } from '../src/ai/board.js';
import { getBestMove } from '../src/ai/search.js';
import { getDistance } from '../src/ai/pathfind.js';
import { DifficultyLevel, QState } from '../src/ai/types.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Deterministic RNG for random player
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

// Test 1: Returns a legal move on the initial board
function testReturnsLegalMove() {
  const board = initBoard();
  const legal = new Set(getMoves(board));
  for (const level of ['Easy', 'Normal', 'Hard'] as DifficultyLevel[]) {
    const move = getBestMove(board, level);
    assert(legal.has(move), `${level} returns a legal move (got ${move})`);
  }
  console.log('✓ Test 1: Returns legal move at all difficulties');
}

// Test 2: Takes an immediate win when available
function testTakesImmediateWin() {
  const board: QState = { ...initBoard(), p1_row: 7, p1_col: 2, p2_row: 3, p2_col: 6 };
  const move = getBestMove(board, 'Normal');
  const after = applyMove(board, move);
  assert(getWinner(after) === 1, `Normal takes the winning move (got action ${move})`);
  console.log('✓ Test 2: Takes immediate win');
}

// Test 3: Respects time limit (Hard within ~3x budget)
function testTimeLimit() {
  const board = initBoard();
  const start = Date.now();
  getBestMove(board, 'Hard');
  const elapsed = Date.now() - start;
  assert(elapsed < 6000, `Hard move computed in ${elapsed}ms (< 6000ms)`);
  console.log(`✓ Test 3: Time limit respected (Hard: ${elapsed}ms)`);
}

// Test 4: Normal beats random player
function playGame(aiLevel: DifficultyLevel, aiIsP1: boolean, rng: () => number): 0 | 1 | 2 {
  let state = initBoard();
  for (let ply = 0; ply < 300; ply++) {
    const winner = getWinner(state);
    if (winner !== 0) return winner;
    const aiTurn = (state.turn === 0) === aiIsP1;
    let move: number;
    if (aiTurn) {
      move = getBestMove(state, aiLevel);
    } else {
      const moves = getMoves(state);
      move = moves[Math.floor(rng() * moves.length)];
    }
    state = applyMove(state, move);
  }
  return 0;
}

function testNormalBeatsRandom() {
  const rng = makeRng(42);
  const games = 4;
  let wins = 0;
  for (let i = 0; i < games; i++) {
    const aiIsP1 = i % 2 === 0;
    const w = playGame('Normal', aiIsP1, rng);
    if ((w === 1 && aiIsP1) || (w === 2 && !aiIsP1)) wins++;
  }
  assert(wins === games, `Normal beats random ${wins}/${games}`);
  console.log(`✓ Test 4: Normal beats random player ${wins}/${games}`);
}

// Test 5: Move reduces own distance or increases opponent's
function testMoveIsPurposeful() {
  const board = initBoard();
  const move = getBestMove(board, 'Normal');
  const after = applyMove(board, move);
  const dMeBefore = getDistance(board, 0);
  const dMeAfter = getDistance(after, 0);
  const dOpBefore = getDistance(board, 1);
  const dOpAfter = getDistance(after, 1);
  assert(dMeAfter < dMeBefore || dOpAfter > dOpBefore, 'Opening move improves position');
  console.log(`✓ Test 5: Purposeful opening move (action ${move})`);
}

export function runAllTests() {
  console.log('\n=== Running Phase 4/5 Search Tests ===\n');
  testReturnsLegalMove();
  testTakesImmediateWin();
  testTimeLimit();
  testMoveIsPurposeful();
  testNormalBeatsRandom();
  console.log('\n✅ All search tests passed!\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    runAllTests();
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}
