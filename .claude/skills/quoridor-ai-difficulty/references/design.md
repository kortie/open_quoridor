# Quoridor AI 강화 설계

대상 코드: `backend/src/ai/{board,pathfind,eval,search,zobrist,config,types}.ts`, `backend/src/services/aiService.ts`, `backend/tools/selfplay.ts`, `game/src/pages/Home.tsx`.

기존 구조(Iterative Deepening Alpha-Beta와 최단경로 휴리스틱)는 그대로 둔다. Quoridor는 분기 수가 많지만(폰 수 ≤5개, 벽 수 ≤128개) 벽 후보를 좁히면 alpha-beta가 잘 듣는 게임이다. MCTS로 갈아타지 않고 지금 엔진을 빠르고 정확하게 만드는 쪽이 비용 대비 효과가 크다.

---

## §1 속도 (P1): 목표는 베이스라인 nps의 5배 이상

측정: 초기 국면에서 약 7k nodes/s, 2s 제한에 depth 5~6. 비용 대부분은 `searchMoves`에서 나온다.

### 1.1 벽 후보 BFS 줄이기 (효과가 가장 큼)
- **상대의 현재 최단경로를 끊지 않는 벽은 D_op를 늘릴 수 없다.** 벽은 간선을 지우기만 하므로 기존 최단경로가 그대로 남는다. 따라서 `cutsPath(wall, opPath.cells)`가 false인 후보는 BFS 없이 버린다. 지금은 `nearPawn`/`touchesExistingWall` 후보까지 전부 BFS를 돌린 뒤에 `opGain <= 0`으로 버리고 있다.
- 같은 원리로 내 최단경로를 끊지 않는 벽은 `ΔD_me = 0`이 확정이므로 내 BFS도 생략한다.
- 후보를 넓게 보려면 단일 경로 대신 **최단경로 회랑**을 쓴다. 회랑은 `getPathDiversity`가 이미 계산하는 `fwd+bwd == best`인 칸들이다. 이 회랑의 간선을 덮는 벽만 후보로 삼는다.

### 1.2 해시와 상태 표현
- `initZobrist()`를 `getBestMove`마다 호출하지 말고 모듈 로드 시 한 번만 호출한다(플래그로 막는다).
- 핫패스에서 bigint를 없앤다. 엔진 내부 상태는 `Walls`(32비트 number 4개)로 들고, `QState`(bigint)와는 `getBestMove` 입구에서 한 번만 변환한다. Zobrist도 32비트 두 개(`hashLo`, `hashHi`)로 바꾸고 `applyMove`에서 증분 갱신한다.
- TT를 `Map<bigint>`에서 typed-array 해시테이블로 바꾼다. 크기는 2^20 슬롯, 필드는 `keyLo/keyHi:Uint32`, `depth:Int8`, `score:Int32`, `bound:Uint8`, `move:Uint8`. 지금처럼 가득 차면 `clear()`하는 방식은 버리고 depth-preferred와 always-replace 2-bucket으로 교체한다.

### 1.3 중복 계산 제거
- depth==1 노드의 자식은 곧 리프다. 이 노드에서 순서 결정용으로 계산한 자식 거리(`getDistance(next, op)`)를 리프 평가가 다시 계산하지 않도록, 자식 평가에 넘기거나 작은 캐시에 둔다.
- `getPathDiversity`(BFS 2회)는 점수 차가 큰 리프(`|D_op - D_me| ≥ 3`)에서는 생략해도 순위가 거의 바뀌지 않는다. lazy eval로 처리한다.

### 1.4 회귀 기준
P1에서는 탐색 결과가 바뀌면 안 된다. 고정 국면 10개를 fixture로 두고, 고정 depth(시간 무제한)에서 베이스라인과 **같은 수와 같은 점수**가 나오는지 테스트로 확인한다. 1.1의 후보 축소 때문에 결과가 달라지면 그 국면을 직접 분석해서 원인을 문서로 남긴다.

---

## §2 탐색 (P2, P4)

### 2.1 Negamax + PVS
`alphabeta`를 negamax로 정리하고 PVS를 넣는다. 첫 수는 full window로, 나머지 수는 null window로 탐색하고 fail-high가 나면 재탐색한다.

### 2.2 수 순서
다음 순서로 정렬한다.
1. TT best move
2. 즉시 승리하는 폰 수
3. 최단경로를 줄이는 폰 수
4. killer move (ply당 2개)
5. 벽: `gain = ΔD_op − ΔD_me` 내림차순, 동점이면 history 점수로
6. 나머지 폰 수

history 테이블은 `[side][action 0..139]`로 둔다.

### 2.3 루트
- **버그성 비효율**: `getBestMove`가 매 반복 `searchRoot(state, depth, ordered, s)`로 처음 정렬한 순서를 그대로 쓴다. 직전 반복의 `best` 순서로 다시 정렬해서 넘겨야 PV-first가 된다.
- aspiration window: 직전 점수 ± 15(w1=10 기준으로 1.5칸)로 시작하고, 실패하면 창을 넓혀 재탐색한다.
- 시간 초과로 끊긴 반복은 지금은 통째로 버린다. 새 depth에서 첫 루트 수(직전 best)를 끝까지 봤다면, 그때까지 그보다 좋게 나온 수는 믿어도 된다. 그 결과를 채택한다.
- 시간 관리(VeryHard 이상): best move가 직전 반복에서 바뀌었으면 timeLimit의 1.5배까지 연장한다. 2등 수와 점수 차가 크면(≥ 30) 50% 시점에 조기 종료한다.

### 2.4 벽 후보 구성
- **공격 벽**: 상대 회랑을 끊는 벽을 gain 순으로 정렬해 상위 N개를 쓴다(N은 레벨별, §4).
- **방어 벽**(VeryHard 이상, ply ≤ 1에서만): 내 회랑 옆에 두는 벽 중에 `ΔD_me = 0`이면서 상대가 다음 수에 둘 수 있는 최선 공격 벽의 gain을 줄이는 벽이다. 상위 4개만 쓴다. 지금 엔진은 `opGain <= 0`인 벽을 전부 버리기 때문에 방어 수를 아예 보지 못한다.
- 첫 몇 수에 벽을 낭비하지 않도록, 양쪽 모두 벽을 하나도 안 썼고 `D_op ≥ 6`이면 공격 벽 후보를 gain ≥ 2로 제한한다.

### 2.5 선택적 확장
- **벽 quiescence**: depth 0에서 stand-pat(= eval)을 하한으로 두고, 차례인 쪽의 gain ≥ 2인 공격 벽 상위 3개만 더 본다. 최대 1 ply(VeryHard) 또는 2 ply(Expert). Quoridor는 언제나 폰을 움직일 수 있으므로 stand-pat이 성립한다. 이게 없으면 "다음 수에 상대가 벽으로 3칸을 늘리는" 수를 horizon 밖에서 놓친다.
- **벽 소진 연장**: 한쪽이 벽 0개이면 그쪽 노드의 분기는 폰 수(≤5)뿐이다. 이 경우 depth를 줄이지 않는 연장을 ply당 최대 1회, 탐색당 총 8회까지 허용한다.

### 2.6 엔드게임 판정 (Hard 이상)
- **양쪽 모두 벽 0개**: 순수 레이스다. 차례인 쪽은 `D_me ≤ D_op`이면 이긴다. `|D_me − D_op| ≥ 2`이면 점프로 뒤집힐 수 없으므로 즉시 확정 점수 `±(WIN_THRESHOLD − ply − 거리)`를 반환한다. 차이가 1 이하이면 폰끼리 마주칠 수 있으므로 탐색을 계속한다(분기 ≤5라 싸다).
- **상대만 벽 0개**: 상대는 내 거리를 늘릴 수 없다. 내 차례에 `D_me ≤ D_op`이면 사실상 승리이므로 확정 점수에 가까운 값(WIN_THRESHOLD − 1000 − ply)을 준다.

---

## §3 평가함수 (P3)

모든 항은 지금처럼 차례인 쪽(me) 관점으로 계산한다. 가중치 단위는 `w1 = 10` = 1칸이다.

```
score = w1 * (D_op − D_me)
      + tempo                              // 차례인 쪽 보너스, 기본 0.5*w1
      + V(W_me) − V(W_op)                  // 벽 가치, 오목 함수
      + w4 * min(P_me, 4) − w5 * min(P_op, 4)   // 경로 폭: 내 것은 넓게, 상대 것은 좁게
      + w3 * (M_me / 5)
      + urgency(D_me, D_op)
```

- **tempo**: 같은 거리라면 차례인 쪽이 레이스에서 이긴다. 이 항이 없으면 홀수 depth와 짝수 depth의 점수가 출렁이고 aspiration이 자주 실패한다.
- **V(w)**: 벽 하나의 가치는 개수가 줄수록 커진다. 예: `V = [0, 6, 11, 15, 18, 20.5, 22.5, 24, 25, 25.5, 26]`. 상대 거리가 짧을수록 남은 벽이 실제로 쓰일 기회가 적으므로 `V(W_me) *= clamp(D_op / 4, 0.5, 1)`로 줄인다.
- **P_op 항**: 상대 회랑이 좁으면 벽 한 개로 크게 늘릴 수 있다. 지금은 P_me만 보고 있다.
- **urgency**: 기존 `getPhaseBonus`의 `50 * (d_op − d_me)` 불연속 점프를 없애고 연속 함수로 바꾼다. 예: `D_op ≤ 3`이고 내가 벽이 있으면 `+k * (4 − D_op)`, `D_me ≤ 3`이면 `+k * (4 − D_me)`.
- 무한 거리(불법 상태)는 지금처럼 승패 점수로 처리한다.

모든 신규 항은 `EvalWeights`에 넣어서 §6 튜닝 대상이 되게 한다. eval 테스트(`tests/ai.eval.test.ts`)에는 "같은 거리에서 차례인 쪽이 유리", "벽 1개 남았을 때가 10개일 때보다 개당 가치가 큼" 같은 단조성 테스트를 추가한다.

---

## §4 레벨 파라미터 (P5)

`types.ts`의 `DifficultyLevel = 'Easy' | 'Normal' | 'Hard' | 'VeryHard' | 'Expert'`. `DifficultyConfig`를 확장한다.

| 필드 | Easy | Normal | Hard | VeryHard | Expert |
|---|---|---|---|---|---|
| maxDepth | 1 | 2 | 4 | 64 | 64 |
| timeLimit (ms) | 150 | 300 | 800 | 1500 | 3000 |
| softmaxT (eval 단위) | 12 | 5 | 1.5 | 0 | 0 |
| tieDelta (동점 랜덤 폭) | – | – | – | 0.5 | 0.5 |
| wallCandidates | 6 | 10 | 16 | 20 | 24 |
| defensiveWalls | 0 | 0 | 0 | 4 | 4 |
| wallUseProb (벽 수 고려 확률) | 0.4 | 0.8 | 1 | 1 | 1 |
| quiescencePlies | 0 | 0 | 0 | 1 | 2 |
| endgameSolver | ✗ | ✗ | ✓ | ✓ | ✓ |
| timeExtension | ✗ | ✗ | ✗ | ✓ | ✓ |
| evalFeatures | 거리+벽 | 전체 | 전체 | 전체 | 전체 |

- **softmax 노이즈**: 루트 결과 `s_i`에 대해 `p_i ∝ exp((s_i − s_max) / T)`로 뽑는다. 지금의 "30% 확률로 상위 3개 중 균등 선택"보다 자연스럽다. 큰 실수는 드물고, 비슷한 수 사이에서만 흔들린다. T=12면 대략 1칸 손해 수도 고르는 수준이다.
- **모든 레벨 공통**: 즉시 이기는 수가 있으면 노이즈 없이 그 수를 둔다. Easy가 결승선 앞에서 옆으로 가면 버그처럼 보인다.
- **tieDelta**: VeryHard 이상은 최고점에서 δ 이내인 수 중에서만 랜덤으로 고른다. 강도는 거의 그대로이면서 같은 수순을 외워서 이기는 공략을 막는다.
- **wallUseProb**: Easy/Normal은 이 확률로만 벽 수를 후보에 넣는다. 그래서 벽을 "가끔 잊는다".
- 레벨 수치는 §7 게이트(인접 레벨 ≥ 70%)를 맞추도록 조정한다. 위 표는 시작값이다.

배선:
- `aiService.ts` `mapDifficulty`: 5단계를 1:1로 매핑한다.
- `Home.tsx:59`: `['Easy','Normal','Hard','VeryHard','Expert']`, 라벨은 🟢 쉬움 / 🟡 보통 / 🟠 어려움 / 🔴 매우 어려움 / 💀 전문가. grid를 `grid-cols-2`에서 5개가 들어가는 배치로 바꾼다.
- 점수 테이블(`gameService.ts` `levelPoints`)은 이미 5단계라 수정할 필요가 없다.

---

## §5 서비스 통합 (P6)

- 탐색을 `worker_threads` 워커 1개(필요하면 풀 2개)로 옮긴다. 이렇게 해야 Expert 3s 탐색이 진행되는 동안에도 Express가 다른 요청(로그인, 리더보드)을 처리한다. `QState`의 bigint는 structured clone으로 그대로 전달된다.
- 하드 타임아웃은 `timeLimit + 500ms`로 둔다. 넘으면 워커를 종료하고 다시 띄운 뒤, 메인 스레드에서 depth 2로 빠르게 탐색한 수를 반환한다. `fallbackMove`(한 칸 전진)는 그다음 최후 수단으로만 쓴다.
- 워커가 바쁘면 요청을 큐에 넣는다. 큐 길이가 2 이상이면 Expert 시간을 절반으로 줄인다. 이 사실은 로그로만 남긴다.
- 프론트 `aiLogic.ts`의 fetch에는 타임아웃이 없다. `AbortController`로 `timeLimit + 2s`를 건다.

---

## §6 가중치 튜닝 (P7, 선택)

- 대상: `w1..w5`, tempo, `V` 테이블 스케일, urgency `k`.
- 방법: SPSA. 반복마다 θ±cΔ 두 엔진으로 빠른 시간 제한(100ms/수) selfplay를 100판 돌리고 승률 차로 θ를 갱신한다. 50~100회 반복한다.
- 스크립트는 `backend/tools/tune.ts`에 두고, 결과는 `config.ts`의 기본 가중치로 반영한다. 반영 후 §7 게이트를 다시 돌린다.
- 오래 걸린다(수 시간). 사용자 동의 없이 백그라운드로 돌리지 않는다.

---

## §7 selfplay 도구 확장

`backend/tools/selfplay.ts`:
- `parsePlayer`가 5단계, `Random`, `Baseline`(=`tools/baseline_ai`의 Hard)을 받게 한다.
- `--open N`: 첫 N ply(기본 4)를 seed 기반으로 해당 엔진의 depth 1 상위 3수 중에서 랜덤으로 고른다. 지금은 결정론적 엔진끼리 6판을 둬도 사실상 2판밖에 안 된다.
- 결과에 nps(가능하면 `getBestMove`가 `{move, depth, nodes}`를 반환하는 디버그 변형을 export해서 사용)와 평균 도달 depth를 출력한다.
- `--json`: 요약을 JSON으로 출력해서 PR 본문 표를 만드는 데 쓴다.

전술 fixture 테스트(`tests/ai.search.test.ts`에 추가):
1. 상대가 목표까지 1칸이고 나는 멀 때: 상대 거리를 늘리는 벽을 둔다.
2. 양쪽 벽이 0개이고 내가 레이스에서 이길 때: 최단경로로 전진한다.
3. 초기 국면 6 ply 동안 VeryHard가 쓴 벽은 1개 이하다.
4. 상대가 다음 수에 gain ≥ 3짜리 벽을 둘 수 있을 때: Expert가 방어 수를 두거나 레이스 우위를 유지한다.
