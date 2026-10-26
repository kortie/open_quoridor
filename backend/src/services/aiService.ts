import { Worker } from 'node:worker_threads';
import * as AI from '../ai/index.js';
import { searchBestMove } from '../ai/search.js';
import { AIDecisionRequest, ClientMove, toQState, toMove, fallbackMove, mapDifficulty } from '../ai/adapter.js';
import type { WorkerRequest, WorkerResponse } from './aiWorker.js';

// --- Search worker ----------------------------------------------------------------
// The search is CPU-bound for up to a few seconds; running it on the main thread would
// stall every other request. One worker handles requests in order. Under `tsx` (dev)
// the worker script is TypeScript and cannot be spawned directly, so search inline.

const WORKER_URL = new URL('./aiWorker.js', import.meta.url);
const USE_WORKER = import.meta.url.endsWith('.js');
const HARD_TIMEOUT_SLACK_MS = 500;

interface Pending {
  resolve: (action: AI.Action | null) => void;
  timer: NodeJS.Timeout;
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(WORKER_URL);
  w.on('message', (res: WorkerResponse) => {
    const p = pending.get(res.id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(res.id);
    p.resolve(res.move);
  });
  w.on('error', (err) => {
    console.error('AI worker error:', err);
    resetWorker();
  });
  w.on('exit', () => {
    if (worker === w) resetWorker();
  });
  worker = w;
  return w;
}

/** Drop the worker and fail everything queued on it; callers fall back. */
function resetWorker(): void {
  const w = worker;
  worker = null;
  for (const [id, p] of pending) {
    clearTimeout(p.timer);
    p.resolve(null);
    pending.delete(id);
  }
  if (w) void w.terminate();
}

function searchInWorker(state: AI.QState, level: AI.DifficultyLevel): Promise<AI.Action | null> {
  let timeLimit = AI.getDifficultyConfig(level).timeLimit;
  // Requests queue behind each other; shorten long searches when others are waiting.
  if (pending.size >= 2 && timeLimit > 1000) {
    timeLimit = Math.round(timeLimit / 2);
    console.warn(`AI queue length ${pending.size}: ${level} search shortened to ${timeLimit}ms`);
  }
  const queuedBudget = pending.size * 3000;

  return new Promise((resolve) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      console.error(`AI worker timed out on request ${id}; restarting it`);
      resetWorker();
    }, timeLimit + HARD_TIMEOUT_SLACK_MS + queuedBudget);
    pending.set(id, { resolve, timer });
    const req: WorkerRequest = { id, state, level, timeLimit };
    getWorker().postMessage(req);
  });
}

/** Quick shallow search on the main thread, used when the worker fails. */
function quickSearch(state: AI.QState): AI.Action {
  return searchBestMove(state, 'Normal', { maxDepth: 2, timeLimit: 200, allowRandomization: false }).move;
}

export async function getAIMove(req: AIDecisionRequest): Promise<ClientMove | null> {
  try {
    const state = toQState(req);
    const level = mapDifficulty(req.aiLevel);
    let action = USE_WORKER ? await searchInWorker(state, level) : AI.getBestMove(state, level);
    if (action === null) action = quickSearch(state);
    return toMove(action, req) ?? fallbackMove(req);
  } catch (error) {
    console.error('AI move error:', error);
    return fallbackMove(req);
  }
}
