/**
 * Core type definitions for Quoridor AI engine
 */

export interface Position {
  row: number;
  col: number;
}

/**
 * Game state representation using bitboards for walls
 */
export interface QState {
  // Pawn positions
  p1_row: number;
  p1_col: number;
  p2_row: number;
  p2_col: number;

  // Wall counts
  p1_walls: number; // remaining walls for player 1
  p2_walls: number; // remaining walls for player 2

  // Wall bitboards (8x8 grid = 64 bits each)
  // bit position = r*8 + c where r,c in [0..7]
  h_walls: bigint; // horizontal walls
  v_walls: bigint; // vertical walls

  // Turn: 0 = P1, 1 = P2
  turn: 0 | 1;
}

/**
 * Move representation using action indices (0-139)
 * 0-11: pawn moves (N, S, E, W, NN, SS, EE, WW, NE, NW, SE, SW)
 * 12-75: horizontal wall placements (index = 12 + r*8 + c)
 * 76-139: vertical wall placements (index = 76 + r*8 + c)
 */
export type Action = number; // 0-139

export interface MoveInfo {
  type: 'pawn' | 'wall';
  action: Action;
}

export interface WallPlacement {
  row: number;
  col: number;
  direction: 'horizontal' | 'vertical';
}

// Pawn move directions (for actions 0-11)
export const PAWN_MOVES = [
  { dr: -1, dc: 0 },  // 0: N
  { dr: 1, dc: 0 },   // 1: S
  { dr: 0, dc: 1 },   // 2: E
  { dr: 0, dc: -1 },  // 3: W
  { dr: -2, dc: 0 },  // 4: NN
  { dr: 2, dc: 0 },   // 5: SS
  { dr: 0, dc: 2 },   // 6: EE
  { dr: 0, dc: -2 },  // 7: WW
  { dr: -1, dc: 1 },  // 8: NE
  { dr: -1, dc: -1 }, // 9: NW
  { dr: 1, dc: 1 },   // 10: SE
  { dr: 1, dc: -1 },  // 11: SW
] as const;

// Difficulty levels
export type DifficultyLevel = 'Easy' | 'Normal' | 'Hard' | 'VeryHard' | 'Expert';

export const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = ['Easy', 'Normal', 'Hard', 'VeryHard', 'Expert'];

// Evaluation weights configuration
export interface EvalWeights {
  w1: number; // distance advantage weight
  w2: number; // wall advantage weight
  w3: number; // mobility weight
  w4: number; // path diversity weight
  w5?: number; // opponent path diversity weight
  tempo?: number; // side-to-move bonus
}
