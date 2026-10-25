/**
 * Runs selfplay matches in parallel worker processes and aggregates the result.
 *
 *   npm run gauntlet -- <A> <B> [games=40] [jobs=10] [seed=1]
 *
 * Each job plays an even number of games (colour-swapped pairs) with its own seed.
 * Keep jobs well below the core count: the engines are time-limited, so CPU
 * contention makes them weaker.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

interface JobResult { a: number; b: number; draws: number; aAvgMs: number; bAvgMs: number; aMaxMs: number; bMaxMs: number; aDepth: number; bDepth: number; }

function runJob(A: string, B: string, games: number, seed: number): Promise<JobResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(here, 'selfplay.js'), A, B, String(games), String(seed)]);
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`selfplay exited with ${code}`));
      const line = (name: string) => {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const m = out.match(new RegExp(`^${escaped}: (\\d+) wins .*?avg (\\d+)ms/move\\s+max (\\d+)ms(?:\\s+avg depth ([\\d.]+))?`, 'm'));
        if (!m) throw new Error(`could not parse selfplay output:\n${out}`);
        return { wins: +m[1], avg: +m[2], max: +m[3], depth: m[4] ? +m[4] : 0 };
      };
      const a = line(A);
      const b = line(B);
      const draws = +(out.match(/^draws .*?: (\d+)/m)?.[1] ?? 0);
      resolve({ a: a.wins, b: b.wins, draws, aAvgMs: a.avg, bAvgMs: b.avg, aMaxMs: a.max, bMaxMs: b.max, aDepth: a.depth, bDepth: b.depth });
    });
  });
}

async function main() {
  const [A, B, gamesArg, jobsArg, seedArg] = process.argv.slice(2);
  if (!A || !B) throw new Error('usage: gauntlet <A> <B> [games] [jobs] [seed]');
  if (A === B) throw new Error('A and B must differ (selfplay output is keyed by name)');
  const games = parseInt(gamesArg ?? '40', 10);
  const jobs = parseInt(jobsArg ?? '10', 10);
  const seed = parseInt(seedArg ?? '1', 10);
  const pairs = Math.ceil(games / 2);
  const perJob = Array.from({ length: jobs }, (_, i) => Math.floor(pairs / jobs) + (i < pairs % jobs ? 1 : 0)).filter((p) => p > 0);

  const started = Date.now();
  const results = await Promise.all(perJob.map((p, i) => runJob(A, B, p * 2, seed * 1000 + i)));
  const sum = (f: (r: JobResult) => number) => results.reduce((acc, r) => acc + f(r), 0);
  const total = sum((r) => r.a + r.b + r.draws);
  const mean = (f: (r: JobResult) => number) => (sum(f) / results.length).toFixed(1);
  const aWins = sum((r) => r.a);
  const pct = (100 * aWins) / total;

  console.log(`\n=== ${A} vs ${B}: ${total} games in ${((Date.now() - started) / 1000).toFixed(0)}s ===`);
  console.log(`${A}: ${aWins} wins (${pct.toFixed(1)}%)  avg ${mean((r) => r.aAvgMs)}ms  max ${Math.max(...results.map((r) => r.aMaxMs))}ms  depth ${mean((r) => r.aDepth)}`);
  console.log(`${B}: ${sum((r) => r.b)} wins (${(100 - pct).toFixed(1)}%)  avg ${mean((r) => r.bAvgMs)}ms  max ${Math.max(...results.map((r) => r.bMaxMs))}ms  depth ${mean((r) => r.bDepth)}`);
  const draws = sum((r) => r.draws);
  if (draws) console.log(`draws: ${draws}`);
  console.log();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
