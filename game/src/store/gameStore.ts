import { create } from 'zustand';
import { GameState, Position, Wall, Move } from '../types';
import {
  initializeGame,
  getValidMoves,
  applyWallToBoard,
  isValidWallPlacement,
} from '../utils/gameLogic';
import { getAIMove } from '../utils/aiLogic';

interface GameStoreExtended extends GameState {
  gameStartTime: number;
  gameEndTime: number;
  /**
   * Bumped whenever the game is restarted, rewound, resigned or left. An AI search that
   * started under an older id finished too late and its move is dropped.
   */
  gameId: number;
}

/** Board state after replaying `history` from the initial position. */
function rebuild(history: Move[], level: string): Partial<GameState> {
  const state = initializeGame(level) as GameState;
  for (const move of history) {
    if (move.type === 'move') {
      if (move.player === 'player') state.playerPos = move.to!;
      else state.aiPos = move.to!;
    } else if (move.type === 'placeWall') {
      state.walls = [...state.walls, move.wall!];
      applyWallToBoard(state.board, move.wall!);
      if (move.player === 'player') state.playerWallsLeft--;
      else state.aiWallsLeft--;
    }
  }
  state.moveHistory = history;
  state.currentTurn = history.length % 2 === 0 ? 'player' : 'ai';
  state.validMoves = getValidMoves(state.playerPos, state.board, state.aiPos);
  return state;
}

export const useGameStore = create<GameStoreExtended>((set, get) => ({
  board: [],
  playerPos: { row: 0, col: 4 },
  aiPos: { row: 8, col: 4 },
  playerWallsLeft: 10,
  aiWallsLeft: 10,
  walls: [],
  currentTurn: 'player',
  gameStatus: 'playing',
  moveHistory: [],
  aiLevel: 'Normal',
  selectedCell: null,
  validMoves: [],
  validWalls: [],
  hoverCell: null,
  gameStartTime: 0,
  gameEndTime: 0,
  gameId: 0,

  startGame: (level: string) => {
    set({ ...rebuild([], level), aiLevel: level as GameState['aiLevel'], gameStatus: 'playing', gameStartTime: Date.now(), gameEndTime: 0, gameId: get().gameId + 1 });
  },

  playerMove: (row: number, col: number) => {
    const state = get();

    if (
      state.currentTurn !== 'player' ||
      state.gameStatus !== 'playing' ||
      !state.validMoves.some((m) => m.row === row && m.col === col)
    ) {
      return;
    }

    const move: Move = {
      type: 'move',
      from: state.playerPos,
      to: { row, col },
      player: 'player',
      timestamp: Date.now(),
    };

    applyMove(state, move);
  },

  playerPlaceWall: (wall: Wall) => {
    const state = get();

    if (
      state.currentTurn !== 'player' ||
      state.gameStatus !== 'playing' ||
      state.playerWallsLeft === 0
    ) {
      return;
    }

    if (!isValidWallPlacement(wall, state.board, state.playerPos, state.aiPos, state.walls)) {
      console.warn('Invalid wall placement');
      return;
    }

    const move: Move = {
      type: 'placeWall',
      wall,
      player: 'player',
      timestamp: Date.now(),
    };

    applyMove(state, move);
  },

  goBack: () => {
    const state = get();
    if (state.gameStatus !== 'playing' || state.currentTurn !== 'player') return;
    // Rewind to just before the player's last move, dropping the AI's reply with it.
    const lastPlayerMove = state.moveHistory.map((m) => m.player).lastIndexOf('player');
    if (lastPlayerMove < 0) return;
    set({ ...rebuild(state.moveHistory.slice(0, lastPlayerMove), state.aiLevel), gameId: state.gameId + 1 });
  },

  resignGame: () => {
    const state = get();
    if (state.gameStatus !== 'playing') return;
    set({ gameStatus: 'lost', validMoves: [], gameEndTime: Date.now(), gameId: state.gameId + 1 });
  },

  leaveGame: () => {
    set({ gameId: get().gameId + 1 });
  },

  setHoverCell: (cell: Position | null) => {
    set({ hoverCell: cell });
  },

  setSelectedCell: (cell: Position | null) => {
    set({ selectedCell: cell });
  },
}));

function applyMove(state: GameState, move: Move) {
  const newState = { ...state, moveHistory: [...state.moveHistory, move] };

  if (move.type === 'move') {
    if (move.player === 'player') {
      newState.playerPos = move.to!;
    } else {
      newState.aiPos = move.to!;
    }
  } else if (move.type === 'placeWall') {
    newState.walls = [...newState.walls, move.wall!];
    const boardCopy = JSON.parse(JSON.stringify(newState.board));
    applyWallToBoard(boardCopy, move.wall!);
    newState.board = boardCopy;

    if (move.player === 'player') {
      newState.playerWallsLeft--;
    } else {
      newState.aiWallsLeft--;
    }
  }

  // Check win conditions
  if (newState.playerPos.row === 8) {
    newState.gameStatus = 'won';
    const gameEndTime = Date.now();
    useGameStore.setState({
      ...newState,
      selectedCell: null,
      validMoves: [],
      gameStatus: 'won',
      gameEndTime,
    });
    return;
  }
  if (newState.aiPos.row === 0) {
    newState.gameStatus = 'lost';
    const gameEndTime = Date.now();
    useGameStore.setState({
      ...newState,
      selectedCell: null,
      validMoves: [],
      gameStatus: 'lost',
      gameEndTime,
    });
    return;
  }

  // Calculate valid moves for next player
  const nextPlayer = move.player === 'player' ? 'ai' : 'player';
  const nextPos = nextPlayer === 'player' ? newState.playerPos : newState.aiPos;
  const opponentPos = nextPlayer === 'player' ? newState.aiPos : newState.playerPos;

  const validMoves = getValidMoves(nextPos, newState.board, opponentPos);
  newState.validMoves = validMoves;
  newState.currentTurn = nextPlayer;
  newState.selectedCell = null;

  useGameStore.setState(newState);

  // AI turn
  if (nextPlayer === 'ai') {
    const gameId = useGameStore.getState().gameId;
    // Short delay so the thinking state renders before the search starts.
    setTimeout(async () => {
      const aiMove = await getAIMove(useGameStore.getState());
      const current = useGameStore.getState();
      // The player went back, resigned, restarted or left while the AI was thinking.
      if (current.gameId !== gameId || current.gameStatus !== 'playing') return;
      if (aiMove) applyMove(current, aiMove);
    }, 100);
  }
}
