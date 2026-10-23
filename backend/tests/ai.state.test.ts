import { initBoard, applyMove, getMoves, getLegalPawnMoves, isWallLegal, getWinner } from '../src/ai/board.js';
import { getDistance, wallsPath } from '../src/ai/pathfind.js';
import { fromQState, applyAction, pawnMoves, wallLegal, recomputeHash, EState } from '../src/ai/state.js';
import { QState } from '../src/ai/types.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

/** Random walks over legal moves, yielding each (QState, EState) pair along the way. */
function* randomGames(games: number, seed: number): Generator<[QState, EState]> {
  const rng = makeRng(seed);
  for (let g = 0; g < games; g++) {
    let q = initBoard();
    let e = fromQState(q);
    for (let ply = 0; ply < 80 && getWinner(q) === 0; ply++) {
      yield [q, e];
      const moves = getMoves(q);
      // Bias towards walls so wall-heavy positions are covered.
      const walls = moves.filter((m) => m >= 12);
      const pool = walls.length > 0 && rng() < 0.5 ? walls : moves;
      const move = pool[Math.floor(rng() * pool.length)];
      q = applyMove(q, move);
      e = applyAction(e, move);
    }
  }
}

function testIncrementalHash() {
  let n = 0;
  for (const [q, e] of randomGames(20, 1)) {
    const [k0, k1] = recomputeHash(e);
    assert(k0 === e.k0 && k1 === e.k1, `incremental hash matches full hash (ply state ${JSON.stringify(e)})`);
    assert(fromQState(q).k0 === e.k0, 'hash of converted QState matches incremental hash');
    n++;
  }
  console.log(`✓ Test 1: Incremental Zobrist hash matches recomputation (${n} positions)`);
}

function testPawnMovesMatchBoard() {
  let n = 0;
  for (const [q, e] of randomGames(20, 2)) {
    const a = getLegalPawnMoves(q).join(',');
    const b = pawnMoves(e).join(',');
    assert(a === b, `pawn moves match board.ts (${a} vs ${b})`);
    n++;
  }
  console.log(`✓ Test 2: Pawn moves match board.ts (${n} positions)`);
}

function testWallLegalityMatchesBoard() {
  let n = 0;
  for (const [q, e] of randomGames(8, 3)) {
    const p0 = wallsPath(e.w, e.p0, 8, e.p1).cells;
    const p1 = wallsPath(e.w, e.p1, 0, e.p0).cells;
    for (let action = 12; action < 140; action++) {
      assert(isWallLegal(q, action) === wallLegal(e, action, p0, p1), `wall ${action} legality matches board.ts`);
      n++;
    }
  }
  console.log(`✓ Test 3: Wall legality matches board.ts (${n} checks)`);
}

function testDistancesMatch() {
  let n = 0;
  for (const [q, e] of randomGames(10, 4)) {
    assert(getDistance(q, 0) === wallsPath(e.w, e.p0, 8, e.p1).distance, 'P1 distance matches');
    assert(getDistance(q, 1) === wallsPath(e.w, e.p1, 0, e.p0).distance, 'P2 distance matches');
    n++;
  }
  console.log(`✓ Test 4: Distances match QState BFS (${n} positions)`);
}

export function runAllTests() {
  console.log('\n=== Running Engine State Tests ===\n');
  testIncrementalHash();
  testPawnMovesMatchBoard();
  testWallLegalityMatchesBoard();
  testDistancesMatch();
  console.log('\n✅ All engine state tests passed!\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    runAllTests();
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}
