# Phase 2: 카카오 인증 & 게임 기록 & 리더보드 - 상세 프롬프트

## 🎯 목표
카카오 로그인 + 게임 기록 저장 + 글로벌 리더보드 구현

---

## 🔐 Kakao OAuth 통합

### 1. Kakao Developers 설정

```
https://developers.kakao.com
├─ 새 앱 생성 (앱이름: "Quoridor Game")
├─ REST API Key 복사
├─ 플랫폼 설정
│  ├─ Web
│  │  ├─ 사이트 도메인: localhost:5173, 192.168.0.100:5173, yourdomain.com
│  │  └─ 리다이렉트 URI: 
│  │     - http://localhost:5173/auth/kakao/callback
│  │     - http://192.168.0.100:5173/auth/kakao/callback
│  │     - https://yourdomain.com/auth/kakao/callback
│  │
│  └─ 동의항목
│     ├─ 필수: 프로필정보(닉네임), 계정(UID)
│     └─ 선택: 프로필사진, 이메일
```

### 2. 프론트엔드 Kakao SDK 초기화

#### public/index.html
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quoridor Game</title>
  <script src="https://developers.kakao.com/sdk/js/kakao.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

#### src/services/kakaoAuth.ts
```typescript
export const initKakaoSDK = () => {
  if (!window.Kakao) return;
  
  if (!window.Kakao.isInitialized()) {
    window.Kakao.init(import.meta.env.VITE_KAKAO_APP_ID);
    console.log('✅ Kakao SDK initialized');
  }
};

export const loginWithKakao = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    window.Kakao.Auth.login({
      scope: 'profile_image,profile_nickname,account_email',
      success: (authObj: any) => {
        console.log('✅ Kakao login success:', authObj);
        resolve(authObj);
      },
      fail: (error: any) => {
        console.error('❌ Kakao login failed:', error);
        reject(error);
      }
    });
  });
};

export const logoutWithKakao = (): Promise<void> => {
  return new Promise((resolve) => {
    window.Kakao.Auth.logout(() => {
      console.log('✅ Logged out');
      resolve();
    });
  });
};

export const getUserInfo = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    window.Kakao.API.request({
      url: '/v2/user/me',
      success: (response: any) => {
        resolve(response);
      },
      fail: (error: any) => {
        reject(error);
      }
    });
  });
};
```

### 3. 백엔드 인증 API

#### src/app.ts (CORS 설정)
```typescript
import cors from 'cors';

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://192.168.0.100:5173',  // 당신의 IP
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

#### src/routes/auth.ts
```typescript
import express, { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Kakao 로그인
router.post('/kakao/login', async (req: Request, res: Response) => {
  try {
    const { kakaoAccessToken } = req.body;
    
    // 1. Kakao 서버에서 사용자 정보 조회
    const userResponse = await axios.get(
      'https://kapi.kakao.com/v2/user/me',
      {
        headers: {
          Authorization: `Bearer ${kakaoAccessToken}`
        }
      }
    );
    
    const {
      id: kakaoId,
      kakao_account: {
        profile: { nickname, profile_image_url },
        email
      }
    } = userResponse.data;
    
    // 2. DB에 사용자 저장 또는 업데이트
    const userResult = await pool.query(
      `INSERT INTO users (kakao_id, nickname, profile_image, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (kakao_id) DO UPDATE SET
         nickname = EXCLUDED.nickname,
         profile_image = EXCLUDED.profile_image,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, kakao_id, nickname, profile_image, total_games, total_wins, elo_rating`,
      [kakaoId, nickname, profile_image_url, email]
    );
    
    const user = userResult.rows[0];
    
    // 3. JWT 토큰 생성
    const accessToken = jwt.sign(
      { userId: user.id, kakaoId },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );
    
    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: '7d' }
    );
    
    // 4. RefreshToken을 httpOnly 쿠키에 저장
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000  // 7일
    });
    
    // 5. 응답
    res.json({
      accessToken,
      user: {
        id: user.id,
        nickname: user.nickname,
        profileImage: user.profile_image,
        totalGames: user.total_games,
        totalWins: user.total_wins,
        eloRating: user.elo_rating
      }
    });
  } catch (error: any) {
    console.error('❌ Kakao login error:', error.message);
    res.status(401).json({ error: 'Failed to authenticate with Kakao' });
  }
});

// 현재 사용자 정보
router.get('/me', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    
    // DB에서 사용자 정보 조회
    pool.query(
      'SELECT id, kakao_id, nickname, profile_image, total_games, total_wins, elo_rating FROM users WHERE id = $1',
      [(decoded as any).userId],
      (err, result) => {
        if (err || result!.rows.length === 0) {
          return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(result!.rows[0]);
      }
    );
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// 로그아웃
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('refreshToken');
  res.json({ success: true });
});

export default router;
```

---

## 🏆 게임 기록 저장

### 1. 게임 종료 후 기록 저장

#### src/services/gameService.ts
```typescript
export async function saveGameRecord(
  playerId: string,
  gameData: {
    aiLevel: string;
    winner: 'player' | 'ai';
    playerWallsUsed: number;
    aiWallsUsed: number;
    totalMoves: number;
    gameDuration: number;  // 초 단위
  }
) {
  try {
    // 포인트 계산
    let pointsEarned = 0;
    if (gameData.winner === 'player') {
      const levelPoints = {
        'Easy': 20,
        'Normal': 40,
        'Hard': 75,
        'VeryHard': 125,
        'Expert': 200
      };
      
      pointsEarned = levelPoints[gameData.aiLevel] || 0;
      
      // 시간 보너스 (3분 이내면 보너스)
      if (gameData.gameDuration < 180) {
        pointsEarned += Math.floor((180 - gameData.gameDuration) / 10);
      }
      
      // 벽 효율성 보너스 (적게 사용할수록)
      const wallBonus = (10 - gameData.playerWallsUsed) * 2;
      pointsEarned += wallBonus;
    }
    
    // DB에 기록 저장
    const response = await API.post('/game/save-record', {
      aiLevel: gameData.aiLevel,
      winner: gameData.winner,
      playerWallsUsed: gameData.playerWallsUsed,
      aiWallsUsed: gameData.aiWallsUsed,
      totalMoves: gameData.totalMoves,
      gameDuration: gameData.gameDuration,
      pointsEarned
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ Failed to save game record:', error);
    throw error;
  }
}
```

#### src/routes/game.ts (백엔드)
```typescript
router.post('/save-record', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const {
      aiLevel,
      winner,
      playerWallsUsed,
      aiWallsUsed,
      totalMoves,
      gameDuration,
      pointsEarned
    } = req.body;
    
    // 1. 게임 기록 저장
    const recordResult = await pool.query(
      `INSERT INTO game_records 
       (player_id, ai_level, winner, player_walls_used, ai_walls_used, total_moves, game_duration, points_earned)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [userId, aiLevel, winner, playerWallsUsed, aiWallsUsed, totalMoves, gameDuration, pointsEarned]
    );
    
    // 2. 사용자 통계 업데이트
    if (winner === 'player') {
      await pool.query(
        `UPDATE users 
         SET total_games = total_games + 1,
             total_wins = total_wins + 1,
             total_points = total_points + $1,
             current_streak = current_streak + 1,
             last_game_date = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [pointsEarned, userId]
      );
    } else {
      await pool.query(
        `UPDATE users 
         SET total_games = total_games + 1,
             current_streak = 0,
             last_game_date = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [userId]
      );
    }
    
    // 3. 난이도별 통계 업데이트
    await pool.query(
      `INSERT INTO player_stats_by_level (player_id, ai_level, games_played, games_won)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (player_id, ai_level) DO UPDATE SET
         games_played = player_stats_by_level.games_played + 1,
         games_won = player_stats_by_level.games_won + EXCLUDED.games_won,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, aiLevel, winner === 'player' ? 1 : 0]
    );
    
    res.json({
      recordId: recordResult.rows[0].id,
      pointsEarned
    });
  } catch (error) {
    console.error('❌ Failed to save game record:', error);
    res.status(500).json({ error: 'Failed to save game record' });
  }
});
```

---

## 📊 리더보드 시스템

### 1. 글로벌 리더보드 API

#### src/routes/leaderboard.ts
```typescript
router.get('/global', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    
    const result = await pool.query(
      `SELECT 
         id,
         nickname,
         profile_image,
         total_games,
         total_wins,
         total_points,
         elo_rating,
         best_streak,
         ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank
       FROM users
       ORDER BY total_points DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    const leaderboard = result.rows.map(row => ({
      rank: row.rank,
      userId: row.id,
      nickname: row.nickname,
      profileImage: row.profile_image,
      totalGames: row.total_games,
      totalWins: row.total_wins,
      totalPoints: row.total_points,
      eloRating: row.elo_rating,
      winRate: row.total_games > 0 
        ? Math.round((row.total_wins / row.total_games) * 100)
        : 0,
      bestStreak: row.best_streak
    }));
    
    res.json({
      leaderboard,
      count: leaderboard.length,
      limit,
      offset
    });
  } catch (error) {
    console.error('❌ Failed to get leaderboard:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// 난이도별 리더보드
router.get('/by-level/:level', async (req: Request, res: Response) => {
  try {
    const { level } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    
    const result = await pool.query(
      `SELECT 
         u.id,
         u.nickname,
         u.profile_image,
         s.games_played,
         s.games_won,
         ROW_NUMBER() OVER (ORDER BY s.games_won DESC) as rank
       FROM users u
       JOIN player_stats_by_level s ON u.id = s.player_id
       WHERE s.ai_level = $1
       ORDER BY s.games_won DESC
       LIMIT $2 OFFSET $3`,
      [level, limit, offset]
    );
    
    const leaderboard = result.rows.map(row => ({
      rank: row.rank,
      nickname: row.nickname,
      profileImage: row.profile_image,
      gamesPlayed: row.games_played,
      gamesWon: row.games_won,
      winRate: Math.round((row.games_won / row.games_played) * 100)
    }));
    
    res.json(leaderboard);
  } catch (error) {
    console.error('❌ Failed to get level leaderboard:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// 개인 순위 조회
router.get('/my-rank', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const result = await pool.query(
      `SELECT 
         ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank,
         total_points,
         (SELECT COUNT(*) FROM users) as total_users
       FROM users
       WHERE id = $1`,
      [req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const row = result.rows[0];
    const percentile = Math.round((row.total_users - row.rank + 1) / row.total_users * 100);
    
    res.json({
      rank: row.rank,
      totalPoints: row.total_points,
      percentile,
      totalUsers: row.total_users
    });
  } catch (error) {
    console.error('❌ Failed to get user rank:', error);
    res.status(500).json({ error: 'Failed to get rank' });
  }
});
```

### 2. 프론트엔드 리더보드 컴포넌트

#### src/pages/Leaderboard.tsx
```typescript
import React, { useEffect, useState } from 'react';
import API from '../services/api';

interface LeaderboardEntry {
  rank: number;
  nickname: string;
  profileImage: string;
  totalGames: number;
  totalWins: number;
  totalPoints: number;
  winRate: number;
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'global' | 'easy' | 'normal' | 'hard'>('global');
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    loadLeaderboard();
    loadMyRank();
  }, [activeTab]);
  
  const loadLeaderboard = async () => {
    setIsLoading(true);
    try {
      let url = '/api/leaderboard/global';
      if (activeTab !== 'global') {
        const levelMap = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
        url = `/api/leaderboard/by-level/${levelMap[activeTab]}`;
      }
      
      const response = await API.get(url);
      setLeaderboard(response.data.leaderboard || response.data);
    } catch (error) {
      console.error('❌ Failed to load leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadMyRank = async () => {
    try {
      const response = await API.get('/api/leaderboard/my-rank');
      setMyRank(response.data);
    } catch (error) {
      console.error('❌ Failed to load my rank:', error);
    }
  };
  
  return (
    <div className="min-h-screen bg-[#0f1419] text-white p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-6">리더보드</h1>
        
        {/* 내 순위 카드 */}
        {myRank && (
          <div className="bg-gradient-to-r from-cyan-900 to-blue-900 rounded-xl p-6 mb-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-gray-300 text-sm">순위</p>
                <p className="text-3xl font-bold text-cyan-400">#{myRank.rank}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-300 text-sm">백분위수</p>
                <p className="text-3xl font-bold">{myRank.percentile}%</p>
              </div>
            </div>
          </div>
        )}
        
        {/* 탭 */}
        <div className="flex gap-2 mb-6 border-b border-[#2a2a4e]">
          {['global', 'easy', 'normal', 'hard'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`pb-3 px-4 font-semibold transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-cyan-500 text-cyan-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'global' ? '전체' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        
        {/* 리더보드 테이블 */}
        <div className="bg-[#1a1a2e] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-[#0f1419]">
              <tr className="border-b border-[#2a2a4e]">
                <th className="px-4 py-3 text-left text-sm font-semibold">순위</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">플레이어</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">점수</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">승률</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map(entry => (
                <tr 
                  key={entry.rank}
                  className="border-b border-[#2a2a4e] hover:bg-[#252540] transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-semibold">
                      {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex items-center gap-3">
                    <img 
                      src={entry.profileImage} 
                      alt={entry.nickname}
                      className="w-8 h-8 rounded-full"
                    />
                    <span>{entry.nickname}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-cyan-400 font-bold">{entry.totalPoints}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{entry.winRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {isLoading && (
            <div className="p-8 text-center text-gray-400">로딩 중...</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## ✅ Phase 2 체크리스트

```
인증
- [ ] Kakao OAuth 2.0 통합
- [ ] JWT 토큰 관리
- [ ] 프로필 페이지

게임 기록
- [ ] 게임 종료 후 기록 저장
- [ ] 포인트 계산
- [ ] 통계 업데이트

리더보드
- [ ] 글로벌 리더보드
- [ ] 난이도별 리더보드
- [ ] 개인 순위 조회
- [ ] 리더보드 UI

데이터베이스
- [ ] users 테이블
- [ ] game_records 테이블
- [ ] player_stats_by_level 테이블
```

---

이제 Phase 1 + Phase 2로 완전한 쿼리도 게임이 완성됩니다!
