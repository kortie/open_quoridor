# 쿼리도 (Quoridor) - Phase 1

## 프로젝트 개요

쿼리도는 보드 게임으로, 플레이어와 AI가 9×9 격자에서 대전하는 전략 게임입니다.

### Phase 1 구현 완료 사항

✅ **게임 로직**
- 보드 초기화 및 상태 관리
- 유효한 이동 계산 (BFS)
- 벽 배치 유효성 검사
- 게임 종료 조건 감지
- 실행 취소 기능

✅ **AI 구현**
- Easy AI (무작위 이동)
- Normal AI (탐욕법 + 블로킹 전략)
- AI 턴 자동 실행

✅ **UI/UX**
- 게임 보드 렌더링 (SVG)
- 말 표시 (플레이어: 파란색, AI: 초록색)
- 벽 표시
- 유효한 이동 하이라이트
- 홈 화면 (난이도 선택)
- 게임 정보 (남은 벽, 턴 표시)

✅ **기술 스택**
- React 18 + TypeScript
- Zustand (상태관리)
- Tailwind CSS (스타일)
- Vite (빌드 도구)

---

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

### 3. 프로덕션 빌드
```bash
npm run build
npm run preview
```

---

## 게임 규칙

### 목표
- 상대방 쪽 끝에 먼저 도달하기
- 플레이어: 행 8 도달 시 승리
- AI: 행 0 도달 시 승리

### 기본 메커니즘
1. **이동**: 상/하/좌/우 1칸 이동
2. **점프**: 상대 말이 인접하면 뛰어넘기 가능
3. **벽**: 각 플레이어 10개 벽 보유 (상대를 완전히 막을 수 없음)
4. **턴**: 매턴마다 이동 또는 벽 배치 중 선택

---

## 폴더 구조

```
game/
├── src/
│   ├── components/
│   │   └── GameBoard.tsx      # 게임 보드 렌더링
│   ├── pages/
│   │   └── Home.tsx           # 홈 화면
│   ├── store/
│   │   └── gameStore.ts       # Zustand 상태 관리
│   ├── utils/
│   │   ├── gameLogic.ts       # 핵심 게임 로직
│   │   └── aiLogic.ts         # AI 알고리즘
│   ├── types/
│   │   └── index.ts           # TypeScript 타입
│   ├── styles/
│   │   └── globals.css        # 전역 스타일
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

---

## 주요 파일 설명

### `src/types/index.ts`
게임에 필요한 모든 TypeScript 인터페이스 정의:
- `Cell`: 보드의 한 칸
- `Wall`: 벽 정보
- `Position`: 좌표
- `GameState`: 게임 상태

### `src/utils/gameLogic.ts`
핵심 게임 로직:
- `initializeBoard()`: 보드 초기화
- `getValidMoves()`: 유효한 이동 계산
- `isValidWallPlacement()`: 벽 배치 검증
- `canReachGoal()`: 경로 도달 가능성 확인 (BFS)

### `src/utils/aiLogic.ts`
AI 턴 처리:
- `getEasyMove()`: 무작위 이동
- `getNormalMove()`: 탐욕법 + 블로킹 전략

### `src/store/gameStore.ts`
Zustand를 사용한 전역 상태 관리:
- 게임 상태 (보드, 위치, 벽 등)
- 게임 액션 (이동, 벽 배치, 리셋 등)

### `src/components/GameBoard.tsx`
게임 UI 렌더링:
- SVG로 보드와 말, 벽 표시
- 마우스 상호작용 처리

---

## 게임 플로우

```
1. 홈 화면
   └─ 난이도 선택 (Easy, Normal)
   └─ "게임 시작" 클릭

2. 게임 진행
   ├─ 플레이어 턴
   │  └─ 초록색 원(유효 이동) 클릭하여 이동
   ├─ AI 턴 (0.5초 딜레이 후 자동 실행)
   │  └─ 난이도에 따른 AI 이동
   └─ 반복...

3. 게임 종료
   ├─ 플레이어 승리 (행 8 도달) → "🎉 승리!"
   ├─ AI 승리 (행 0 도달) → "패배"
   └─ "새 게임" 또는 "홈으로" 버튼
```

---

## 색상 팔레트

| 요소 | 색상 | HEX |
|------|------|-----|
| 배경 | 거의 검은색 | #0f1419 |
| 카드/보드 | 어두운 보라 | #1a1a2e |
| 테두리 | 미묘한 분할선 | #2a2a4e |
| 플레이어 | 밝은 파랑 | #06b6d4 |
| AI/유효이동 | 밝은 초록 | #10b981 |
| 텍스트 | 흰색 | #ffffff |

---

## 다음 단계 (Phase 2)

- [ ] Kakao 로그인
- [ ] 게임 기록 저장
- [ ] 리더보드
- [ ] 플레이어 vs 플레이어 모드
- [ ] 더 높은 난이도 AI (Hard, VeryHard, Expert)

---

## 개발 팁

### 디버깅
브라우저 DevTools에서 React DevTools 플러그인으로 상태 확인 가능

### 성능 최적화
- SVG 렌더링으로 부드러운 애니메이션
- Zustand로 필요한 부분만 리렌더링

### 로컬 테스트
```bash
npm run dev
# localhost:3000에서 실시간 핫 리로드
```

---

**버전**: 1.0.0 (Phase 1)  
**마지막 업데이트**: 2024년 7월

## 오프라인 안드로이드 앱 (서버 없음)

AI 엔진(`backend/src/ai`)을 앱에 넣어 기기에서 Web Worker로 돌립니다. 로그인, 리더보드, 기록 저장은 오프라인 빌드에서 숨겨집니다.

```bash
cd game
npm run android:apk    # build:android → cap sync → gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

패키지명: `com.juanstudio.wallgame`.
요구 사항: Node 18 이상(Capacitor 6), JDK 17, Android SDK(`ANDROID_HOME`). 처음 빌드할 때는 `android/local.properties`에 `sdk.dir=<SDK 경로>`가 필요합니다.
엔진이 BigInt를 쓰므로 Android System WebView 67 이상이 필요합니다.
