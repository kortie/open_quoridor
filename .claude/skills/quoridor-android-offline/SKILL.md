---
name: quoridor-android-offline
description: Use when building, changing, or debugging the serverless Android app of this Quoridor game — the Capacitor wrapper around game/ that runs the AI engine (backend/src/ai) on-device in a Web Worker. Triggers: "안드로이드 앱", "APK 빌드", "오프라인 모드", "서버 없이", "Capacitor", "앱에서 AI가 안 움직여", "android build 실패".
---

# Quoridor 오프라인 안드로이드 앱

이 앱은 **서버 없이** 동작한다. 웹 프론트(`game/`)를 Capacitor로 감싸고, 백엔드가 쓰는 같은 AI 엔진 소스(`backend/src/ai`)를 앱 번들에 넣어 Web Worker에서 돌린다. 엔진 코드는 한 벌만 둔다. Kotlin이나 JS로 포팅해서 복제하지 않는다.

## 구조

```
backend/src/ai/            # 엔진 (단일 소스). 브라우저/Node 양쪽에서 돌아야 함 — node: 모듈 import 금지
backend/src/ai/adapter.ts  # 프론트 요청 형태(AIDecisionRequest) <-> QState/Action 변환. 서버와 앱이 공유
game/src/engine/           # 앱 전용: aiWorker.ts(Web Worker), localAi.ts(워커 호출 + 타임아웃 + fallback)
game/src/config.ts         # OFFLINE = import.meta.env.VITE_OFFLINE === 'true'
game/.env.android          # VITE_OFFLINE=true  (vite build --mode android)
game/capacitor.config.ts   # appId com.knoxmatrix.quoridor, webDir dist
game/android/              # Capacitor가 생성한 Gradle 프로젝트 (커밋함, build 산출물은 .gitignore)
```

- `vite.config.ts`의 alias `@engine` → `../backend/src/ai`. 엔진은 `./board.js`처럼 `.js` 확장자로 import하므로, Vite가 `.ts`로 해석하는지 빌드로 확인한다.
- 오프라인 모드(`OFFLINE`)에서는 다음을 지킨다.
  - AI 수 계산: `fetch('/game/ai-move')` 대신 `localAi`
  - 로그인(Kakao), 리더보드, 프로필, `saveGameRecord`: 숨기거나 호출하지 않는다. 네트워크 호출이 하나라도 남으면 비행기 모드에서 실패한다.
- 웹 빌드(`npm run build`, 서버 사용)는 지금처럼 동작해야 한다. 오프라인 분기는 `OFFLINE` 플래그로만 나눈다.

## 빌드

```bash
cd game
npm run build:android          # tsc + vite build --mode android → dist/
npx cap sync android           # dist/ → android/app/src/main/assets/public
cd android && ./gradlew assembleDebug   # → app/build/outputs/apk/debug/app-debug.apk
```

환경: Node 18 → **Capacitor 6.x** (7.x는 Node 20 이상이 필요). JDK 17, `ANDROID_HOME=~/Android/Sdk`.
`android/local.properties`(sdk.dir)는 커밋하지 않는다.

## 검증 (필수)

1. `cd backend && npm test`: 엔진을 공유하므로 서버 쪽 테스트가 깨지지 않아야 한다.
2. `cd game && npx tsc --noEmit`, `npm run build`(웹), `npm run build:android`가 모두 통과해야 한다.
3. 번들에 서버 호출이 남지 않았는지 확인한다. `grep -r "ai-move\|kakao" dist/assets/*.js`에서 오프라인 빌드 결과가 없어야 한다(문자열이 상수로만 남는 경우는 코드 경로를 확인한다).
4. `./gradlew assembleDebug`가 성공하고 APK가 생성돼야 한다.
5. 기기나 에뮬레이터가 있으면 `adb install -r app-debug.apk`로 설치하고, 비행기 모드에서 Expert 한 판을 둔다. AI 응답이 3초 안팎이고 UI가 멈추지 않아야 한다(워커가 동작한다는 뜻).

## 주의

- 보드 입력은 **Pointer 이벤트**와 `touch-action: none`으로 처리한다. 마우스 이벤트만 쓰면 터치 드래그 때 `mousemove`가 오지 않아서 모바일에서 말을 옮길 수 없다(실제로 겪었다). 이동 가능한 칸은 탭으로도 이동한다.
- 보드 SVG는 `viewBox`로 화면 폭에 맞춰 줄어든다. 좌표는 `GameBoard.tsx`의 `toBoard()`로 축척을 반영해 변환한다. `clientX - rect.left`를 SVG 단위로 그대로 쓰지 않는다.
- 사용자 실기기가 adb에 연결돼 있어도 묻지 않고 설치하지 않는다. 검증은 에뮬레이터(`emulator -avd <AVD> -no-window`)에서 `svc wifi disable; svc data disable`로 네트워크를 끈 상태로 한다. 끝나면 네트워크를 다시 켠다.

- 엔진에 `node:` 모듈, `process`, `Buffer`를 넣지 않는다. 앱 번들이 깨진다.
- 엔진은 BigInt를 쓴다. Android System WebView는 67 이상이어야 하므로 `minSdkVersion`은 Capacitor 기본값(22 이상)으로 두되, 오래된 WebView에서는 동작하지 않는다는 점을 README에 적는다.
- 워커가 3초 넘게 응답하지 않으면 `localAi`가 메인 스레드에서 얕은 탐색(depth 2)으로 대체한다. 서버의 `aiService`와 같은 정책이다.
- 난이도 조정은 앱에서 따로 하지 않는다. `backend/src/ai/config.ts`가 유일한 출처다(`quoridor-ai-difficulty` 스킬).
