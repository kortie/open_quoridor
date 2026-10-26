import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Wall } from '../types';

const CELL_SIZE = 60;
const WALL_THICKNESS = 9;
const EDGE_THRESHOLD = 15;
const DIRECTION_THRESHOLD = CELL_SIZE * 2; // Must drag 2 cells to determine direction
/** Pointer travel (board units) below which a press on a wall edge counts as a tap. */
const TAP_SLOP = 12;
const boardSize = CELL_SIZE * 9;
const VIEW = boardSize + 20;

const PLAYER = '#5eead4';
const AI = '#f9a8d4';
const PREVIEW = '#fde68a';

/**
 * The game model keeps the player on row 0 heading for row 8 (the engine's P1), but the
 * board is drawn upside down so the player starts at the bottom. A cell on model row r is
 * drawn on screen row 8 - r; a wall anchored on row r lies between rows r and r + 1, which
 * on screen is wall row 7 - r. Both maps are their own inverse.
 */
const viewRow = (row: number) => 8 - row;
const viewWallRow = (row: number) => 7 - row;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const LEVEL_LABEL: Record<string, string> = {
  Easy: '🌱 쉬움',
  Normal: '🍀 보통',
  Hard: '🔥 어려움',
  VeryHard: '⚡ 매우 어려움',
  Expert: '👑 전문가',
};

interface DragState {
  type: 'piece' | 'wall' | null;
  startPos: { row: number; col: number } | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  direction: 'horizontal' | 'vertical' | null; // null until threshold crossed
  edgeType: 'horizontal' | 'vertical' | null; // which edge user started from
}

const NO_DRAG: DragState = {
  type: null,
  startPos: null,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  direction: null,
  edgeType: null,
};

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Elapsed game time, frozen once the game has ended. */
const ElapsedTime: React.FC<{ start: number; end: number }> = ({ start, end }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (end) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [end]);
  return <>{formatElapsed((end || now) - start)}</>;
};

/** Largest square that fits the element, kept up to date as the viewport changes. */
function useSquareFit(ref: React.RefObject<HTMLElement>): number {
  const [size, setSize] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize(Math.floor(Math.min(el.clientWidth, el.clientHeight)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

interface PawnProps {
  row: number;
  col: number;
  color: string;
  dim?: boolean;
  face: 'player' | 'ai';
}

const Pawn: React.FC<PawnProps> = ({ row, col, color, dim, face }) => (
  <g transform={`translate(${col * CELL_SIZE + CELL_SIZE / 2 + 10}, ${row * CELL_SIZE + CELL_SIZE / 2 + 10})`}>
    <g className="pawn-float" style={{ opacity: dim ? 0.6 : 1 }}>
      <ellipse cx="0" cy="21" rx="15" ry="4" fill="#000" opacity="0.35" />
      <circle cx="0" cy="0" r="21" fill={color} filter="url(#glow)" />
      <circle cx="-7" cy="-9" r="5" fill="#fff" opacity="0.45" />
      {/* eyes */}
      <circle cx="-7" cy="-2" r="3" fill="#1e1b3a" />
      <circle cx="7" cy="-2" r="3" fill="#1e1b3a" />
      <circle cx="-6" cy="-3" r="1" fill="#fff" />
      <circle cx="8" cy="-3" r="1" fill="#fff" />
      {/* blush */}
      <ellipse cx="-12" cy="5" rx="3.5" ry="2" fill="#fb7185" opacity="0.55" />
      <ellipse cx="12" cy="5" rx="3.5" ry="2" fill="#fb7185" opacity="0.55" />
      {face === 'player' ? (
        <path d="M -5 5 Q 0 10 5 5" stroke="#1e1b3a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M -4 7 Q 0 4 4 7" stroke="#1e1b3a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      )}
    </g>
  </g>
);

interface GameBoardProps {
  onHome: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ onHome }) => {
  const gameState = useGameStore();
  const { playerPos, aiPos, validMoves, walls, currentTurn, gameStatus, playerWallsLeft, aiWallsLeft, moveHistory } =
    gameState;
  const [dragState, setDragState] = useState<DragState>(NO_DRAG);
  const [previewWall, setPreviewWall] = useState<{ row: number; col: number; direction: 'horizontal' | 'vertical' } | null>(null);
  const [previewLine, setPreviewLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const size = useSquareFit(boxRef);

  const playing = gameStatus === 'playing';
  const myTurn = playing && currentTurn === 'player';
  const canGoBack = myTurn && moveHistory.some((m) => m.player === 'player');

  const resetDrag = () => {
    setDragState(NO_DRAG);
    setPreviewWall(null);
    setPreviewLine(null);
    gameState.setHoverCell(null);
  };

  /**
   * Board coordinates (SVG units, without the 10px frame) of a client point. The SVG
   * is scaled to fit the screen, so client pixels are not SVG units.
   */
  const toBoard = (clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const scale = VIEW / rect.width;
    return { x: (clientX - rect.left) * scale - 10, y: (clientY - rect.top) * scale - 10 };
  };

  const getCellFromCoords = (clientX: number, clientY: number): { row: number; col: number } | null => {
    const p = toBoard(clientX, clientY);
    if (!p) return null;
    const col = Math.floor(p.x / CELL_SIZE);
    const row = Math.floor(p.y / CELL_SIZE);
    return row >= 0 && row <= 8 && col >= 0 && col <= 8 ? { row: viewRow(row), col } : null;
  };

  const getEdgeType = (clientX: number, clientY: number): { type: 'piece' | 'wall' | null; edgeType?: 'horizontal' | 'vertical' } => {
    const p = toBoard(clientX, clientY);
    if (!p) return { type: null };
    const { x, y } = p;

    // Check if pressing on the player's piece
    const playerX = playerPos.col * CELL_SIZE + CELL_SIZE / 2;
    const playerY = viewRow(playerPos.row) * CELL_SIZE + CELL_SIZE / 2;
    if (Math.sqrt((x - playerX) ** 2 + (y - playerY) ** 2) < 25) return { type: 'piece' };

    const posInCellX = x % CELL_SIZE;
    const posInCellY = y % CELL_SIZE;
    const nearLeft = posInCellX < EDGE_THRESHOLD;
    const nearRight = posInCellX > CELL_SIZE - EDGE_THRESHOLD;
    const nearTop = posInCellY < EDGE_THRESHOLD;
    const nearBottom = posInCellY > CELL_SIZE - EDGE_THRESHOLD;

    if ((nearLeft || nearRight) && playerWallsLeft > 0) return { type: 'wall', edgeType: 'vertical' };
    if ((nearTop || nearBottom) && playerWallsLeft > 0) return { type: 'wall', edgeType: 'horizontal' };
    return { type: null };
  };

  /** Move to the tapped cell if it is a legal destination. */
  const tryTapMove = (clientX: number, clientY: number): boolean => {
    const cell = getCellFromCoords(clientX, clientY);
    if (cell && validMoves.some((m) => m.row === cell.row && m.col === cell.col)) {
      gameState.playerMove(cell.row, cell.col);
      return true;
    }
    return false;
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!myTurn) return;
    // Keep receiving move/up events for this touch or mouse drag even outside the board.
    e.currentTarget.setPointerCapture(e.pointerId);

    const edgeType = getEdgeType(e.clientX, e.clientY);

    // Tapping a highlighted cell moves there directly (dragging the piece also works).
    if (edgeType.type === null) {
      tryTapMove(e.clientX, e.clientY);
      return;
    }

    setDragState({
      type: edgeType.type,
      startPos: edgeType.type === 'piece' ? { row: playerPos.row, col: playerPos.col } : null,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      direction: null,
      edgeType: edgeType.edgeType || null,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragState.type) return;

    if (dragState.type === 'piece' && dragState.startPos) {
      const cell = getCellFromCoords(e.clientX, e.clientY);
      if (cell) gameState.setHoverCell(cell);
      return;
    }

    const cur = toBoard(e.clientX, e.clientY);
    const start = toBoard(dragState.startX, dragState.startY);
    if (!cur || !start) return;

    const dx = cur.x - start.x;
    const dy = cur.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Determine direction once threshold crossed
    let direction = dragState.direction;
    if (direction === null && distance > DIRECTION_THRESHOLD) {
      direction = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }

    // The wall lies on the grid line nearest the press, starts at the pressed cell and
    // runs two cells the way the finger moved. (Screen coordinates; flipped on placement.)
    if (direction === 'horizontal') {
      setPreviewLine({ x1: start.x, y1: start.y, x2: cur.x, y2: start.y });
      const row = Math.floor((start.y - CELL_SIZE / 2) / CELL_SIZE);
      const startCol = Math.floor(start.x / CELL_SIZE);
      const col = clamp(dx >= 0 ? startCol : startCol - 1, 0, 7);
      setPreviewWall(row >= 0 && row < 8 ? { row, col, direction: 'horizontal' } : null);
    } else if (direction === 'vertical') {
      setPreviewLine({ x1: start.x, y1: start.y, x2: start.x, y2: cur.y });
      const col = Math.floor((start.x - CELL_SIZE / 2) / CELL_SIZE);
      const startRow = Math.floor(start.y / CELL_SIZE);
      const row = clamp(dy >= 0 ? startRow : startRow - 1, 0, 7);
      setPreviewWall(col >= 0 && col < 8 ? { row, col, direction: 'vertical' } : null);
    } else {
      setPreviewLine({ x1: start.x, y1: start.y, x2: cur.x, y2: cur.y });
    }

    setDragState((prev) => ({ ...prev, currentX: e.clientX, currentY: e.clientY, direction }));
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragState.type === 'piece' && dragState.startPos) {
      tryTapMove(e.clientX, e.clientY);
    } else if (dragState.type === 'wall' && previewWall && dragState.direction) {
      const wall: Wall = { row: viewWallRow(previewWall.row), col: previewWall.col, direction: previewWall.direction, placedBy: 'player' };
      gameState.playerPlaceWall(wall);
    } else if (dragState.type === 'wall') {
      // A press near a cell edge that barely moved was meant as a tap on that cell.
      const start = toBoard(dragState.startX, dragState.startY);
      const end = toBoard(e.clientX, e.clientY);
      if (start && end && Math.hypot(end.x - start.x, end.y - start.y) < TAP_SLOP) {
        tryTapMove(dragState.startX, dragState.startY);
      }
    }
    resetDrag();
  };

  const turnLabel = !playing ? '게임 종료' : myTurn ? '내 차례' : 'AI가 생각 중…';

  return (
    <div className="app-screen flex flex-col px-3 pt-3 pb-4 gap-3 select-none">
      {/* Top bar: home, elapsed time, level */}
      <header className="flex items-center justify-between gap-2">
        <button
          onClick={onHome}
          aria-label="홈으로"
          className="w-11 h-11 rounded-2xl bg-white/10 text-xl flex items-center justify-center shadow-glow-lilac active:scale-90 transition-transform"
        >
          🏠
        </button>
        <div className="px-4 py-1.5 rounded-full bg-white/10 shadow-glow-sky text-sky-100 font-bold tabular-nums text-lg">
          ⏱ <ElapsedTime start={gameState.gameStartTime} end={gameState.gameEndTime} />
        </div>
        <div className="px-3 py-1.5 rounded-full bg-white/10 text-sm font-semibold text-violet-100 shadow-glow-lilac whitespace-nowrap">
          {LEVEL_LABEL[gameState.aiLevel] ?? gameState.aiLevel}
        </div>
      </header>

      {/* Status: walls left and whose turn */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-300/10 text-teal-200 shadow-glow-mint">
          <span className="inline-block w-3 h-3 rounded-full bg-teal-300" /> 나 · 벽 <b>{playerWallsLeft}</b>
        </div>
        <div
          className={`px-3 py-1 rounded-full font-bold ${
            myTurn ? 'text-teal-200 glow-text-mint' : playing ? 'text-pink-200 glow-text-pink animate-pulse' : 'text-violet-200'
          }`}
        >
          {turnLabel}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-300/10 text-pink-200 shadow-glow-pink">
          AI · 벽 <b>{aiWallsLeft}</b> <span className="inline-block w-3 h-3 rounded-full bg-pink-300" />
        </div>
      </div>

      {/* Board: the largest square that fits the remaining space */}
      <div ref={boxRef} className="flex-1 min-h-0 flex items-center justify-center">
        {size > 0 && (
          <svg
            ref={svgRef}
            width={size}
            height={size}
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className="rounded-3xl shadow-glow-board"
            // touch-action none stops the browser from turning a drag on the board into a scroll.
            style={{ touchAction: 'none', background: 'linear-gradient(145deg, #2a1f55, #16213e)' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={resetDrag}
          >
            <defs>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/*
                Walls are straight lines whose bounding box has zero width or height, so a
                bounding-box filter region would clip them away; give them a region in board
                units instead. (Pawns are drawn in a translated frame and keep the default.)
              */}
              <filter id="glow-line" filterUnits="userSpaceOnUse" x="0" y="0" width={VIEW} height={VIEW}>
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Cells */}
            {Array.from({ length: 9 }, (_, screenRow) =>
              Array.from({ length: 9 }, (_, col) => {
                const row = viewRow(screenRow);
                const isValid = validMoves.some((m) => m.row === row && m.col === col);
                const isHover =
                  gameState.hoverCell?.row === row && gameState.hoverCell?.col === col && dragState.type === 'piece';
                const x = col * CELL_SIZE + 10;
                const y = screenRow * CELL_SIZE + 10;
                // Goal rows are outlined in the colour of the side that must reach them.
                const goal = row === 8 ? PLAYER : row === 0 ? AI : 'none';
                return (
                  <g key={`cell-${row}-${col}`}>
                    <rect
                      x={x + 4}
                      y={y + 4}
                      width={CELL_SIZE - 8}
                      height={CELL_SIZE - 8}
                      rx={12}
                      fill={isHover ? '#5b4b9a' : (row + col) % 2 === 0 ? '#3b2f6e' : '#33296a'}
                      stroke={goal}
                      strokeOpacity={0.35}
                      strokeWidth={2}
                    />
                    {isValid && dragState.type !== 'wall' && (
                      <circle
                        cx={x + CELL_SIZE / 2}
                        cy={y + CELL_SIZE / 2}
                        r={9}
                        fill={PLAYER}
                        filter="url(#glow)"
                        className="move-dot"
                      />
                    )}
                  </g>
                );
              })
            )}

            {/* Preview line while dragging (follows the finger) */}
            {previewLine && dragState.type === 'wall' && (
              <line
                {...previewLine}
                stroke={PREVIEW}
                strokeWidth={dragState.direction ? WALL_THICKNESS : 3}
                strokeLinecap="round"
                opacity="0.8"
                filter="url(#glow-line)"
              />
            )}

            {/* Snapped preview wall (after direction determined) */}
            {previewWall && dragState.direction && (
              <line
                x1={previewWall.direction === 'horizontal' ? previewWall.col * CELL_SIZE + 10 : (previewWall.col + 1) * CELL_SIZE + 10}
                y1={previewWall.direction === 'horizontal' ? (previewWall.row + 1) * CELL_SIZE + 10 : previewWall.row * CELL_SIZE + 10}
                x2={previewWall.direction === 'horizontal' ? (previewWall.col + 2) * CELL_SIZE + 10 : (previewWall.col + 1) * CELL_SIZE + 10}
                y2={previewWall.direction === 'horizontal' ? (previewWall.row + 1) * CELL_SIZE + 10 : (previewWall.row + 2) * CELL_SIZE + 10}
                stroke={PREVIEW}
                strokeWidth={WALL_THICKNESS}
                strokeLinecap="round"
                opacity="0.6"
              />
            )}

            {/* Walls on board */}
            {walls.map((wall, idx) => {
              const x = wall.col * CELL_SIZE + 10;
              const y = viewWallRow(wall.row) * CELL_SIZE + 10;
              const horizontal = wall.direction === 'horizontal';
              return (
                <line
                  key={`wall-${idx}`}
                  x1={horizontal ? x + 3 : x + CELL_SIZE}
                  y1={horizontal ? y + CELL_SIZE : y + 3}
                  x2={horizontal ? x + CELL_SIZE * 2 - 3 : x + CELL_SIZE}
                  y2={horizontal ? y + CELL_SIZE : y + CELL_SIZE * 2 - 3}
                  stroke={wall.placedBy === 'player' ? PLAYER : AI}
                  strokeWidth={WALL_THICKNESS}
                  strokeLinecap="round"
                  filter="url(#glow-line)"
                />
              );
            })}

            <Pawn row={viewRow(aiPos.row)} col={aiPos.col} color={AI} face="ai" />
            <Pawn row={viewRow(playerPos.row)} col={playerPos.col} color={PLAYER} face="player" dim={dragState.type === 'piece'} />
          </svg>
        )}
      </div>

      <p className="text-center text-xs text-violet-200/70">탭하거나 말을 끌어서 이동 · 칸 가장자리를 끌어서 벽 놓기</p>

      {/* Bottom actions */}
      <footer className="grid grid-cols-2 gap-3">
        <button
          onClick={() => gameState.goBack()}
          disabled={!canGoBack}
          className="py-3 rounded-2xl font-bold bg-sky-300/15 text-sky-100 shadow-glow-sky active:scale-95 transition-transform disabled:opacity-35 disabled:shadow-none"
        >
          ↩ 이전으로
        </button>
        <button
          onClick={() => setConfirmResign(true)}
          disabled={!playing}
          className="py-3 rounded-2xl font-bold bg-pink-300/15 text-pink-100 shadow-glow-pink active:scale-95 transition-transform disabled:opacity-35 disabled:shadow-none"
        >
          🏳 포기
        </button>
      </footer>

      {/* Resign confirmation */}
      {confirmResign && playing && (
        <Overlay>
          <p className="text-4xl">🥺</p>
          <p className="text-lg font-bold text-pink-100">정말 포기할까요?</p>
          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              onClick={() => setConfirmResign(false)}
              className="py-3 rounded-2xl font-bold bg-white/10 text-violet-100 active:scale-95 transition-transform"
            >
              계속하기
            </button>
            <button
              onClick={() => {
                setConfirmResign(false);
                gameState.resignGame();
              }}
              className="py-3 rounded-2xl font-bold bg-pink-400/80 text-white shadow-glow-pink active:scale-95 transition-transform"
            >
              포기하기
            </button>
          </div>
        </Overlay>
      )}

      {/* Result */}
      {!playing && (
        <Overlay>
          <p className="text-5xl">{gameStatus === 'won' ? '🎉' : '😢'}</p>
          <p className={`text-2xl font-extrabold ${gameStatus === 'won' ? 'text-teal-200 glow-text-mint' : 'text-pink-200 glow-text-pink'}`}>
            {gameStatus === 'won' ? '승리!' : '패배'}
          </p>
          <p className="text-sm text-violet-200">
            {LEVEL_LABEL[gameState.aiLevel] ?? gameState.aiLevel} · ⏱ {formatElapsed(gameState.gameEndTime - gameState.gameStartTime)}
          </p>
          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              onClick={onHome}
              className="py-3 rounded-2xl font-bold bg-white/10 text-violet-100 active:scale-95 transition-transform"
            >
              🏠 홈
            </button>
            <button
              onClick={() => gameState.startGame(gameState.aiLevel)}
              className="py-3 rounded-2xl font-bold bg-teal-300/80 text-[#1e1b3a] shadow-glow-mint active:scale-95 transition-transform"
            >
              다시 하기
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
};

const Overlay: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#0d0a1f]/70 backdrop-blur-sm p-6">
    <div className="w-full max-w-xs rounded-3xl bg-[#2a1f55] p-6 flex flex-col items-center gap-3 shadow-glow-lilac animate-pop">
      {children}
    </div>
  </div>
);
