import express, { Request, Response } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

const router = express.Router();

interface KakaoUserResponse {
  id: number;
  kakao_account: {
    profile: {
      nickname: string;
      profile_image_url: string;
    };
    email: string;
  };
}

// Kakao 로그인
router.post('/kakao/login', async (req: Request, res: Response) => {
  try {
    const { kakaoAccessToken } = req.body;

    if (!kakaoAccessToken) {
      return res.status(400).json({ error: 'Missing kakaoAccessToken' });
    }

    // 1. Kakao 서버에서 사용자 정보 조회
    const userResponse = await axios.get<KakaoUserResponse>(
      'https://kapi.kakao.com/v2/user/me',
      {
        headers: {
          Authorization: `Bearer ${kakaoAccessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
      }
    );

    const {
      id: kakaoId,
      kakao_account: {
        profile: { nickname, profile_image_url },
        email,
      },
    } = userResponse.data;

    // 2. DB에 사용자 저장 또는 업데이트
    const userResult = await pool.query(
      `INSERT INTO users (kakao_id, nickname, profile_image, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (kakao_id) DO UPDATE SET
         nickname = EXCLUDED.nickname,
         profile_image = EXCLUDED.profile_image,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, kakao_id, nickname, profile_image, total_games, total_wins, total_points, current_streak, elo_rating`,
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
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
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
        totalPoints: user.total_points,
        currentStreak: user.current_streak,
        eloRating: user.elo_rating,
      },
    });
  } catch (error: any) {
    console.error('❌ Kakao login error:', error.message);
    res.status(401).json({ error: 'Failed to authenticate with Kakao' });
  }
});

// 현재 사용자 정보
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };

      const result = await pool.query(
        'SELECT id, kakao_id, nickname, profile_image, total_games, total_wins, total_points, current_streak, elo_rating FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = result.rows[0];
      res.json({
        id: user.id,
        nickname: user.nickname,
        profileImage: user.profile_image,
        totalGames: user.total_games,
        totalWins: user.total_wins,
        totalPoints: user.total_points,
        currentStreak: user.current_streak,
        eloRating: user.elo_rating,
      });
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 로그아웃
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('refreshToken');
  res.json({ success: true });
});

export default router;
