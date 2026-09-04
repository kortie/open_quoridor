import { initBoard, applyMove, getMoves, getWinner } from '../src/ai/board.js';
import { getBestMove } from '../src/ai/search.js';
import { DifficultyLevel, QState } from '../src/ai/types.js';

type Player = DifficultyLevel | 'Random';
const PLY_CAP = 300;

function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
}

function pickMove(state: QState, player: Player, rng: () => number): number {
  if (player === 'Random') {
    const moves = getMoves(state);
    return moves[Math.floor(rng() * moves.length)];
  }
  return getBestMove(state, player);
}

interface SideStats { moves: number; totalMs: number; maxMs: number; }
interface GameResult { winner: 0 | 1 | 2; plies: number; p1: SideStats; p2: SideStats; }

function playGame(p1: Player, p2: Player, rng: () => number): GameResult {
  let state = initBoard();
  const stats: [SideStats, SideStats] = [
    { moves: 0, totalMs: 0, maxMs: 0 },
    { moves: 0, totalMs: 0, maxMs: 0 },
  ];

  for (let ply = 0; ply < PLY_CAP; ply++) {
    const winner = getWinner(state);
    if (winner !== 0) return { winner, plies: ply, p1: stats[0], p2: stats[1] };

    const side = state.turn;
    const t = Date.now();
    const move = pickMove(state, side === 0 ? p1 : p2, rng);
    const dt = Date.now() - t;
    stats[side].moves++;
    stats[side].totalMs += dt;
    if (dt > stats[side].maxMs) stats[side].maxMs = dt;

    state = applyMove(state, move);
  }
  return { winner: getWinner(state), plies: PLY_CAP, p1: stats[0], p2: stats[1] };
}

function parsePlayer(arg: string | undefined, fallback: Player): Player {
  if (!arg) return fallback;
  if (arg === 'Easy' || arg === 'Normal' || arg === 'Hard' || arg === 'Random') return arg;
  throw new Error(`Unknown player "${arg}" (expected Easy|Normal|Hard|Random)`);
}

function main() {
  const [aArg, bArg, gamesArg, seedArg] = process.argv.slice(2);
  const A = parsePlayer(aArg, 'Easy');
  const B = parsePlayer(bArg, 'Hard');
  const games = parseInt(gamesArg ?? '20', 10);
  const rng = makeRng(parseInt(seedArg ?? '1', 10));

  let aWins = 0, bWins = 0, draws = 0;
  const agg = { A: { moves: 0, totalMs: 0, maxMs: 0 }, B: { moves: 0, totalMs: 0, maxMs: 0 } };
  const started = Date.now();

  console.log(`\nSelfplay: ${A} vs ${B}, ${games} games (colors alternate)\n`);

  for (let g = 0; g < games; g++) {
    const aIsP1 = g % 2 === 0;
    const r = aIsP1 ? playGame(A, B, rng) : playGame(B, A, rng);
    const aStats = aIsP1 ? r.p1 : r.p2;
    const bStats = aIsP1 ? r.p2 : r.p1;

    for (const [k, s] of [['A', aStats], ['B', bStats]] as const) {
      agg[k].moves += s.moves;
      agg[k].totalMs += s.totalMs;
      if (s.maxMs > agg[k].maxMs) agg[k].maxMs = s.maxMs;
    }

    const aWon = (r.winner === 1 && aIsP1) || (r.winner === 2 && !aIsP1);
    const bWon = r.winner !== 0 && !aWon;
    if (aWon) aWins++; else if (bWon) bWins++; else draws++;

    console.log(
      `game ${String(g + 1).padStart(3)}  ${A} as ${aIsP1 ? 'P1' : 'P2'}  ` +
      `winner=${aWon ? A : bWon ? B : 'draw'}  plies=${r.plies}`
    );
  }

  const pct = (n: number) => ((100 * n) / games).toFixed(1) + '%';
  const avg = (s: SideStats) => (s.moves ? (s.totalMs / s.moves).toFixed(0) : '0');

  console.log(`\n=== Result (${((Date.now() - started) / 1000).toFixed(1)}s) ===`);
  console.log(`${A}: ${aWins} wins (${pct(aWins)})   avg ${avg(agg.A)}ms/move   max ${agg.A.maxMs}ms`);
  console.log(`${B}: ${bWins} wins (${pct(bWins)})   avg ${avg(agg.B)}ms/move   max ${agg.B.maxMs}ms`);
  if (draws) console.log(`draws (ply cap ${PLY_CAP}): ${draws}`);
  console.log();
}

main();
