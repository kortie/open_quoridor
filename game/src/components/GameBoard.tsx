import React, { useState, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { Wall } from '../types';

const CELL_SIZE = 60;
const WALL_THICKNESS = 8;
const EDGE_THRESHOLD = 15;
const DIRECTION_THRESHOLD = CELL_SIZE * 2; // Must drag 2 cells to determine direction

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

export const GameBoard: React.FC = () => {
  const gameState = useGameStore();
  const { playerPos, aiPos, validMoves, walls, currentTurn, gameStatus, playerWallsLeft } = gameState;
  const [dragState, setDragState] = useState<DragState>({
    type: null,
    startPos: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    direction: null,
    edgeType: null,
  });
  const [previewWall, setPreviewWall] = useState<{ row: number; col: number; direction: 'horizontal' | 'vertical' } | null>(null);
  const [previewLine, setPreviewLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const getCellFromCoords = (clientX: number, clientY: number): { row: number; col: number } | null => {
    if (!svgRef.current) return null;

    const rect = svgRef.current.getBoundingClientRect();
    const x = clientX - rect.left - 10;
    const y = clientY - rect.top - 10;

    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);

    if (row >= 0 && row <= 8 && col >= 0 && col <= 8) {
      return { row, col };
    }
    return null;
  };

  const getEdgeType = (clientX: number, clientY: number): { type: 'piece' | 'wall' | null; edgeType?: 'horizontal' | 'vertical' } => {
    if (!svgRef.current) return { type: null };

    const rect = svgRef.current.getBoundingClientRect();
    const x = clientX - rect.left - 10;
    const y = clientY - rect.top - 10;

    // Check if clicking on player piece
    const playerX = playerPos.col * CELL_SIZE + CELL_SIZE / 2;
    const playerY = playerPos.row * CELL_SIZE + CELL_SIZE / 2;
    const distToPlayer = Math.sqrt((x - playerX) ** 2 + (y - playerY) ** 2);
    if (distToPlayer < 25) {
      return { type: 'piece' };
    }

    // Get position within cell
    const posInCellX = x % CELL_SIZE;
    const posInCellY = y % CELL_SIZE;

    // Detect if on edge
    const nearLeft = posInCellX < EDGE_THRESHOLD;
    const nearRight = posInCellX > CELL_SIZE - EDGE_THRESHOLD;
    const nearTop = posInCellY < EDGE_THRESHOLD;
    const nearBottom = posInCellY > CELL_SIZE - EDGE_THRESHOLD;

    if ((nearLeft || nearRight) && playerWallsLeft > 0) {
      return { type: 'wall', edgeType: 'vertical' };
    }
    if ((nearTop || nearBottom) && playerWallsLeft > 0) {
      return { type: 'wall', edgeType: 'horizontal' };
    }

    return { type: null };
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (gameStatus !== 'playing' || currentTurn !== 'player') return;

    const edgeType = getEdgeType(e.clientX, e.clientY);

    if (edgeType.type === 'piece') {
      setDragState({
        type: 'piece',
        startPos: { row: playerPos.row, col: playerPos.col },
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        direction: null,
        edgeType: null,
      });
    } else if (edgeType.type === 'wall') {
      setDragState({
        type: 'wall',
        startPos: null,
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        direction: null,
        edgeType: edgeType.edgeType || null,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragState.type) return;

    if (dragState.type === 'piece' && dragState.startPos) {
      const cell = getCellFromCoords(e.clientX, e.clientY);
      if (cell) {
        gameState.setHoverCell(cell);
      }
    } else if (dragState.type === 'wall') {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const svgX = e.clientX - rect.left - 10;
      const svgY = e.clientY - rect.top - 10;

      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Determine direction once threshold crossed
      let direction = dragState.direction;
      if (direction === null && distance > DIRECTION_THRESHOLD) {
        direction = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      }

      // Show preview line that follows user's drag
      const rect2 = svgRef.current.getBoundingClientRect();
      const startSvgX = dragState.startX - rect2.left - 10;
      const startSvgY = dragState.startY - rect2.top - 10;

      if (direction === 'horizontal') {
        // Draw horizontal line
        setPreviewLine({
          x1: startSvgX - 20,
          y1: startSvgY,
          x2: svgX + 20,
          y2: startSvgY,
        });

        // Calculate wall position on grid
        const row = Math.floor((startSvgY - CELL_SIZE / 2) / CELL_SIZE);
        const col = Math.floor(svgX / CELL_SIZE);
        if (row >= 0 && row < 8 && col >= 0 && col < 8) {
          setPreviewWall({ row, col, direction: 'horizontal' });
        }
      } else if (direction === 'vertical') {
        // Draw vertical line
        setPreviewLine({
          x1: startSvgX,
          y1: startSvgY - 20,
          x2: startSvgX,
          y2: svgY + 20,
        });

        // Calculate wall position on grid
        const row = Math.floor(svgY / CELL_SIZE);
        const col = Math.floor((startSvgX - CELL_SIZE / 2) / CELL_SIZE);
        if (row >= 0 && row < 8 && col >= 0 && col < 8) {
          setPreviewWall({ row, col, direction: 'vertical' });
        }
      } else {
        // Not enough distance yet - show line following user's drag
        setPreviewLine({
          x1: startSvgX,
          y1: startSvgY,
          x2: svgX,
          y2: svgY,
        });
      }

      // Update drag state with current position and direction
      setDragState((prev) => ({
        ...prev,
        currentX: e.clientX,
        currentY: e.clientY,
        direction,
      }));
    }
  };

  const handleMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    if (dragState.type === 'piece' && dragState.startPos) {
      const cell = getCellFromCoords(e.clientX, e.clientY);

      if (cell && validMoves.some((m) => m.row === cell.row && m.col === cell.col)) {
        gameState.playerMove(cell.row, cell.col);
      }

      setDragState({
        type: null,
        startPos: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        direction: null,
        edgeType: null,
      });
      gameState.setHoverCell(null);
    } else if (dragState.type === 'wall' && previewWall) {
      // Place wall
      const wall: Wall = {
        row: previewWall.row,
        col: previewWall.col,
        direction: previewWall.direction,
        placedBy: 'player',
      };

      gameState.playerPlaceWall(wall);
      setPreviewWall(null);
      setPreviewLine(null);
      setDragState({
        type: null,
        startPos: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        direction: null,
        edgeType: null,
      });
    } else {
      setDragState({
        type: null,
        startPos: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        direction: null,
        edgeType: null,
      });
      setPreviewWall(null);
      setPreviewLine(null);
      gameState.setHoverCell(null);
    }
  };

  const boardSize = CELL_SIZE * 9;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#0f1419] via-[#1a1a2e] to-[#0f1419] p-4">
      <div className="bg-[#1a1a2e] rounded-2xl p-8 border-4 border-[#06b6d4] shadow-2xl">
        <h1 className="text-center text-3xl font-bold text-cyan-400 mb-2">🎮 쿼리도</h1>
        <p className="text-center text-gray-400 text-sm mb-6">
          👤 말을 드래그해 이동 | 🧱 보드 가장자리를 드래그해 벽 그리기
        </p>

        {/* Board */}
        <div className="relative inline-block bg-[#0f1419] rounded-lg p-2 border-2 border-[#2a2a4e] mb-6">
          <svg
            ref={svgRef}
            width={boardSize + 20}
            height={boardSize + 20}
            className="bg-gradient-to-br from-[#1f2f4a] to-[#0f1419]"
            style={{ borderRadius: '8px', userSelect: 'none' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              setDragState({
                type: null,
                startPos: null,
                startX: 0,
                startY: 0,
                currentX: 0,
                currentY: 0,
                direction: null,
                edgeType: null,
              });
              setPreviewWall(null);
              setPreviewLine(null);
              gameState.setHoverCell(null);
            }}
          >
            {/* Grid cells */}
            {Array(9)
              .fill(null)
              .map((_, row) =>
                Array(9)
                  .fill(null)
                  .map((_, col) => {
                    const isValid = validMoves.some((m) => m.row === row && m.col === col);
                    const isHover =
                      gameState.hoverCell?.row === row &&
                      gameState.hoverCell?.col === col &&
                      dragState.type === 'piece';
                    const x = col * CELL_SIZE + 10;
                    const y = row * CELL_SIZE + 10;

                    return (
                      <g key={`cell-${row}-${col}`}>
                        {/* Cell background */}
                        <rect
                          x={x}
                          y={y}
                          width={CELL_SIZE}
                          height={CELL_SIZE}
                          fill={isHover ? '#3a5a8a' : (row + col) % 2 === 0 ? '#2a4a6a' : '#1a3a5a'}
                          stroke="#3a5a7a"
                          strokeWidth="2"
                          className="transition-colors"
                        />

                        {/* Valid move indicators */}
                        {isValid && dragState.type !== 'wall' && (
                          <>
                            <circle
                              cx={x + CELL_SIZE / 2}
                              cy={y + CELL_SIZE / 2}
                              r={8}
                              fill="#10b981"
                              opacity="0.9"
                            />
                            <circle
                              cx={x + CELL_SIZE / 2}
                              cy={y + CELL_SIZE / 2}
                              r={14}
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="2"
                              opacity="0.5"
                            />
                          </>
                        )}
                      </g>
                    );
                  })
              )}

            {/* Preview line while dragging (follows user's drag) */}
            {previewLine && dragState.type === 'wall' && (
              <line
                x1={previewLine.x1}
                y1={previewLine.y1}
                x2={previewLine.x2}
                y2={previewLine.y2}
                stroke="#fbbf24"
                strokeWidth={dragState.direction ? WALL_THICKNESS : 2}
                strokeLinecap="round"
                opacity="0.8"
              />
            )}

            {/* Snapped preview wall (after direction determined) */}
            {previewWall && dragState.direction && (
              <g opacity="0.7">
                {previewWall.direction === 'horizontal' ? (
                  <line
                    x1={previewWall.col * CELL_SIZE + 10}
                    y1={(previewWall.row + 1) * CELL_SIZE + 10}
                    x2={(previewWall.col + 2) * CELL_SIZE + 10}
                    y2={(previewWall.row + 1) * CELL_SIZE + 10}
                    stroke="#34d399"
                    strokeWidth={WALL_THICKNESS}
                    strokeLinecap="round"
                  />
                ) : (
                  <line
                    x1={(previewWall.col + 1) * CELL_SIZE + 10}
                    y1={previewWall.row * CELL_SIZE + 10}
                    x2={(previewWall.col + 1) * CELL_SIZE + 10}
                    y2={(previewWall.row + 2) * CELL_SIZE + 10}
                    stroke="#34d399"
                    strokeWidth={WALL_THICKNESS}
                    strokeLinecap="round"
                  />
                )}
              </g>
            )}

            {/* Walls on board */}
            {walls.map((wall, idx) => {
              const x = wall.col * CELL_SIZE + 10;
              const y = wall.row * CELL_SIZE + 10;
              const wallStroke = wall.placedBy === 'player' ? '#06b6d4' : '#10b981';

              if (wall.direction === 'horizontal') {
                return (
                  <line
                    key={`wall-${idx}`}
                    x1={x}
                    y1={y + CELL_SIZE}
                    x2={x + CELL_SIZE * 2}
                    y2={y + CELL_SIZE}
                    stroke={wallStroke}
                    strokeWidth={WALL_THICKNESS}
                    strokeLinecap="round"
                  />
                );
              } else {
                return (
                  <line
                    key={`wall-${idx}`}
                    x1={x + CELL_SIZE}
                    y1={y}
                    x2={x + CELL_SIZE}
                    y2={y + CELL_SIZE * 2}
                    stroke={wallStroke}
                    strokeWidth={WALL_THICKNESS}
                    strokeLinecap="round"
                  />
                );
              }
            })}

            {/* Player piece */}
            <g
              transform={`translate(${playerPos.col * CELL_SIZE + CELL_SIZE / 2 + 10}, ${playerPos.row * CELL_SIZE + CELL_SIZE / 2 + 10})`}
              className={dragState.type === 'piece' ? 'opacity-70' : ''}
              style={{ cursor: currentTurn === 'player' ? 'grab' : 'default' }}
            >
              <ellipse cx="0" cy="20" rx="18" ry="5" fill="#000000" opacity="0.3" />
              <defs>
                <radialGradient id="playerGradient" cx="35%" cy="35%">
                  <stop offset="0%" style={{ stopColor: '#3dd9ff', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#06b6d4', stopOpacity: 1 }} />
                </radialGradient>
              </defs>
              <circle cx="0" cy="0" r="20" fill="url(#playerGradient)" />
              <circle cx="-8" cy="-5" r="3" fill="#ffffff" />
              <circle cx="8" cy="-5" r="3" fill="#ffffff" />
              <circle cx="-8" cy="-5" r="1.5" fill="#06b6d4" />
              <circle cx="8" cy="-5" r="1.5" fill="#06b6d4" />
              <path d="M -8 3 Q 0 8 8 3" stroke="#ffffff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <circle cx="-7" cy="-8" r="3" fill="#ffffff" opacity="0.4" />
              <circle cx="0" cy="0" r="20" fill="none" stroke="#ffffff" strokeWidth="2.5" />
            </g>

            {/* AI piece */}
            <g transform={`translate(${aiPos.col * CELL_SIZE + CELL_SIZE / 2 + 10}, ${aiPos.row * CELL_SIZE + CELL_SIZE / 2 + 10})`}>
              <ellipse cx="0" cy="20" rx="18" ry="5" fill="#000000" opacity="0.3" />
              <defs>
                <radialGradient id="aiGradient" cx="35%" cy="35%">
                  <stop offset="0%" style={{ stopColor: '#34d399', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: '#10b981', stopOpacity: 1 }} />
                </radialGradient>
              </defs>
              <circle cx="0" cy="0" r="20" fill="url(#aiGradient)" />
              <rect x="-10" y="-7" width="5" height="6" fill="#ffffff" rx="1" />
              <rect x="5" y="-7" width="5" height="6" fill="#ffffff" rx="1" />
              <rect x="-10" y="-7" width="5" height="3" fill="#10b981" rx="1" />
              <rect x="5" y="-7" width="5" height="3" fill="#10b981" rx="1" />
              <line x1="-8" y1="5" x2="8" y2="5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="-7" cy="-8" r="3" fill="#ffffff" opacity="0.4" />
              <circle cx="0" cy="0" r="20" fill="none" stroke="#ffffff" strokeWidth="2.5" />
            </g>
          </svg>
        </div>

        {/* Game Info */}
        <div className="bg-[#0f1419] rounded-lg p-4 border border-[#2a2a4e] space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-gray-400">당신의 벽:</span>
              <span className="ml-2 text-cyan-400 font-bold text-lg">{playerWallsLeft}/10</span>
            </div>
            <div>
              <span className="text-gray-400">AI의 벽:</span>
              <span className="ml-2 text-emerald-400 font-bold text-lg">{gameState.aiWallsLeft}/10</span>
            </div>
          </div>

          <div className="text-center">
            <span className="text-gray-400">턴:</span>
            <span className={`ml-2 font-bold text-lg ${currentTurn === 'player' ? 'text-cyan-400' : 'text-emerald-400'}`}>
              {currentTurn === 'player' ? '👤 당신' : '🤖 AI'}
            </span>
          </div>

          {currentTurn === 'ai' && gameStatus === 'playing' && (
            <div className="text-center">
              <span className="text-emerald-400 text-sm animate-pulse">
                💭 AI가 최적의 수를 계산하고 있습니다...
              </span>
            </div>
          )}

          {gameStatus !== 'playing' && (
            <div className={`text-center font-bold text-xl p-3 rounded ${gameStatus === 'won' ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
              {gameStatus === 'won' ? '🎉 승리! 축하합니다!' : '😢 패배'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
