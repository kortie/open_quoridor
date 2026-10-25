import { Worker } from 'node:worker_threads';
import * as AI from '../ai/index.js';
import { searchBestMove } from '../ai/search.js';
import type { WorkerRequest, WorkerResponse } from './aiWorker.js';

interface Position {
  row: number;
  col: number;
}

interface Wall {
  row: number;
  col: number;
  direction: 'horizontal' | 'vertical';
  placedBy: 'player' | 'ai';
}

interface Move {
  type: 'move' | 'placeWall';
  from?: Position;
  to?: Position;
  wall?: Wall;
  player: 'player' | 'ai';
  timestamp: number;
}

interface AIDecisionRequest {
  aiLevel: 'Easy' | 'Normal' | 'Hard' | 'VeryHard' | 'Expert';
  aiPos: Position;
  playerPos: Position;
  aiWallsLeft: number;
  playerWallsLeft: number;
  validMoves: Position[];
  validWalls: Wall[];
  walls?: Wall[];
}

// Frontend: player starts at row 0 (goal row 8) = engine P1; AI starts at row 8 (goal row 0) = engine P2.
function toQState(req: AIDecisionRequest): AI.QState {
  let h_walls = 0n;
  let v_walls = 0n;
  for (const w of req.walls ?? []) {
    if (w.row < 0 || w.row > 7 || w.col < 0 || w.col > 7) continue;
    const bit = 1n << BigInt(w.row * 8 + w.col);
    if (w.direction === 'horizontal') h_walls |= bit;
    else v_walls |= bit;
  }

  return {
    p1_row: req.playerPos.row,
    p1_col: req.playerPos.col,
    p2_row: req.aiPos.row,
    p2_col: req.aiPos.col,
    p1_walls: req.playerWallsLeft,
    p2_walls: req.aiWallsLeft,
    h_walls,
    v_walls,
    turn: 1,
  };
}

/** Decode an engine action, accepting it only if the frontend also considers it legal. */
function toMove(action: AI.Action, req: AIDecisionRequest): Move | null {
  if (action < 12) {
    const d = AI.PAWN_MOVES[action];
    const to: Position = { row: req.aiPos.row + d.dr, col: req.aiPos.col + d.dc };
    if (!req.validMoves.some((m) => m.row === to.row && m.col === to.col)) return null;
    return { type: 'move', from: req.aiPos, to, player: 'ai', timestamp: Date.now() };
  }

  const wall = AI.decodeWallAction(action);
  if (!wall) return null;
  const match = req.validWalls.find(
    (w) => w.row === wall.row && w.col === wall.col && w.direction === wall.direction
  );
  if (!match) return null;
  return { type: 'placeWall', wall: { ...match, placedBy: 'ai' }, player: 'ai', timestamp: Date.now() };
}

function fallbackMove(req: AIDecisionRequest): Move | null {
  if (req.validMoves.length === 0) return null;
  const to = req.validMoves.reduce((best, cur) => (cur.row < best.row ? cur : best));
  return { type: 'move', from: req.aiPos, to, player: 'ai', timestamp: Date.now() };
}

function mapDifficulty(level: AIDecisionRequest['aiLevel']): AI.DifficultyLevel {
  return AI.DIFFICULTY_LEVELS.includes(level) ? level : 'Normal';
}

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

export async function getAIMove(req: AIDecisionRequest): Promise<Move | null> {
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
