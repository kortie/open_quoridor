# 🎮 쿼리도 (Quoridor) - Phase 1 구현 완료

## ⚡ 빠른 시작

```bash
cd game
npm install
npm run dev
# http://localhost:3000 접속
```

---

## 📂 프로젝트 구조

```
Quoridor/
├── game/                          # React 프로젝트
│   ├── src/
│   │   ├── components/GameBoard.tsx
│   │   ├── pages/Home.tsx
│   │   ├── store/gameStore.ts
│   │   ├── utils/gameLogic.ts
│   │   ├── utils/aiLogic.ts
│   │   └── types/index.ts
│   ├── README.md
│   └── PHASE1_COMPLETION.md
│
├── Phase1_게임로직_AI구현_상세프롬프트.md  # 원본 요구사항
├── 쿼리도_모바일웹게임_통합프롬프트.md    # 전체 설계서
└── 00_START_HERE.md                    # 이 파일
```

---

## ✨ Phase 1 완성 내용

### ✅ 게임 로직 (100%)
- 9×9 보드 초기화
- 유효한 이동 계산 (BFS)
- 점프 이동
- 벽 배치 검증
- 경로 도달 가능성 확인
- 게임 종료 조건
- 실행 취소

### ✅ AI (100%)
- **Easy**: 무작위 이동
- **Normal**: 탐욕법 + 블로킹 전략
- 자동 턴 실행

### ✅ UI/UX (85%)
- 게임 보드 렌더링 (SVG)
- 홈 화면 (난이도 선택)
- 게임 정보 표시
- 다크 모드 (Chess.com 영감)
- 반응형 디자인

### ✅ 기술
- React 18 + TypeScript
- Zustand 상태관리
- Tailwind CSS
- Vite 빌드

---

## 🎯 게임 플레이

1. **홈 화면**: 난이도 선택 (Easy / Normal)
2. **게임**: 초록색 원(유효이동) 클릭하여 이동
3. **AI**: 자동으로 턴 진행 (0.5초 후)
4. **승리**: 행 8 도달 또는 행 0 도달 시 게임 종료

---

## 📊 구현 통계

| 항목 | 수치 |
|------|------|
| 핵심 로직 | ~800 줄 |
| UI 코드 | ~400 줄 |
| 번들 크기 | 155 KB |
| 컴파일 오류 | 0개 |
| 빌드 시간 | 973ms |

---

## 📖 문서

| 문서 | 설명 |
|------|------|
| [game/README.md](./game/README.md) | 프로젝트 사용 가이드 |
| [game/PHASE1_COMPLETION.md](./game/PHASE1_COMPLETION.md) | Phase 1 완료 보고서 |
| [game/IMPLEMENTATION_CHECKLIST.md](./game/IMPLEMENTATION_CHECKLIST.md) | 완성 체크리스트 |
| [Phase1_게임로직_AI구현_상세프롬프트.md](./Phase1_게임로직_AI구현_상세프롬프트.md) | 원본 요구사항 |

---

## 🚀 배포

### 프로덕션 빌드
```bash
npm run build      # dist/ 생성
npm run preview    # 로컬 프리뷰
```

### Vercel 배포
```bash
vercel deploy --prod
```

---

## 🎨 색상 팔레트

- 배경: #0f1419 (검은색)
- 플레이어: #06b6d4 (파란색)
- AI: #10b981 (초록색)
- 텍스트: #ffffff (흰색)

---

## 🔄 다음 단계 (Phase 2)

- [ ] 벽 배치 UI 추가
- [ ] Kakao 로그인
- [ ] 게임 기록 저장
- [ ] 리더보드
- [ ] 백엔드 API

---

## 📧 연락처

질문이나 피드백은 Phase 2 문서를 참고하세요.

---

**상태**: ✅ Phase 1 완료  
**날짜**: 2024년 7월 10일  
**버전**: 1.0.0
