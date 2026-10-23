/**
 * Engine-vs-engine matches.
 *
 *   npm run selfplay -- <A> <B> [games=20] [seed=1] [openingPlies=4]
 *
 * Players: Easy | Normal | Hard | VeryHard | Expert | Baseline | Random.
 * Baseline is the frozen pre-improvement engine (tools/baseline_ai) at Hard.
 * Games are played in pairs: both games of a pair share the same random opening
 * and swap colours, so deterministic engines still produce distinct games.
 */
import { initBoard, applyMove, getMoves, getWinner } from '../src/ai/board.js';
import { searchBestMove } from '../src/ai/search.js';
import { getBestMove as baselineBestMove } from './baseline_ai/search.js';
import { Action, DifficultyLevel, DIFFICULTY_LEVELS, QState } from '../src/ai/types.js';

type Player = DifficultyLevel | 'Baseline' | 'Random';
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

interface SideStats { moves: number; totalMs: number; maxMs: number; depthSum: number; searched: number; }
interface GameResult { winner: 0 | 1 | 2; plies: number; p1: SideStats; p2: SideStats; }

const newStats = (): SideStats => ({ moves: 0, totalMs: 0, maxMs: 0, depthSum: 0, searched: 0 });

function pickMove(state: QState, player: Player, rng: () => number, stats: SideStats): Action {
  if (player === 'Random') {
    const moves = getMoves(state);
    return moves[Math.floor(rng() * moves.length)];
  }
  if (player === 'Baseline') return baselineBestMove(state, 'Hard');
  const info = searchBestMove(state, player);
  stats.depthSum += info.depth;
  stats.searched++;
  return info.move;
}

/** Random but sensible opening: each ply picks one of the top 3 depth-1 moves. */
function makeOpening(plies: number, rng: () => number): Action[] {
  const moves: Action[] = [];
  let state = initBoard();
  for (let i = 0; i < plies; i++) {
    const root = searchBestMove(state, 'Normal', { maxDepth: 1, timeLimit: 1e9, allowRandomization: false }).root;
    const top = root.slice(0, Math.min(3, root.length));
    const move = top[Math.floor(rng() * top.length)].move;
    moves.push(move);
    state = applyMove(state, move);
  }
  return moves;
}

function playGame(p1: Player, p2: Player, opening: Action[], rng: () => number): GameResult {
  let state = initBoard();
  const stats: [SideStats, SideStats] = [newStats(), newStats()];

  for (let ply = 0; ply < PLY_CAP; ply++) {
    const winner = getWinner(state);
    if (winner !== 0) return { winner, plies: ply, p1: stats[0], p2: stats[1] };

    if (ply < opening.length) {
      state = applyMove(state, opening[ply]);
      continue;
    }

    const side = state.turn;
    const t = Date.now();
    const move = pickMove(state, side === 0 ? p1 : p2, rng, stats[side]);
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
  if ((DIFFICULTY_LEVELS as readonly string[]).includes(arg) || arg === 'Baseline' || arg === 'Random') {
    return arg as Player;
  }
  throw new Error(`Unknown player "${arg}" (expected ${DIFFICULTY_LEVELS.join('|')}|Baseline|Random)`);
}

function main() {
  const [aArg, bArg, gamesArg, seedArg, openArg] = process.argv.slice(2);
  const A = parsePlayer(aArg, 'Easy');
  const B = parsePlayer(bArg, 'Hard');
  const games = parseInt(gamesArg ?? '20', 10);
  const rng = makeRng(parseInt(seedArg ?? '1', 10));
  const openingPlies = parseInt(openArg ?? '4', 10);

  let aWins = 0, bWins = 0, draws = 0;
  const agg = { A: newStats(), B: newStats() };
  const started = Date.now();
  let opening: Action[] = [];

  console.log(`\nSelfplay: ${A} vs ${B}, ${games} games, ${openingPlies}-ply random openings (colours alternate)\n`);

  for (let g = 0; g < games; g++) {
    if (g % 2 === 0) opening = makeOpening(openingPlies, rng);
    const aIsP1 = g % 2 === 0;
    const r = aIsP1 ? playGame(A, B, opening, rng) : playGame(B, A, opening, rng);
    const aStats = aIsP1 ? r.p1 : r.p2;
    const bStats = aIsP1 ? r.p2 : r.p1;

    for (const [k, s] of [['A', aStats], ['B', bStats]] as const) {
      agg[k].moves += s.moves;
      agg[k].totalMs += s.totalMs;
      agg[k].depthSum += s.depthSum;
      agg[k].searched += s.searched;
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
  const depth = (s: SideStats) => (s.searched ? `  avg depth ${(s.depthSum / s.searched).toFixed(1)}` : '');

  console.log(`\n=== Result (${((Date.now() - started) / 1000).toFixed(1)}s) ===`);
  console.log(`${A}: ${aWins} wins (${pct(aWins)})   avg ${avg(agg.A)}ms/move   max ${agg.A.maxMs}ms${depth(agg.A)}`);
  console.log(`${B}: ${bWins} wins (${pct(bWins)})   avg ${avg(agg.B)}ms/move   max ${agg.B.maxMs}ms${depth(agg.B)}`);
  if (draws) console.log(`draws (ply cap ${PLY_CAP}): ${draws}`);
  console.log();
}

main();
