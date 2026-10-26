export interface Cell {
  isPassable: boolean;
  walls: {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  };
}

export interface Wall {
  row: number;
  col: number;
  direction: 'horizontal' | 'vertical';
  placedBy: 'player' | 'ai';
}

export interface Position {
  row: number;
  col: number;
}

export interface Move {
  type: 'move' | 'placeWall';
  from?: Position;
  to?: Position;
  wall?: Wall;
  player: 'player' | 'ai';
  timestamp: number;
}

export interface GameState {
  board: Cell[][];
  playerPos: Position;
  aiPos: Position;
  playerWallsLeft: number;
  aiWallsLeft: number;
  walls: Wall[];
  currentTurn: 'player' | 'ai';
  gameStatus: 'playing' | 'won' | 'lost' | 'draw';
  moveHistory: Move[];
  aiLevel: 'Easy' | 'Normal' | 'Hard' | 'VeryHard' | 'Expert';
  selectedCell: Position | null;
  validMoves: Position[];
  validWalls: Wall[];
  hoverCell: Position | null;

  startGame: (level: string) => void;
  playerMove: (row: number, col: number) => void;
  playerPlaceWall: (wall: Wall) => void;
  /** Rewind the player's last move together with the AI's reply. */
  goBack: () => void;
  resignGame: () => void;
  /** Leaving the game screen: cancels an AI move still being computed. */
  leaveGame: () => void;
  setHoverCell: (cell: Position | null) => void;
  setSelectedCell: (cell: Position | null) => void;
}
