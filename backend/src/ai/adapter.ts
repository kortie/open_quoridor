/**
 * Conversion between the game client's state shapes and the engine's. Shared by the
 * server (services/aiService.ts) and the offline Android app (game/src/engine), so it
 * must stay free of Node-only APIs.
 */
import { QState, Action, DifficultyLevel, DIFFICULTY_LEVELS, PAWN_MOVES } from './types.js';
import { decodeWallAction } from './board.js';

export interface ClientPosition {
  row: number;
  col: number;
}

export interface ClientWall {
  row: number;
  col: number;
  direction: 'horizontal' | 'vertical';
  placedBy: 'player' | 'ai';
}

export interface ClientMove {
  type: 'move' | 'placeWall';
  from?: ClientPosition;
  to?: ClientPosition;
  wall?: ClientWall;
  player: 'player' | 'ai';
  timestamp: number;
}

export interface AIDecisionRequest {
  aiLevel: DifficultyLevel;
  aiPos: ClientPosition;
  playerPos: ClientPosition;
  aiWallsLeft: number;
  playerWallsLeft: number;
  /** Moves/walls the client considers legal for the AI; the engine's choice must be among them. */
  validMoves: ClientPosition[];
  validWalls: ClientWall[];
  walls?: ClientWall[];
}

// Client: player starts at row 0 (goal row 8) = engine P1; AI starts at row 8 (goal row 0) = engine P2.
export function toQState(req: AIDecisionRequest): QState {
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

/** Decode an engine action, accepting it only if the client also considers it legal. */
export function toMove(action: Action, req: AIDecisionRequest): ClientMove | null {
  if (action < 12) {
    const d = PAWN_MOVES[action];
    const to: ClientPosition = { row: req.aiPos.row + d.dr, col: req.aiPos.col + d.dc };
    if (!req.validMoves.some((m) => m.row === to.row && m.col === to.col)) return null;
    return { type: 'move', from: req.aiPos, to, player: 'ai', timestamp: Date.now() };
  }

  const wall = decodeWallAction(action);
  if (!wall) return null;
  const match = req.validWalls.find(
    (w) => w.row === wall.row && w.col === wall.col && w.direction === wall.direction
  );
  if (!match) return null;
  return { type: 'placeWall', wall: { ...match, placedBy: 'ai' }, player: 'ai', timestamp: Date.now() };
}

/** Last resort: step towards the AI's goal row. */
export function fallbackMove(req: AIDecisionRequest): ClientMove | null {
  if (req.validMoves.length === 0) return null;
  const to = req.validMoves.reduce((best, cur) => (cur.row < best.row ? cur : best));
  return { type: 'move', from: req.aiPos, to, player: 'ai', timestamp: Date.now() };
}

export function mapDifficulty(level: string): DifficultyLevel {
  return (DIFFICULTY_LEVELS as readonly string[]).includes(level) ? (level as DifficultyLevel) : 'Normal';
}
