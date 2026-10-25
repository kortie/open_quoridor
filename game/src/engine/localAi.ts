/**
 * On-device AI for the offline build. The search runs in a Web Worker so the board
 * stays responsive during Expert's multi-second searches; if the worker fails or
 * overruns, a shallow search on the main thread stands in (same policy as the
 * server's aiService).
 */
import { searchBestMove } from '@engine/search';
import { getDifficultyConfig } from '@engine/config';
import { toQState, toMove, fallbackMove, mapDifficulty, AIDecisionRequest } from '@engine/adapter';
import type { Move } from '../types';
import type { WorkerRequest, WorkerResponse } from './aiWorker';

const TIMEOUT_SLACK_MS = 1500;

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (move: number | null) => void>();

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./aiWorker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const resolve = pending.get(e.data.id);
    pending.delete(e.data.id);
    resolve?.(e.data.move);
  };
  w.onerror = (err) => {
    console.error('AI worker error:', err);
    resetWorker();
  };
  worker = w;
  return w;
}

function resetWorker(): void {
  worker?.terminate();
  worker = null;
  for (const resolve of pending.values()) resolve(null);
  pending.clear();
}

function searchInWorker(req: WorkerRequest['state'], level: WorkerRequest['level']): Promise<number | null> {
  return new Promise((resolve) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      console.error('AI worker timed out; restarting it');
      resetWorker();
    }, getDifficultyConfig(level).timeLimit + TIMEOUT_SLACK_MS);
    pending.set(id, (move) => {
      clearTimeout(timer);
      resolve(move);
    });
    const msg: WorkerRequest = { id, state: req, level };
    getWorker().postMessage(msg);
  });
}

export async function getLocalAIMove(req: AIDecisionRequest): Promise<Move | null> {
  try {
    const state = toQState(req);
    const level = mapDifficulty(req.aiLevel);
    let action = await searchInWorker(state, level);
    if (action === null) {
      action = searchBestMove(state, 'Normal', { maxDepth: 2, timeLimit: 200, allowRandomization: false }).move;
    }
    return (toMove(action, req) ?? fallbackMove(req)) as Move | null;
  } catch (error) {
    console.error('Local AI error:', error);
    return fallbackMove(req) as Move | null;
  }
}
