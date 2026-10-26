import { initBoard, applyMove, getMoves, getWinner } from '../src/ai/board.js';
import { getBestMove, searchBestMove } from '../src/ai/search.js';
import { getDistance } from '../src/ai/pathfind.js';
import { KNOWN_WIN } from '../src/ai/eval.js';
import { getDifficultyConfig } from '../src/ai/config.js';
import { DifficultyLevel, DIFFICULTY_LEVELS, QState } from '../src/ai/types.js';

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
  for (const level of DIFFICULTY_LEVELS) {
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
  // Noise is part of Normal's design; this checks the engine's judgement underneath it.
  const move = searchBestMove(board, 'Normal', { allowRandomization: false }).move;
  const after = applyMove(board, move);
  const dMeBefore = getDistance(board, 0);
  const dMeAfter = getDistance(after, 0);
  const dOpBefore = getDistance(board, 1);
  const dOpAfter = getDistance(after, 1);
  assert(dMeAfter < dMeBefore || dOpAfter > dOpBefore, 'Opening move improves position');
  console.log(`✓ Test 5: Purposeful opening move (action ${move})`);
}

// Test 6: Must wall when the opponent is one step from goal and we are far behind
function testBlocksImminentLoss() {
  // P1 needs one step; P2 (to move) needs four.
  const board: QState = { ...initBoard(), p1_row: 7, p1_col: 4, p2_row: 4, p2_col: 4, turn: 1 };
  for (const level of ['Hard', 'VeryHard'] as DifficultyLevel[]) {
    const move = searchBestMove(board, level, { allowRandomization: false, timeLimit: 500 }).move;
    const after = applyMove(board, move);
    assert(move >= 12, `${level} places a wall (got action ${move})`);
    assert(getDistance(after, 0) > 1, `${level}'s wall lengthens the opponent's path`);
  }
  console.log('✓ Test 6: Walls off an imminent loss');
}

// Test 7: Pure race with no walls left: just run
function testRacesWithoutWalls() {
  const board: QState = { ...initBoard(), p1_row: 3, p1_col: 0, p2_row: 5, p2_col: 8, p1_walls: 0, p2_walls: 0 };
  const info = searchBestMove(board, 'VeryHard', { allowRandomization: false, timeLimit: 500 });
  const after = applyMove(board, info.move);
  assert(getDistance(after, 0) < getDistance(board, 0), `advances in a won race (got action ${info.move})`);
  assert(info.root[0].score > 0, `won race scores positive (${info.root[0].score})`);
  console.log(`✓ Test 7: Races when walls are gone (score ${info.root[0].score})`);
}

// Test 8: Recognises a decided race when only the opponent is out of walls
function testKnownWin() {
  const board: QState = { ...initBoard(), p1_row: 5, p1_col: 4, p2_row: 6, p2_col: 0, p1_walls: 3, p2_walls: 0 };
  const info = searchBestMove(board, 'VeryHard', { allowRandomization: false, timeLimit: 500 });
  assert(info.root[0].score >= KNOWN_WIN - 1000, `decided race is scored as a win (${info.root[0].score})`);
  console.log(`✓ Test 8: Recognises decided race (score ${info.root[0].score})`);
}

// Test 9: Strong levels do not burn walls in the opening
function testNoEarlyWallSpam() {
  let state = initBoard();
  for (let ply = 0; ply < 6; ply++) {
    state = applyMove(state, searchBestMove(state, 'VeryHard', { allowRandomization: false, timeLimit: 300 }).move);
  }
  const used = 20 - state.p1_walls - state.p2_walls;
  assert(used <= 1, `at most one wall in the first 6 plies (used ${used})`);
  console.log(`✓ Test 9: Opening keeps walls (${used} used in 6 plies)`);
}

// Test 10: Every level stays within its time limit
function testLevelTimeLimits() {
  // A mid-game position with walls on the board, where wall generation is busiest.
  let state = initBoard();
  for (const m of [1, 0, 1, 0, 12 + 4 * 8 + 3, 12 + 3 * 8 + 4, 1, 0]) state = applyMove(state, m);
  for (const level of DIFFICULTY_LEVELS) {
    const limit = getDifficultyConfig(level).timeLimit;
    const start = Date.now();
    searchBestMove(state, level);
    const elapsed = Date.now() - start;
    assert(elapsed <= limit + 150, `${level} took ${elapsed}ms (limit ${limit}ms)`);
  }
  console.log('✓ Test 10: All levels within their time limits');
}

export function runAllTests() {
  console.log('\n=== Running Phase 4/5 Search Tests ===\n');
  testReturnsLegalMove();
  testTakesImmediateWin();
  testTimeLimit();
  testMoveIsPurposeful();
  testNormalBeatsRandom();
  testBlocksImminentLoss();
  testRacesWithoutWalls();
  testKnownWin();
  testNoEarlyWallSpam();
  testLevelTimeLimits();
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
