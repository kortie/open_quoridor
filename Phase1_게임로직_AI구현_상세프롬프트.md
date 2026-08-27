# Phase 1: 쿼리도 게임 로직 & 기본 UI - 상세 프롬프트

## 🎯 목표
보드게임의 핵심 로직 구현 + Easy/Normal AI + 기본 웹 UI

---

## 📐 보드 좌표계 정리

```
      col: 0  1  2  3  4  5  6  7  8
row 0  ┌──┬──┬──┬──┬──┬──┬──┬──┬──┐
       │  │  │  │  │P1│  │  │  │  │ P1 위치: (0, 4)
row 1  ├──┼──┼──┼──┼──┼──┼──┼──┼──┤
       │  │  │  │  │  │  │  │  │  │
row 2  ├──┼──┼──┼──┼──┼──┼──┼──┼──┤
       │  │  │  │  │  │  │  │  │  │
row 3  ├──┼──┼──┼──┼──┼──┼──┼──┼──┤
       │  │  │  │  │  │  │  │  │  │
row 4  ├──┼──┼──┼──┼──┼──┼──┼──┼──┤
       │  │  │  │  │  │  │  │  │  │
row 5  ├──┼──┼──┼──┼──┼──┼──┼──┼──┤
       │  │  │  │  │  │  │  │  │  │
row 6  ├──┼──┼──┼──┼──┼──┼──┼──┼──┤
       │  │  │  │  │  │  │  │  │  │
row 7  ├──┼──┼──┼──┼──┼──┼──┼──┼──┤
       │  │  │  │  │P2│  │  │  │  │ P2 위치: (8, 4)
row 8  └──┴──┴──┴──┴──┴──┴──┴──┴──┘

벽: 각 셀 사이에 배치
  - Horizontal: (row, col)에 (row, col+1) 셀 아래 벽
  - Vertical: (row, col)에 (row+1, col) 셀 우측 벽
```

---

## 🎮 핵심 데이터 구조

### GameState (Zustand Store)

```typescript
interface GameState {
  // 보드 상태
  board: Cell[][];
  playerPos: { row: number; col: number };
  aiPos: { row: number; col: number };
  
  // 벽 관리
  playerWallsLeft: number;      // 0-10
  aiWallsLeft: number;          // 0-10
  walls: Wall[];                // 배치된 벽 목록
  
  // 게임 진행
  currentTurn: 'player' | 'ai';
  gameStatus: 'playing' | 'won' | 'lost' | 'draw';
  moveHistory: Move[];
  
  // AI 난이도
  aiLevel: 'Easy' | 'Normal' | 'Hard' | 'VeryHard' | 'Expert';
  
  // UI 상태
  selectedCell: { row: number; col: number } | null;
  validMoves: { row: number; col: number }[];
  validWalls: Wall[];
  hoverCell: { row: number; col: number } | null;
  
  // 액션
  startGame: (level: string) => void;
  playerMove: (row: number, col: number) => void;
  playerPlaceWall: (wall: Wall) => void;
  undoMove: () => void;
  resignGame: () => void;
}

interface Cell {
  isPassable: boolean;
  walls: {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
  };
}

interface Wall {
  row: number;
  col: number;
  direction: 'horizontal' | 'vertical';
  placedBy: 'player' | 'ai';
}

interface Move {
  type: 'move' | 'placeWall';
  from?: { row: number; col: number };
  to?: { row: number; col: number };
  wall?: Wall;
  player: 'player' | 'ai';
  timestamp: number;
}
```

---

## 🧮 게임 로직 구현

### 1. 보드 초기화

```typescript
function initializeBoard(): Cell[][] {
  const board: Cell[][] = Array(9)
    .fill(null)
    .map(() =>
      Array(9)
        .fill(null)
        .map(() => ({
          isPassable: true,
          walls: {
            top: false,
            bottom: false,
            left: false,
            right: false
          }
        }))
    );
  
  return board;
}

function initializeGame(level: string) {
  return {
    board: initializeBoard(),
    playerPos: { row: 0, col: 4 },
    aiPos: { row: 8, col: 4 },
    playerWallsLeft: 10,
    aiWallsLeft: 10,
    walls: [],
    currentTurn: 'player',
    gameStatus: 'playing',
    aiLevel: level,
    moveHistory: []
  };
}
```

### 2. 유효한 이동 계산 (BFS)

```typescript
function getValidMoves(
  pos: { row: number; col: number },
  board: Cell[][],
  opponentPos: { row: number; col: number }
): Array<{ row: number; col: number }> {
  const valid: Array<{ row: number; col: number }> = [];
  const directions = [
    { dr: -1, dc: 0, name: 'up' },
    { dr: 1, dc: 0, name: 'down' },
    { dr: 0, dc: -1, name: 'left' },
    { dr: 0, dc: 1, name: 'right' }
  ];
  
  // 직선 이동
  for (const { dr, dc } of directions) {
    const newRow = pos.row + dr;
    const newCol = pos.col + dc;
    
    // 범위 체크
    if (newRow < 0 || newRow > 8 || newCol < 0 || newCol > 8) continue;
    
    // 벽 체크
    if (isWallBlocking(pos, newRow, newCol, board)) continue;
    
    // 상대 위치 체크
    if (newRow === opponentPos.row && newCol === opponentPos.col) {
      // 점프 가능성 확인
      const jumpRow = newRow + dr;
      const jumpCol = newCol + dc;
      
      if (jumpRow >= 0 && jumpRow <= 8 && jumpCol >= 0 && jumpCol <= 8) {
        if (!isWallBlocking({ row: newRow, col: newCol }, jumpRow, jumpCol, board)) {
          valid.push({ row: jumpRow, col: jumpCol });
        }
      }
    } else {
      valid.push({ row: newRow, col: newCol });
    }
  }
  
  return valid;
}

function isWallBlocking(
  from: { row: number; col: number },
  to: { row: number; col: number },
  board: Cell[][]
): boolean {
  const dr = to.row - from.row;
  const dc = to.col - from.col;
  
  if (dr === -1) return board[from.row].walls.top;      // 위로
  if (dr === 1) return board[from.row].walls.bottom;    // 아래로
  if (dc === -1) return board[from.row].walls.left;     // 왼쪽
  if (dc === 1) return board[from.row].walls.right;     // 오른쪽
  
  return false;
}
```

### 3. 벽 배치 유효성 검사

```typescript
function isValidWallPlacement(
  wall: Wall,
  board: Cell[][],
  playerPos: { row: number; col: number },
  aiPos: { row: number; col: number }
): boolean {
  // 범위 체크
  if (wall.row < 0 || wall.row > 8 || wall.col < 0 || wall.col > 8) {
    return false;
  }
  
  // 이미 벽이 있는지 체크
  if (wall.direction === 'horizontal') {
    if (board[wall.row].walls.bottom) return false;
    if (wall.col + 1 <= 8 && board[wall.row].walls.right) return false;
  } else {
    if (board[wall.row].walls.right) return false;
    if (wall.row + 1 <= 8 && board[wall.row].walls.bottom) return false;
  }
  
  // 상대를 완전히 막지 않는지 확인 (중요!)
  const testBoard = JSON.parse(JSON.stringify(board));
  applyWallToBoard(testBoard, wall);
  
  // BFS로 상대의 목표 도달 여부 확인
  const canReachGoal = canAnyPieceReachGoal(
    testBoard,
    wall.placedBy === 'player' ? aiPos : playerPos,
    wall.placedBy === 'player' ? 0 : 8  // 목표 행
  );
  
  return canReachGoal;
}

function canAnyPieceReachGoal(
  board: Cell[][],
  startPos: { row: number; col: number },
  goalRow: number
): boolean {
  const visited = new Set<string>();
  const queue = [startPos];
  
  while (queue.length > 0) {
    const { row, col } = queue.shift()!;
    const key = `${row},${col}`;
    
    if (visited.has(key)) continue;
    visited.add(key);
    
    if (row === goalRow) return true;  // 목표 도달!
    
    // 인접한 셀 탐색
    const directions = [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 }
    ];
    
    for (const { dr, dc } of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      
      if (newRow < 0 || newRow > 8 || newCol < 0 || newCol > 8) continue;
      if (visited.has(`${newRow},${newCol}`)) continue;
      if (isWallBlocking({ row, col }, { row: newRow, col: newCol }, board)) continue;
      
      queue.push({ row: newRow, col: newCol });
    }
  }
  
  return false;
}
```

### 4. 게임 이동 적용

```typescript
function applyMove(
  state: GameState,
  move: Move
): GameState {
  const newState = { ...state, moveHistory: [...state.moveHistory, move] };
  
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
  
  // 게임 종료 확인
  if (newState.playerPos.row === 8) {
    newState.gameStatus = 'won';
  } else if (newState.aiPos.row === 0) {
    newState.gameStatus = 'lost';
  }
  
  // 턴 변경
  newState.currentTurn = move.player === 'player' ? 'ai' : 'player';
  
  return newState;
}

function applyWallToBoard(board: Cell[][], wall: Wall): void {
  if (wall.direction === 'horizontal') {
    // 가로 벽: (row, col)과 (row, col+1) 사이
    board[wall.row][wall.col].walls.bottom = true;
    if (wall.col + 1 <= 8) {
      board[wall.row][wall.col + 1].walls.bottom = true;
    }
  } else {
    // 세로 벽: (row, col)과 (row+1, col) 사이
    board[wall.row][wall.col].walls.right = true;
    if (wall.row + 1 <= 8) {
      board[wall.row + 1][wall.col].walls.right = true;
    }
  }
}
```

---

## 🤖 AI 구현

### Easy AI (무작위)

```typescript
function getEasyMove(state: GameState): Move {
  const validMoves = getValidMoves(
    state.aiPos,
    state.board,
    state.playerPos
  );
  
  // 무작위 이동 선택 (거의 벽 배치 안 함)
  if (Math.random() > 0.2 && validMoves.length > 0) {
    const move = validMoves[Math.floor(Math.random() * validMoves.length)];
    return {
      type: 'move',
      to: move,
      player: 'ai',
      timestamp: Date.now()
    };
  }
  
  // 20% 확률로 벽 배치 시도
  const validWalls = getValidWallPositions(state.board, state.playerPos);
  if (validWalls.length > 0) {
    return {
      type: 'placeWall',
      wall: validWalls[Math.floor(Math.random() * validWalls.length)],
      player: 'ai',
      timestamp: Date.now()
    };
  }
  
  // 벽을 배치할 수 없으면 이동
  if (validMoves.length > 0) {
    return {
      type: 'move',
      to: validMoves[0],
      player: 'ai',
      timestamp: Date.now()
    };
  }
  
  // 모든 이동 불가능 (드물지만 처리)
  return null;
}
```

### Normal AI (탐욕법)

```typescript
function getNormalMove(state: GameState): Move {
  const validMoves = getValidMoves(
    state.aiPos,
    state.board,
    state.playerPos
  );
  
  // 목표에 가장 가까운 이동 선택
  let bestMove = validMoves[0];
  let bestDistance = calculateDistance(bestMove, { row: 0, col: 4 });
  
  for (const move of validMoves) {
    const distance = calculateDistance(move, { row: 0, col: 4 });
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMove = move;
    }
  }
  
  // 50% 확률로 플레이어 블로킹 시도
  if (Math.random() < 0.5) {
    const validWalls = getValidWallPositions(state.board, state.playerPos);
    
    // 플레이어 앞에 벽 배치
    for (const wall of validWalls) {
      if (
        (wall.direction === 'horizontal' && wall.row <= state.playerPos.row) ||
        (wall.direction === 'vertical' && wall.col <= state.playerPos.col)
      ) {
        return {
          type: 'placeWall',
          wall,
          player: 'ai',
          timestamp: Date.now()
        };
      }
    }
  }
  
  return {
    type: 'move',
    to: bestMove,
    player: 'ai',
    timestamp: Date.now()
  };
}

function calculateDistance(
  from: { row: number; col: number },
  to: { row: number; col: number }
): number {
  // 맨해튼 거리
  return Math.abs(from.row - to.row) + Math.abs(from.col - to.col);
}
```

---

## 🎨 UI 컴포넌트

### GameBoard 컴포넌트

```typescript
import React from 'react';
import { useGameStore } from '../store/gameStore';

export const GameBoard: React.FC = () => {
  const gameState = useGameStore();
  const CELL_SIZE = 40;  // 모바일: 30-40px, 데스크톱: 50-60px
  
  const handleCellClick = (row: number, col: number) => {
    if (gameState.currentTurn !== 'player') return;
    
    // 이동인지 벽 배치인지 판단
    if (gameState.validMoves.some(m => m.row === row && m.col === col)) {
      gameState.playerMove(row, col);
    }
  };
  
  const handleWallClick = (wall: Wall) => {
    if (gameState.currentTurn !== 'player') return;
    
    if (gameState.validWalls.some(
      w => w.row === wall.row && w.col === wall.col && w.direction === wall.direction
    )) {
      gameState.playerPlaceWall(wall);
    }
  };
  
  return (
    <div className="bg-[#1a1a2e] rounded-lg p-4 w-full max-w-lg">
      <svg
        width={CELL_SIZE * 9}
        height={CELL_SIZE * 9}
        className="border border-[#2a2a4e]"
      >
        {/* 배경 그리드 */}
        {Array(9)
          .fill(null)
          .map((_, row) =>
            Array(9)
              .fill(null)
              .map((_, col) => (
                <rect
                  key={`cell-${row}-${col}`}
                  x={col * CELL_SIZE}
                  y={row * CELL_SIZE}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  fill={(row + col) % 2 === 0 ? '#1f1f3a' : '#151528'}
                  stroke="#2a2a4e"
                  strokeWidth="1"
                  onClick={() => handleCellClick(row, col)}
                  className="cursor-pointer hover:opacity-80"
                />
              ))
          )}
        
        {/* 유효한 이동 표시 */}
        {gameState.validMoves.map((move, idx) => (
          <circle
            key={`valid-move-${idx}`}
            cx={move.col * CELL_SIZE + CELL_SIZE / 2}
            cy={move.row * CELL_SIZE + CELL_SIZE / 2}
            r={CELL_SIZE / 4}
            fill="#10b981"
            opacity="0.6"
          />
        ))}
        
        {/* 벽 표시 */}
        {gameState.walls.map((wall, idx) => (
          <line
            key={`wall-${idx}`}
            x1={wall.direction === 'horizontal'
              ? wall.col * CELL_SIZE
              : (wall.col + 0.5) * CELL_SIZE}
            y1={wall.direction === 'horizontal'
              ? (wall.row + 0.5) * CELL_SIZE
              : wall.row * CELL_SIZE}
            x2={wall.direction === 'horizontal'
              ? (wall.col + 2) * CELL_SIZE
              : (wall.col + 0.5) * CELL_SIZE}
            y2={wall.direction === 'horizontal'
              ? (wall.row + 0.5) * CELL_SIZE
              : (wall.row + 2) * CELL_SIZE}
            stroke={wall.placedBy === 'player' ? '#06b6d4' : '#10b981'}
            strokeWidth="3"
          />
        ))}
        
        {/* 플레이어 말 */}
        <circle
          cx={gameState.playerPos.col * CELL_SIZE + CELL_SIZE / 2}
          cy={gameState.playerPos.row * CELL_SIZE + CELL_SIZE / 2}
          r={CELL_SIZE / 3}
          fill="#06b6d4"
          stroke="#ffffff"
          strokeWidth="2"
        />
        
        {/* AI 말 */}
        <circle
          cx={gameState.aiPos.col * CELL_SIZE + CELL_SIZE / 2}
          cy={gameState.aiPos.row * CELL_SIZE + CELL_SIZE / 2}
          r={CELL_SIZE / 3}
          fill="#10b981"
          stroke="#ffffff"
          strokeWidth="2"
        />
      </svg>
      
      {/* 게임 정보 */}
      <div className="mt-4 text-white text-sm">
        <p>당신의 벽: {gameState.playerWallsLeft}</p>
        <p>AI의 벽: {gameState.aiWallsLeft}</p>
        <p>턴: {gameState.currentTurn === 'player' ? '당신' : 'AI'}</p>
      </div>
    </div>
  );
};
```

### 게임 컨트롤 버튼

```typescript
export const GameControls: React.FC = () => {
  const gameState = useGameStore();
  
  const handleActionClick = (action: 'move' | 'wall' | 'undo') => {
    // UI 상태 변경
  };
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#1a1a2e] border-t border-[#2a2a4e] p-4">
      <div className="flex gap-2 justify-center max-w-lg mx-auto">
        <button
          onClick={() => handleActionClick('move')}
          className="flex-1 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold"
        >
          이동 선택
        </button>
        <button
          onClick={() => handleActionClick('wall')}
          className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold"
        >
          벽 배치
        </button>
        <button
          onClick={() => gameState.undoMove()}
          className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold"
        >
          실행 취소
        </button>
      </div>
    </div>
  );
};
```

---

## ✅ Phase 1 체크리스트

```
게임 로직
- [ ] 보드 초기화 및 상태 관리
- [ ] 유효한 이동 계산 (BFS)
- [ ] 벽 배치 유효성 검사
- [ ] 게임 종료 감지

AI 구현
- [ ] Easy AI (무작위)
- [ ] Normal AI (탐욕법)
- [ ] AI 턴 자동 실행

UI 컴포넌트
- [ ] 게임 보드 렌더링 (SVG)
- [ ] 말 표시
- [ ] 벽 표시
- [ ] 유효한 이동 하이라이트

상태 관리
- [ ] Zustand 스토어 설정
- [ ] 게임 상태 업데이트
- [ ] 이동 이력 기록

테스트
- [ ] 로컬에서 게임 플레이 가능
- [ ] AI가 정상 동작
- [ ] 벽 배치 규칙 준수
```

---

## 🚀 다음 단계 (Phase 2)

```
- 카카오 로그인
- 게임 기록 저장
- 리더보드
```

이 Phase 1 프롬프트를 Claude에 전달하면 완전한 게임 로직을 얻을 수 있습니다!
