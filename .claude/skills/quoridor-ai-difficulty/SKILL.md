---
name: quoridor-ai-difficulty
description: Use when strengthening, tuning, or re-balancing the Quoridor AI engine (backend/src/ai) or its difficulty levels — e.g. "AI가 너무 약해", "최고 난이도 어렵게", "난이도 조정", "Expert 레벨 추가", "AI 탐색 속도 개선", "평가함수 튜닝", "selfplay로 검증". Covers the 5-level ladder design, engine improvements in priority order, and the self-play acceptance gate every change must pass.
---

# Quoridor AI 난이도/강도 개선

엔진은 **TypeScript**(`backend/src/ai`)다. 스펙 문서(`quoridor-ai-spec.md`)는 C++로 적혀 있지만 따르지 않는다.
프론트엔드 플레이어 = 엔진 P1(row 0 → 8), AI = 엔진 P2(row 8 → 0), 매핑은 `backend/src/services/aiService.ts`의 `toQState`.

설계 상세(알고리즘, 파라미터, 코드 위치)는 [references/design.md](references/design.md)에 있다. 구현 전에 반드시 읽는다.

## 현재 상태 진단 (커밋 7386f58 기준, 측정값)

| 문제 | 근거 |
|---|---|
| UI가 Easy/Normal만 노출 → 사용자가 고를 수 있는 최강 AI가 depth 3 / 500ms | `game/src/pages/Home.tsx:59` |
| Hard/VeryHard/Expert가 모두 엔진 `Hard` 하나로 매핑 | `aiService.ts` `mapDifficulty` |
| 탐색 속도 약 7k nodes/s → 2초에 depth 5~6에서 멈춤 | 노드마다 `searchMoves`가 벽 후보 전체에 BFS, bigint 해시, `initZobrist()` 매 호출 |
| 루트 수 순서를 매 반복 `ordered`로 고정, TT에 best move 없음, killer/history 없음 | `search.ts` `getBestMove`/`TranspositionTable` |
| 평가함수에 tempo(차례) 항 없음, `w_op===0`일 때 `50*(d_op-d_me)` 불연속 점프 | `eval.ts` `getPhaseBonus` |
| Hard는 완전 결정론적 → 같은 수순이 반복되어 사용자가 외워서 이길 수 있음 | selfplay 6판 모두 동일한 plies(62/81) |
| 탐색이 Express 메인 스레드를 최대 2초 동안 막음 | `routes/game.ts` `/ai-move` |

## 현재 결과 요약

P0~P6을 구현했다. 게이트 결과와 A/B에서 배운 점은 design.md §8에 있다. 핵심만 적는다.
- Expert vs Baseline 90%, VeryHard vs Baseline 90%.
- Expert와 VeryHard의 간격(≥70%)은 미달이다(약 55~60%).
- 강도를 가장 크게 올린 것은 벽 가치 스케일 `w2 = 6`이었다. 깊이와 탐색 기법은 효과가 작았다.

## 목표 난이도 사다리

| UI 레벨 | 의도한 체감 | 핵심 설정 (상세는 design.md §4) |
|---|---|---|
| Easy | 처음 하는 사람도 이김 | depth 1, softmax 노이즈 큼, 벽은 이득이 클 때만 확률적으로 |
| Normal | 규칙을 아는 사람과 비등 | depth 2, 노이즈 중간 |
| Hard | 지금의 Hard보다 조금 강함 | ID ≤ depth 4, 800ms, 노이즈 약함 |
| VeryHard | 숙련자도 자주 짐 | 개선 엔진 전체, 1.5s, 노이즈 없음 |
| Expert | 숙련자도 거의 못 이김 | 개선 엔진 + 엔드게임 솔버 + 벽 quiescence + 3s + 동점 랜덤 |

강한 레벨은 **탐색과 평가 자체를 강하게** 만든다. 약한 레벨은 그 강한 엔진에 깊이/시간 제한과 노이즈를 걸어서 만든다.
엔진을 레벨별로 따로 두지 않는다. 엔진은 하나이고, 레벨은 `DifficultyConfig` 파라미터로만 나눈다.

## 작업 순서 (우선순위대로, 단계마다 검증)

1. **베이스라인 고정**: 시작 전에 `backend/src/ai`를 `backend/tools/baseline_ai/`로 복사한다(import 경로만 고침). 이후 모든 비교는 이 스냅샷과 한다.
2. **P0 레벨 배선**: `DifficultyLevel`을 5단계로 확장하고, `mapDifficulty`는 1:1로 매핑하고, `Home.tsx`에 5개 버튼을 노출한다. `selfplay.ts`도 5단계와 `Baseline`을 받게 한다.
3. **P1 속도**(design.md §1): 기능은 그대로 두고 nps만 올린다. 이 단계에서는 같은 depth로 돌렸을 때 **같은 수**가 나와야 한다(회귀 테스트).
4. **P2 탐색**(§2): PVS, TT move, killer/history, 루트 재정렬, aspiration.
5. **P3 평가**(§3): tempo, 벽 가치, 상대 경로 폭, 무벽 레이스 정확 판정.
6. **P4 선택적 확장**(§2.5): 벽 quiescence, 벽 소진 시 깊이 연장.
7. **P5 레벨 파라미터 + 노이즈**(§4): 사다리를 맞춘다.
8. **P6 서비스**(§5): `worker_threads`로 탐색을 분리하고 타임아웃 시 fallback을 둔다.
9. **P7 튜닝**(§6, 선택): 가중치를 self-play SPSA로 맞춘다.

단계 하나를 끝내면 `npm test`를 돌리고 아래 게이트를 통과시킨 다음 커밋한다. 커밋 하나에는 단계 하나만 담는다.

## 검증 게이트 (필수)

selfplay는 같은 랜덤 오프닝(기본 4 ply, depth 1 상위 3수 중 선택)으로 흑백을 바꿔 두 판씩 둔다. 이렇게 하지 않으면 결정론적 엔진끼리 같은 판만 반복한다.

```bash
cd backend
npm run regress -- 4 20                        # 고정 depth에서 베이스라인과 수 일치율 + nps (P1 게이트, 이후엔 참고용)
npm run selfplay -- <A> <B> <games> <seed>     # 단일 프로세스, 판별 로그
npm run gauntlet -- <A> <B> 40 12              # 병렬 프로세스로 집계 (12 jobs면 VeryHard vs Baseline 40판이 수 분)
npm test                                       # 규칙 대조(ai.state) + 전술 국면(ai.search 6~10)
```

gauntlet의 jobs는 코어 수보다 충분히 작게 둔다. 시간 제한 탐색이라 CPU 경합이 생기면 엔진이 약해져서 결과가 왜곡된다.

| 검사 | 통과 기준 |
|---|---|
| 속도(P1 후) | 초기 국면 nps ≥ 베이스라인 × 5 (베이스라인 약 7k, P1 결과 약 43k), 같은 depth에서 베이스라인과 같은 수 |
| 강도 향상 | 새 `VeryHard` vs `Baseline`(기존 Hard) ≥ 80%, `Expert` vs `Baseline` ≥ 90% (40판 이상) |
| 사다리 단조성 | 인접 레벨끼리 상위 레벨 승률 ≥ 70% (Easy<Normal<Hard<VeryHard<Expert) |
| Easy 하한 | Easy vs Random ≥ 95% (Easy도 목표를 향해 간다) |
| 지연 | 레벨별 수당 최대 시간 ≤ timeLimit + 150ms |
| 정합성 | 엔진이 낸 수가 항상 프론트의 `validMoves`/`validWalls` 안에 있음 (`toMove` null 비율 0) |

결과 표(승률, 평균/최대 ms, nps)를 커밋 메시지나 PR 본문에 붙인다. 기준에 못 미치면 다음 단계로 넘어가지 말고 원인부터 찾는다.

## 하지 말 것

- 평가 가중치를 감으로 바꾸고 selfplay 없이 "강해졌다"고 보고하지 않는다.
- 약한 레벨을 만들려고 엔진 코드를 분기/복제하지 않는다. 설정값만 쓴다.
- Expert에 노이즈를 넣지 않는다. 대신 점수가 사실상 같은(δ 이내) 수 중에서만 랜덤으로 고른다.
- 벽 합법성 규칙(`board.ts` `wallConflicts`, 경로 보존)을 속도 때문에 느슨하게 만들지 않는다. 프론트 `gameLogic.ts`와 결과가 달라지면 `toMove`가 null을 내고 fallback으로 빠진다.
- `dist/`를 직접 고치지 않는다. 계측이 필요하면 `searchBestMove`가 돌려주는 `{depth, nodes, elapsedMs, root}`를 쓴다.
- 평가와 수 순서에 상대 폰을 고려한 거리(`wallsDistance(..., opCell)`)를 쓰지 않는다. 그 BFS는 멀리 있는 상대 폰도 제자리에서 점프할 수 있는 장애물로 보기 때문에, 깊이 1에서 전진과 옆걸음이 같은 점수가 된다. 평가에는 폰을 무시한 거리(`opp = -1`)를 쓰고, 벽 합법성에만 규칙대로 폰을 고려한 도달성을 쓴다.
- `tools/baseline_ai/`는 고치지 않는다(`getBestMove`의 `overrides` 인자만 예외).

## 구현 위치 (현재)

| 파일 | 역할 |
|---|---|
| `src/ai/state.ts` | 탐색용 상태 `EState`(number 벽, 32비트 증분 Zobrist), 폰 수, 벽 합법성 |
| `src/ai/pathfind.ts` | 행 마스크 BFS(`wallsDistance/wallsPath/wallsReachable/wallsCorridor`) + 기존 QState API |
| `src/ai/eval.ts` | `evaluateState`(tempo, 오목한 벽 가치, 회랑 폭), `knownOutcome`(벽 소진 레이스 판정) |
| `src/ai/search.ts` | PVS, typed-array TT, killer/history, 공격·방어 벽, quiescence, 시간 관리, `pickMove` 노이즈 |
| `src/ai/config.ts` | 레벨별 `DifficultyConfig` — 난이도 조정은 여기서만 한다 |
| `src/services/aiService.ts`, `aiWorker.ts` | worker_threads 탐색, 큐/타임아웃/fallback (tsx 개발 모드에서는 인라인) |
