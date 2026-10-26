/// <reference lib="webworker" />
import { searchBestMove } from '@engine/search';
import type { QState, DifficultyLevel } from '@engine/types';

export interface WorkerRequest {
  id: number;
  state: QState;
  level: DifficultyLevel;
}

export interface WorkerResponse {
  id: number;
  move: number;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, state, level } = e.data;
  const response: WorkerResponse = { id, move: searchBestMove(state, level).move };
  self.postMessage(response);
};
