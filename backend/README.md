# Quoridor Backend API

## 🚀 빠른 시작

### 1. 설치
```bash
npm install
```

### 2. 환경 변수 설정
`.env` 파일 생성 (`.env.example` 참고):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/quoridor
JWT_SECRET=your_super_secret_key
JWT_REFRESH_SECRET=your_refresh_secret_key
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
KAKAO_CLIENT_ID=your_kakao_app_id
KAKAO_CLIENT_SECRET=your_kakao_secret
```

### 3. PostgreSQL 설정
```bash
# PostgreSQL 설치 (macOS)
brew install postgresql

# DB 생성
createdb quoridor

# (선택사항) 사용자 생성
createuser quoridor_user -P
```

### 4. 개발 서버 실행
```bash
npm run dev
```

서버는 `http://localhost:3001`에서 실행됩니다.

---

## 📋 API 엔드포인트

### 인증 (`/auth`)

#### POST /auth/kakao/login
카카오 로그인 처리

**요청:**
```json
{
  "kakaoAccessToken": "access_token_from_kakao"
}
```

**응답:**
```json
{
  "accessToken": "jwt_token",
  "user": {
    "id": 1,
    "nickname": "사용자이름",
    "profileImage": "https://...",
    "totalGames": 10,
    "totalWins": 7,
    "totalPoints": 500,
    "currentStreak": 3,
    "eloRating": 1650
  }
}
```

#### GET /auth/me
현재 사용자 정보 조회

**Header:**
```
Authorization: Bearer <accessToken>
```

**응답:**
```json
{
  "id": 1,
  "nickname": "사용자이름",
  "profileImage": "https://...",
  "totalGames": 10,
  "totalWins": 7,
  "totalPoints": 500,
  "currentStreak": 3,
  "eloRating": 1650
}
```

#### POST /auth/logout
로그아웃 (RefreshToken 쿠키 제거)

---

### 게임 (`/game`)

#### POST /game/save-record
게임 결과 저장

**Header:**
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**요청:**
```json
{
  "aiLevel": "Normal",
  "winner": "player",
  "playerWallsUsed": 3,
  "aiWallsUsed": 5,
  "totalMoves": 45,
  "gameDuration": 120,
  "pointsEarned": 65
}
```

**응답:**
```json
{
  "id": 123,
  "success": true,
  "pointsEarned": 65
}
```

#### GET /game/history
게임 이력 조회

**Query Parameters:**
- `limit`: 최대 결과 수 (기본: 20)
- `offset`: 시작 위치 (기본: 0)

**응답:**
```json
[
  {
    "id": 123,
    "ai_level": "Normal",
    "winner": "player",
    "player_walls_used": 3,
    "ai_walls_used": 5,
    "total_moves": 45,
    "game_duration": 120,
    "points_earned": 65,
    "created_at": "2024-07-10T10:30:00Z"
  }
]
```

#### GET /game/stats
게임 통계 조회

**응답:**
```json
{
  "totalGames": 10,
  "totalWins": 7,
  "totalPoints": 500,
  "currentStreak": 3,
  "bestStreak": 8,
  "winRate": 70
}
```

---

### 리더보드 (`/leaderboard`)

#### GET /leaderboard/global
글로벌 리더보드 조회

**Query Parameters:**
- `limit`: 최대 결과 수 (기본: 100)
- `offset`: 시작 위치 (기본: 0)

**응답:**
```json
[
  {
    "rank": 1,
    "userId": 5,
    "nickname": "TopPlayer",
    "profileImage": "https://...",
    "totalPoints": 5000,
    "totalWins": 150,
    "totalGames": 200,
    "winRate": 75,
    "currentStreak": 12
  }
]
```

#### GET /leaderboard/weekly
주간 리더보드 조회

**Query Parameters:**
- `limit`: 최대 결과 수 (기본: 100)

**응답:** (global과 동일한 형식)

#### GET /leaderboard/my-rank
개인 순위 조회

**Header:**
```
Authorization: Bearer <accessToken>
```

**응답:**
```json
{
  "rank": 47,
  "totalPoints": 1250,
  "percentile": 76
}
```

---

## 🗄️ 데이터베이스 스키마

### users 테이블
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  kakao_id BIGINT UNIQUE NOT NULL,
  nickname VARCHAR(50) NOT NULL,
  profile_image VARCHAR(255),
  email VARCHAR(100),
  total_games INT DEFAULT 0,
  total_wins INT DEFAULT 0,
  total_points INT DEFAULT 0,
  current_streak INT DEFAULT 0,
  best_streak INT DEFAULT 0,
  elo_rating INT DEFAULT 1600,
  last_game_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_kakao_id ON users(kakao_id);
CREATE INDEX idx_users_total_points ON users(total_points DESC);
```

### game_records 테이블
```sql
CREATE TABLE game_records (
  id SERIAL PRIMARY KEY,
  player_id INT NOT NULL REFERENCES users(id),
  ai_level VARCHAR(20) NOT NULL,
  winner VARCHAR(10) NOT NULL,
  player_walls_used INT,
  ai_walls_used INT,
  total_moves INT,
  game_duration INT,
  points_earned INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_game_records_player_id ON game_records(player_id);
CREATE INDEX idx_game_records_created_at ON game_records(created_at DESC);
```

---

## 🔐 인증 흐름

### JWT 토큰
- **AccessToken**: 1시간 유효 (Authorization 헤더에 사용)
- **RefreshToken**: 7일 유효 (httpOnly 쿠키에 저장)

### 토큰 갱신 (구현 예정)
```typescript
POST /auth/refresh
응답: { accessToken: "new_jwt_token" }
```

---

## 🧪 테스트

### cURL로 테스트

```bash
# 헬스 체크
curl http://localhost:3001/health

# Kakao 로그인
curl -X POST http://localhost:3001/api/auth/kakao/login \
  -H "Content-Type: application/json" \
  -d '{"kakaoAccessToken":"your_token"}'

# 리더보드 조회
curl http://localhost:3001/api/leaderboard/global?limit=10
```

---

## 📦 디렉토리 구조

```
backend/
├── src/
│   ├── index.ts              # Express 앱 진입점
│   ├── db.ts                # PostgreSQL 연결
│   ├── middleware/
│   │   └── auth.ts          # JWT 미들웨어
│   └── routes/
│       ├── auth.ts          # /auth 라우트
│       ├── game.ts          # /game 라우트
│       └── leaderboard.ts   # /leaderboard 라우트
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 🚀 배포

### Heroku 배포
```bash
heroku create quoridor-api
heroku config:set DATABASE_URL=postgresql://...
git push heroku main
```

### Railway 배포
```bash
railway login
railway link
railway up
```

---

## 🔍 문제 해결

### PostgreSQL 연결 오류
```bash
# 연결 확인
psql -U postgres -h localhost

# 특정 DB 연결
psql -U postgres -h localhost -d quoridor
```

### 포트 이미 사용 중
```bash
# macOS/Linux
lsof -i :3001
kill -9 <PID>

# 또는 다른 포트 사용
PORT=3002 npm run dev
```

### CORS 오류
`CORS_ORIGIN` 환경 변수에 프론트엔드 URL 추가:
```env
CORS_ORIGIN=http://localhost:5173,http://yourdomain.com
```

---

## 📚 참고 자료

- [Express.js 문서](https://expressjs.com)
- [PostgreSQL 문서](https://www.postgresql.org/docs)
- [JWT 소개](https://jwt.io)
- [Kakao API](https://developers.kakao.com)

---

**Version**: 1.0.0  
**Updated**: 2024년 7월 10일
