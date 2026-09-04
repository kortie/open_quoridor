# Quoridor AI 엔진 구현 명세서 (Heuristic + Search)

> 이 문서는 Claude Code에 그대로 전달하여 구현을 지시하기 위한 명세서입니다.
> 각 Phase를 순서대로 진행하며, Phase마다 명시된 완료 조건(Acceptance Criteria)을 테스트로 검증한 뒤 다음 단계로 넘어가세요.

---

## 0. 프로젝트 개요

- **목표**: LLM 없이 동작하는 Quoridor AI를 C++로 구현하고, 게임 클라이언트에서 호출 가능한 shared library(.so / .dll / .dylib)로 빌드한다.
- **핵심 설계**: 최단경로 기반 휴리스틱 평가함수 + Iterative Deepening Alpha-Beta 탐색 (추후 MCTS로 교체 가능한 구조).
- **언어/빌드**: C++17, CMake. 외부 의존성 없음 (표준 라이브러리만 사용).
- **디렉터리 구조**:

```
quoridor-ai/
├── CMakeLists.txt
├── include/
│   └── quoridor_ai.h        # 공개 C API (extern "C")
├── src/
│   ├── board.hpp / .cpp      # 게임 상태, 규칙, 수 생성
│   ├── pathfind.hpp / .cpp   # BFS / A* 최단경로
│   ├── eval.hpp / .cpp       # 휴리스틱 평가함수
│   ├── search.hpp / .cpp     # Alpha-Beta 탐색
│   └── api.cpp               # C API 구현
└── tests/
    ├── test_board.cpp
    ├── test_pathfind.cpp
    ├── test_eval.cpp
    └── test_search.cpp
```

---

## 1. 게임 규칙 정의 (구현 기준)

- 보드: 9×9 칸. 좌표는 (row, col), 0-indexed. row 0 = Player 1(P1) 시작 진영, row 8 = Player 2(P2) 시작 진영.
- P1 시작: (0, 4), 목표: row 8 도달. P2 시작: (8, 4), 목표: row 0 도달.
- 각 플레이어는 벽 10개 보유.
- 벽: 길이 2칸, 가로(H) 또는 세로(V). 벽 앵커 좌표는 8×8 그리드 (0..7, 0..7).
  - H벽 (r, c): 칸 (r,c)-(r+1,c) 사이와 (r,c+1)-(r+1,c+1) 사이를 막음.
  - V벽 (r, c): 칸 (r,c)-(r,c+1) 사이와 (r+1,c)-(r+1,c+1) 사이를 막음.
- 벽 설치 제약:
  1. 기존 벽과 겹치거나 교차 불가 (같은 앵커에 H+V 동시 불가, H벽은 좌우 인접 H벽과 절반 겹침 불가, V벽 동일).
  2. **양쪽 플레이어 모두 목표 지점까지의 경로가 반드시 1개 이상 남아야 함** (BFS로 검증).
- 폰 이동: 상하좌우 1칸. 상대 폰과 인접 시 점프 규칙:
  - 상대 폰 너머가 비어있고 벽이 없으면 직선 점프.
  - 직선 점프가 벽/보드 경계로 막히면 대각선 이동 허용.

### 행동(Action) 인코딩 — 고정 인덱스 0..139

| 범위 | 의미 |
|---|---|
| 0..11 | 폰 이동 (N, S, E, W, NN, SS, EE, WW, NE, NW, SE, SW) |
| 12..75 | H벽 설치, index = 12 + r*8 + c |
| 76..139 | V벽 설치, index = 76 + r*8 + c |

---

## 2. 휴리스틱 평가함수 설계 (핵심)

평가는 항상 **현재 수를 두는 플레이어(me) 관점**의 점수를 반환한다. 클수록 유리.

### 2.1 기본 항 (feature)

| 기호 | 정의 | 계산 방법 |
|---|---|---|
| `D_me` | 내 폰의 목표까지 최단 거리 | BFS (벽 반영) |
| `D_op` | 상대 폰의 목표까지 최단 거리 | BFS |
| `W_me` | 내 남은 벽 수 | 상태에서 조회 |
| `W_op` | 상대 남은 벽 수 | 상태에서 조회 |
| `M_me` | 내 폰의 현재 이동 가능 수 개수 (mobility) | 수 생성기 |
| `P_me` | 내 최단경로의 "폭": 최단거리 == D_me 인 경로가 지나는 서로 다른 칸 수 | BFS 결과에서 역추적 |

### 2.2 평가식

```
score = w1 * (D_op - D_me)                 // 경로 우위 (가장 중요)
      + w2 * (W_me - W_op)                 // 벽 자원 우위
      + w3 * (M_me / 5.0)                  // 기동성 (정규화)
      + w4 * min(P_me, 4)                  // 경로 다양성 (벽으로 막히기 어려움)
      + phase_bonus
```

**초기 가중치** (테스트 후 튜닝 대상, config로 분리할 것):

```
w1 = 10.0
w2 = 1.5
w3 = 0.5
w4 = 0.8
```

### 2.3 게임 단계별 보정 (`phase_bonus`)

- **초반** (양측 벽 소모 합계 ≤ 4): 벽 아끼기 선호 → `phase_bonus += 0.5 * W_me`
- **종반 판정**: `D_me <= W_op` 이면 상대가 벽으로 방해할 여지가 있음. 반대로 **상대 벽이 0이면 순수 경주** → `D_op - D_me`만으로 승패 확정 가능하므로 `w1`을 100으로 승격.
- **승리/패배 확정 상태**: `D_me == 0` → `+INF(=100000)`, `D_op == 0` → `-INF`. 탐색에서 depth 보정(`INF - ply`)으로 빠른 승리 선호.

### 2.4 벽 후보 가지치기 (branching factor 축소 — 필수)

128개 벽 후보를 전부 탐색하면 느리다. 다음 조건 중 하나를 만족하는 벽만 후보로 남긴다:

1. 상대 폰의 현재 최단경로 위 칸에 인접한 벽 (경로 방해용).
2. 두 폰 중 하나로부터 체비쇼프 거리 2 이내의 벽.
3. 기존 설치된 벽에 인접한 벽 (벽 연결로 미로 형성).

→ 통상 후보가 128개에서 20~40개로 줄어든다. 단, 후보 벽 각각에 대해 "경로 차단 아님" 검증(BFS)을 반드시 수행.

### 2.5 수 정렬 (move ordering — alpha-beta 효율의 핵심)

1. 내 최단경로를 따라가는 폰 이동 (1순위)
2. 설치 시 `D_op` 증가량이 큰 벽 순 (얕은 1-ply 평가로 정렬)
3. 나머지 이동

---

## 3. 탐색 알고리즘

### 3.1 Iterative Deepening Alpha-Beta

```
function get_best_move(state, time_limit_ms, max_depth):
    best = null
    for depth in 1..max_depth:
        (move, score) = alphabeta_root(state, depth)
        if 시간 초과: break
        best = move
        if score >= WIN_THRESHOLD: break   // 승리 수 발견 시 즉시 종료
    return best
```

- 시간 관리: `std::chrono` 기반, 매 노드 진입 시가 아닌 1024노드마다 체크.
- **Transposition Table**: Zobrist hashing (폰 위치 2개 + 벽 비트보드 + 턴). 크기 2^20 엔트리, replace-always.
- 벽 상태는 `uint64_t` 2개(H벽 64비트 + V벽 64비트)의 비트보드로 표현하여 해싱/복사 비용 최소화.

### 3.2 난이도 프리셋

| 난이도 | max_depth | time_limit | 추가 규칙 |
|---|---|---|---|
| Easy | 1 | 100ms | 30% 확률로 상위 3개 수 중 랜덤 선택 |
| Normal | 3 | 500ms | 없음 |
| Hard | 5+ | 2000ms | 없음 (시간 내 iterative deepening) |

---

## 4. 공개 C API (`include/quoridor_ai.h`)

FFI(Dart/Unity/JNI 등)에서 바로 붙일 수 있도록 순수 C 인터페이스로 노출한다.

```c
#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    int p1_row, p1_col;
    int p2_row, p2_col;
    int p1_walls, p2_walls;
    unsigned long long h_walls;  // 8x8 비트보드, bit = r*8+c
    unsigned long long v_walls;
    int turn;                    // 0 = P1, 1 = P2
} QState;

// 최선 수 계산. 반환값: action index (0..139), 오류 시 -1
int q_get_best_move(const QState* state, int difficulty /*0,1,2*/);

// 수 적용. 반환값: 0 성공, -1 불법 수
int q_apply_move(QState* state, int action);

// 합법 수 조회. out은 길이 140 배열, 1이면 합법. 반환값: 합법 수 개수
int q_legal_moves(const QState* state, int* out);

// 게임 종료 판정. 반환값: 0 진행중, 1 = P1 승, 2 = P2 승
int q_get_winner(const QState* state);

#ifdef __cplusplus
}
#endif
```

---

## 5. 구현 순서 (Phase별 지시)

### Phase 1 — 게임 규칙 엔진
`board.hpp/cpp` 구현: QState 정의, 폰 이동 생성(점프 포함), 벽 설치 검증(겹침/교차), `q_apply_move`, `q_get_winner`.

**완료 조건**:
- [ ] 초기 상태에서 P1 합법 수 = 폰 이동 3개 + 벽 128개
- [ ] 점프/대각선 점프 케이스 단위 테스트 각 1개 이상 통과
- [ ] 벽 겹침·교차 거부 테스트 통과

### Phase 2 — 경로 탐색
`pathfind.hpp/cpp`: 벽 비트보드를 반영한 BFS. 반환: 최단거리 + 최단경로 칸 집합(P_me 계산용). 목표는 "해당 row의 아무 칸"이므로 멀티 타깃 BFS.

**완료 조건**:
- [ ] 빈 보드에서 D_me = 8
- [ ] 경로를 완전히 차단하는 벽 설치가 거부되는 테스트 통과
- [ ] 폰 위치 무작위 + 벽 10개 무작위 상태 1000개에서 crash 없음

### Phase 3 — 평가함수
`eval.hpp/cpp`: 2장의 평가식 구현. 가중치는 struct로 분리해 런타임 주입 가능하게.

**완료 조건**:
- [ ] "내가 1칸 남고 상대 벽 0" 상태에서 score ≥ WIN 수준
- [ ] 대칭 상태(미러링)에서 P1/P2 평가가 부호만 반대로 동일

### Phase 4 — 탐색
`search.hpp/cpp`: iterative deepening alpha-beta + TT + 수 정렬 + 벽 후보 가지치기 + 시간 제한.

**완료 조건**:
- [ ] Normal(depth 3)이 랜덤 플레이어에 100전 100승
- [ ] Hard가 Normal에 50전 기준 승률 ≥ 70%
- [ ] Hard 1수 계산이 데스크톱에서 2초, 릴리즈 빌드 기준 초과하지 않음

### Phase 5 — 라이브러리 빌드 & 셀프플레이 CLI
- CMake로 shared library 타깃 + 정적 링크 옵션.
- `tools/selfplay.cpp`: 두 난이도를 대전시켜 승률/평균 수 계산 시간을 출력하는 CLI (튜닝용).

**완료 조건**:
- [ ] `cmake --build` 한 번으로 .so/.dll 산출
- [ ] selfplay CLI로 Easy vs Hard 승률 리포트 출력

---

## 6. 테스트/품질 규칙

- 테스트 프레임워크: 별도 의존성 없이 `assert` 기반 자체 러너 또는 (허용 시) Catch2 single-header.
- 모든 무작위 테스트는 고정 seed 사용.
- `-Wall -Wextra -Werror`, 릴리즈는 `-O2`.
- 전역 가변 상태 금지 — 스레드에서 동시 호출 가능해야 함 (TT는 인스턴스 단위 또는 thread_local).

## 7. 향후 확장 (지금은 구현하지 말 것)

- MCTS 교체: `search.hpp`의 인터페이스(`get_best_move(state, config)`)를 유지한 채 내부만 교체.
- AlphaZero-style: 평가함수 자리에 ONNX 신경망 value/policy 주입.
