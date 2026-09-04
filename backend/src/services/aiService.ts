import * as AI from '../ai/index.js';

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
  switch (level) {
    case 'Easy':
      return 'Easy';
    case 'Normal':
      return 'Normal';
    case 'Hard':
    case 'VeryHard':
    case 'Expert':
      return 'Hard';
    default:
      return 'Normal';
  }
}

export async function getAIMove(req: AIDecisionRequest): Promise<Move | null> {
  try {
    const action = AI.getBestMove(toQState(req), mapDifficulty(req.aiLevel));
    return toMove(action, req) ?? fallbackMove(req);
  } catch (error) {
    console.error('AI move error:', error);
    return fallbackMove(req);
  }
}
