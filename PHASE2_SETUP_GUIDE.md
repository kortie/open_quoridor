# Phase 2 설정 가이드 - 전체 시스템 구축

## 🎯 개요

Phase 2에서는 다음이 추가됩니다:
- ✅ Kakao OAuth 로그인
- ✅ 게임 기록 저장 (PostgreSQL)
- ✅ 글로벌/주간 리더보드
- ✅ 사용자 프로필 관리
- ✅ Express.js 백엔드 API

---

## 📋 전제 조건

### 설치 필요 소프트웨어
- Node.js 18+ (npm 9+)
- PostgreSQL 12+ ([설치 가이드](https://www.postgresql.org/download))
- Git

### Kakao Developers 계정
1. https://developers.kakao.com 회원가입
2. 앱 생성 및 설정 (아래 참고)

---

## 🔐 Step 1: Kakao Developers 설정 (15분)

### 1.1 앱 등록

1. [Kakao Developers](https://developers.kakao.com) 방문
2. "My App" → "애플리케이션 추가"
3. 앱 이름: `Quoridor Game`
4. 회사명: (선택사항)
5. 앱 생성

### 1.2 앱 키 복사

```
[내 애플리케이션] → [Quoridor Game]
├─ 앱 키
│  ├─ REST API Key: ❗ 복사하기 (VITE_KAKAO_APP_ID)
│  └─ JavaScript Key: (프론트엔드용)
└─ Admin Key: (관리용)
```

### 1.3 플랫폼 설정

1. "앱 설정" → "플랫폼"
2. "Web" 추가
3. 사이트 도메인 추가:
   ```
   localhost:5173
   127.0.0.1:5173
   yourdomain.com  (프로덕션 배포 시)
   ```

### 1.4 Redirect URI 설정

1. "앱 설정" → "사용자 관리"
2. "Redirect URI" 추가:
   ```
   http://localhost:5173/auth/kakao/callback
   http://127.0.0.1:5173/auth/kakao/callback
   https://yourdomain.com/auth/kakao/callback  (프로덕션)
   ```

### 1.5 동의항목 설정

1. "앱 설정" → "동의항목"
2. 필수 항목:
   - ✅ 프로필정보(닉네임) 필수
   - ✅ 계정(UID) 필수
3. 선택 항목:
   - ✅ 프로필사진
   - ✅ 이메일

---

## 🗄️ Step 2: PostgreSQL 설정 (10분)

### 2.1 PostgreSQL 설치

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql postgresql-contrib
```

**Windows:**
[공식 인스톨러](https://www.postgresql.org/download/windows) 다운로드

### 2.2 데이터베이스 생성

```bash
# PostgreSQL 접속
psql -U postgres

# 데이터베이스 생성
CREATE DATABASE quoridor;

# 사용자 생성 (선택사항)
CREATE USER quoridor_user WITH PASSWORD 'your_password';
ALTER ROLE quoridor_user WITH CREATEDB;

# 권한 부여
GRANT ALL PRIVILEGES ON DATABASE quoridor TO quoridor_user;

# 나가기
\q
```

### 2.3 연결 확인

```bash
psql -U postgres -d quoridor

# 또는 (사용자 생성 시)
psql -U quoridor_user -d quoridor
```

---

## 📦 Step 3: 백엔드 설정 (15분)

### 3.1 백엔드 설치

```bash
cd /backend
npm install
```

### 3.2 환경 변수 설정

`backend/.env` 파일 생성:

```env
# 데이터베이스
DATABASE_URL=postgresql://postgres:password@localhost:5432/quoridor
# 또는 (사용자 생성 시)
DATABASE_URL=postgresql://quoridor_user:your_password@localhost:5432/quoridor

# JWT 시크릿 (강한 문자열 사용!)
JWT_SECRET=your_super_secret_jwt_key_min_32_chars_long_please
JWT_REFRESH_SECRET=your_super_secret_refresh_key_also_long

# 서버
PORT=3001
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173

# Kakao (선택사항)
KAKAO_CLIENT_ID=your_kakao_client_id
KAKAO_CLIENT_SECRET=your_kakao_client_secret
```

### 3.3 백엔드 실행

```bash
npm run dev
```

**출력:**
```
✅ Database initialized successfully
✅ Server running on port 3001
📍 API: http://localhost:3001/api
```

### 3.4 헬스 체크

```bash
curl http://localhost:3001/health
# 응답: {"status":"ok"}
```

---

## 💻 Step 4: 프론트엔드 설정 (10분)

### 4.1 프론트엔드 설치

```bash
cd /game
npm install
```

### 4.2 환경 변수 설정

`game/.env` 파일 생성:

```env
# Kakao OAuth
VITE_KAKAO_APP_ID=your_kakao_rest_api_key
VITE_KAKAO_REDIRECT_URI=http://localhost:5173/auth/kakao/callback

# Backend API
VITE_API_BASE_URL=http://localhost:3001/api
```

### 4.3 프론트엔드 실행

```bash
npm run dev
```

**출력:**
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

---

## ✅ Step 5: 통합 테스트 (20분)

### 5.1 전체 시스템 실행

**터미널 1 - 백엔드:**
```bash
cd backend
npm run dev
```

**터미널 2 - 프론트엔드:**
```bash
cd game
npm run dev
```

### 5.2 테스트 시나리오

#### 테스트 1: 로그인
1. http://localhost:5173 방문
2. "🍯 카카오로 시작" 클릭
3. Kakao 계정으로 로그인
4. ✅ 로그인 성공 확인

#### 테스트 2: 게임 플레이
1. 홈 화면에서 게임 시작
2. 게임 플레이
3. 게임 종료 (승리/패배)
4. ✅ 기록 저장 확인

#### 테스트 3: 리더보드 확인
1. 상단 네비게이션에서 "🏆 리더보드" 클릭
2. ✅ 리더보드 표시 확인
3. 탭 전환 (전체, 주간, 내 순위)

#### 테스트 4: 프로필 확인
1. 상단 네비게이션에서 "👤 프로필" 클릭
2. ✅ 사용자 통계 표시 확인
3. 로그아웃 버튼 클릭

### 5.3 데이터베이스 확인

```bash
psql -U postgres -d quoridor

# 사용자 확인
SELECT id, nickname, total_games, total_wins, total_points FROM users;

# 게임 기록 확인
SELECT * FROM game_records LIMIT 5;

# 리더보드 순위
SELECT ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank, 
       nickname, total_points, total_wins, total_games 
FROM users 
ORDER BY total_points DESC 
LIMIT 10;
```

---

## 🚀 Step 6: 선택사항 - 로컬 네트워크 테스트 (15분)

### 6.1 다른 기기에서 테스트

**1. 로컬 IP 확인**
```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig
```

**2. Kakao Developers 설정 업데이트**
- 사이트 도메인에 추가: `192.168.x.x:5173`
- Redirect URI에 추가: `http://192.168.x.x:5173/auth/kakao/callback`

**3. 프론트엔드 환경 변수 업데이트**
```env
VITE_API_BASE_URL=http://192.168.x.x:3001/api
```

**4. 다른 기기에서 접속**
```
http://192.168.x.x:5173
```

---

## 📊 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    브라우저 (사용자)                          │
│               http://localhost:5173                          │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │ React + Zustand Store   │
        │  (프론트엔드 앱)         │
        └────────┬────────────────┘
                 │
        ┌────────┴────────────────┐
        │   Kakao SDK / API       │
        │   (인증 & 사용자 정보)   │
        └────────┬────────────────┘
                 │
        ┌────────┴────────────────────────┐
        │   Express.js + JWT              │
        │   http://localhost:3001/api     │
        │   (백엔드 서버)                  │
        └────────┬─────────────────────────┘
                 │
        ┌────────┴────────────────────────┐
        │      PostgreSQL DB              │
        │   (사용자, 게임 기록, 순위)      │
        └────────────────────────────────┘
```

---

## 🔗 API 흐름

### 로그인 흐름
```
1. [사용자] "카카오로 시작" 클릭
        ↓
2. [프론트엔드] Kakao SDK → Kakao 로그인 팝업
        ↓
3. [Kakao] 로그인 완료 → accessToken 반환
        ↓
4. [프론트엔드] POST /api/auth/kakao/login (accessToken 전송)
        ↓
5. [백엔드] Kakao 서버 검증 → 사용자 저장/업데이트
        ↓
6. [백엔드] JWT accessToken 생성 → 프론트엔드에 반환
        ↓
7. [프론트엔드] 로컬 스토리지에 저장
        ↓
8. ✅ 로그인 완료 → 홈 화면 표시
```

### 게임 저장 흐름
```
1. [게임] 게임 시작 → gameStartTime 기록
        ↓
2. [게임] 게임 종료 → gameEndTime, 통계 기록
        ↓
3. [프론트엔드] POST /api/game/save-record (게임 데이터)
        ↓
4. [백엔드] 점수 계산 → game_records 테이블에 저장
        ↓
5. [백엔드] users 테이블 업데이트 (통계)
        ↓
6. ✅ 저장 완료 → 프론트엔드에 확인
```

---

## 🆘 문제 해결

### "DATABASE_URL not set" 오류
```bash
# .env 파일 존재 확인
ls -la backend/.env

# 필수 환경 변수 확인
echo $DATABASE_URL
```

### PostgreSQL 연결 실패
```bash
# PostgreSQL 상태 확인
psql -U postgres

# 또는
brew services list | grep postgres

# 서비스 재시작
brew services restart postgresql@15
```

### "VITE_KAKAO_APP_ID not set" 오류
```bash
# game/.env 파일 확인
cat game/.env

# Kakao 앱 키 재확인
# https://developers.kakao.com → My App → REST API Key
```

### CORS 오류 ("No 'Access-Control-Allow-Origin'")
```bash
# backend/.env의 CORS_ORIGIN 확인
cat backend/.env | grep CORS_ORIGIN

# 포트 확인 (프론트엔드: 5173, 백엔드: 3001)
lsof -i :5173
lsof -i :3001
```

---

## 📈 다음 단계

### Phase 2 완료 후 (필수)
- [ ] 로컬에서 모든 테스트 통과
- [ ] Kakao 로그인 정상 동작
- [ ] 게임 기록 저장 확인
- [ ] 리더보드 조회 확인

### Phase 3 준비 (선택)
- [ ] 멀티플레이 기능
- [ ] WebSocket 통합
- [ ] 더 높은 난이도 AI
- [ ] 게임 분석 기능

---

## 📚 참고 자료

| 항목 | 링크 |
|------|------|
| Kakao Developers | https://developers.kakao.com |
| PostgreSQL | https://www.postgresql.org |
| Express.js | https://expressjs.com |
| JWT 소개 | https://jwt.io |
| React Zustand | https://zustand-demo.vercel.app |

---

## 🎯 체크리스트

- [ ] PostgreSQL 설치 및 DB 생성
- [ ] Kakao Developers 앱 등록
- [ ] Kakao 앱 키 및 설정 복사
- [ ] 백엔드 .env 파일 작성
- [ ] 프론트엔드 .env 파일 작성
- [ ] 백엔드 npm install 및 실행
- [ ] 프론트엔드 npm install 및 실행
- [ ] 로그인 테스트
- [ ] 게임 저장 테스트
- [ ] 리더보드 조회 테스트

---

**완료되면 이메일 또는 GitHub issue로 성공 공유하세요!** 🎉

**설정 시간**: ~90분  
**필수 소프트웨어**: Node.js, PostgreSQL, Kakao 계정  
**다음 단계**: Phase 3 멀티플레이 기능
