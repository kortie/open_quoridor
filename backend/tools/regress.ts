/**
 * Compares the current engine against the frozen baseline at a fixed depth on a
 * set of reproducible positions, and reports search speed.
 *
 * Move agreement was the acceptance check for the pure speed-up (P1). Since the
 * search and evaluation changed on purpose, it is informational only.
 *
 *   npm run regress -- [depth=3] [positions=20] [seed=7]
 */
import { initBoard, applyMove, getMoves, getWinner } from '../src/ai/board.js';
import { searchBestMove } from '../src/ai/search.js';
import { getBestMove as baselineBestMove } from './baseline_ai/search.js';
import { QState } from '../src/ai/types.js';

function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

/** Positions reached by a few random plies followed by baseline Normal play. */
function positions(count: number, rng: () => number): QState[] {
  const out: QState[] = [];
  while (out.length < count) {
    let s = initBoard();
    const randomPlies = 2 + Math.floor(rng() * 4);
    const totalPlies = randomPlies + Math.floor(rng() * 30);
    for (let ply = 0; ply < totalPlies && getWinner(s) === 0; ply++) {
      const moves = getMoves(s);
      const move = ply < randomPlies ? moves[Math.floor(rng() * moves.length)] : baselineBestMove(s, 'Normal');
      s = applyMove(s, move);
    }
    if (getWinner(s) === 0) out.push(s);
  }
  return out;
}

function main() {
  const [depthArg, countArg, seedArg] = process.argv.slice(2);
  const depth = parseInt(depthArg ?? '3', 10);
  const count = parseInt(countArg ?? '20', 10);
  const rng = makeRng(parseInt(seedArg ?? '7', 10));
  const fixed = { maxDepth: depth, timeLimit: 1e9, allowRandomization: false };

  let same = 0;
  let baseMs = 0;
  let newMs = 0;
  const diffs: string[] = [];
  const set = positions(count, rng);

  set.forEach((s, i) => {
    let t = Date.now();
    const a = baselineBestMove(s, 'Hard', fixed);
    baseMs += Date.now() - t;
    t = Date.now();
    const b = searchBestMove(s, 'VeryHard', fixed).move;
    newMs += Date.now() - t;
    if (a === b) same++;
    else diffs.push(`#${i} baseline=${a} new=${b} state=${JSON.stringify(s, (_, v) => (typeof v === 'bigint' ? v.toString() : v))}`);
  });

  console.log(`\nFixed depth ${depth}: ${same}/${set.length} positions give the same move as baseline`);
  console.log(`time: baseline ${baseMs}ms, new ${newMs}ms (x${(baseMs / Math.max(newMs, 1)).toFixed(1)})`);
  for (const d of diffs) console.log('  ' + d);

  const info = searchBestMove(initBoard(), 'VeryHard', { timeLimit: 2000, maxDepth: 64 });
  const nps = Math.round((info.nodes * 1000) / Math.max(info.elapsedMs, 1));
  console.log(`initial position, 2s: depth ${info.depth}, ${info.nodes} nodes, ${nps} nodes/s\n`);
}

main();
