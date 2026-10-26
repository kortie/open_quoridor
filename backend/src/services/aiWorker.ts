import { parentPort } from 'node:worker_threads';
import { searchBestMove } from '../ai/search.js';
import type { QState, DifficultyLevel } from '../ai/types.js';

export interface WorkerRequest {
  id: number;
  state: QState;
  level: DifficultyLevel;
  timeLimit?: number;
}

export interface WorkerResponse {
  id: number;
  move: number;
  depth: number;
  nodes: number;
  elapsedMs: number;
}

parentPort?.on('message', (req: WorkerRequest) => {
  const info = searchBestMove(req.state, req.level, req.timeLimit ? { timeLimit: req.timeLimit } : {});
  const res: WorkerResponse = { id: req.id, move: info.move, depth: info.depth, nodes: info.nodes, elapsedMs: info.elapsedMs };
  parentPort!.postMessage(res);
});
