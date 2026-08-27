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

  startGame: (level: string) => {
    const initialState = initializeGame(level);
    set({ ...initialState, gameStartTime: Date.now(), gameEndTime: 0 } as any);

    const state = get();
    const validMoves = getValidMoves(state.playerPos, state.board, state.aiPos);
    set({ validMoves });
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

    // Validate wall placement
    const boardCopy = JSON.parse(JSON.stringify(state.board));
    const isValid = isValidWallPlacement(wall, boardCopy, state.playerPos, state.aiPos);

    if (!isValid) {
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

  undoMove: () => {
    const state = get();
    if (state.moveHistory.length === 0) return;

    const history = [...state.moveHistory];
    history.pop();

    const freshState = initializeGame(state.aiLevel as any);
    let newState = { ...freshState } as any;

    for (const move of history) {
      if (move.type === 'move') {
        if (move.player === 'player') {
          newState.playerPos = move.to!;
        } else {
          newState.aiPos = move.to!;
        }
      } else if (move.type === 'placeWall') {
        newState.walls.push(move.wall!);
        applyWallToBoard(newState.board, move.wall!);

        if (move.player === 'player') {
          newState.playerWallsLeft--;
        } else {
          newState.aiWallsLeft--;
        }
      }
    }

    newState.moveHistory = history;
    newState.currentTurn = history.length % 2 === 0 ? 'player' : 'ai';

    const validMoves = getValidMoves(newState.playerPos, newState.board, newState.aiPos);
    set({ ...newState, validMoves });
  },

  resignGame: () => {
    set({ gameStatus: 'lost' });
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
    // Show thinking state immediately
    setTimeout(() => {
      const currentState = useGameStore.getState();
      const aiMove = getAIMove(currentState);
      if (aiMove) {
        applyMove(currentState, aiMove);
      }
    }, 100); // Short delay to ensure thinking state shows
  }
}
