import express, { Response } from 'express';
import { AuthRequest, optionalAuthMiddleware } from '../middleware/auth.js';
import pool from '../db.js';

const router = express.Router();

// 글로벌 리더보드
router.get('/global', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await pool.query(
      `SELECT
         ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank,
         id as user_id,
         nickname,
         profile_image,
         total_points,
         total_wins,
         total_games,
         CASE WHEN total_games > 0 THEN ROUND((total_wins::numeric / total_games) * 100, 1) ELSE 0 END as win_rate,
         current_streak
       FROM users
       ORDER BY total_points DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const leaderboard = result.rows.map((row) => ({
      rank: row.rank,
      userId: row.user_id,
      nickname: row.nickname,
      profileImage: row.profile_image,
      totalPoints: row.total_points,
      totalWins: row.total_wins,
      totalGames: row.total_games,
      winRate: row.win_rate,
      currentStreak: row.current_streak,
    }));

    res.json(leaderboard);
  } catch (error: any) {
    console.error('❌ Get global leaderboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 주간 리더보드
router.get('/weekly', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;

    const result = await pool.query(
      `SELECT
         ROW_NUMBER() OVER (ORDER BY weekly_points DESC) as rank,
         id as user_id,
         nickname,
         profile_image,
         total_wins,
         total_games,
         CASE WHEN total_games > 0 THEN ROUND((total_wins::numeric / total_games) * 100, 1) ELSE 0 END as win_rate,
         current_streak,
         COALESCE(SUM(gr.points_earned) FILTER (WHERE gr.created_at >= CURRENT_DATE - INTERVAL '7 days'), 0) as weekly_points
       FROM users u
       LEFT JOIN game_records gr ON u.id = gr.player_id
       GROUP BY u.id, u.nickname, u.profile_image, u.total_wins, u.total_games, u.current_streak
       ORDER BY weekly_points DESC
       LIMIT $1`,
      [limit]
    );

    const leaderboard = result.rows.map((row) => ({
      rank: row.rank,
      userId: row.user_id,
      nickname: row.nickname,
      profileImage: row.profile_image,
      totalPoints: row.weekly_points,
      totalWins: row.total_wins,
      totalGames: row.total_games,
      winRate: row.win_rate,
      currentStreak: row.current_streak,
    }));

    res.json(leaderboard);
  } catch (error: any) {
    console.error('❌ Get weekly leaderboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 내 순위
router.get('/my-rank', optionalAuthMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 내 순위 조회
    const rankResult = await pool.query(
      `SELECT
         COALESCE(ROW_NUMBER() OVER (ORDER BY total_points DESC), 0) as rank,
         total_points,
         (SELECT COUNT(*) + 1 FROM users WHERE total_points > u.total_points) as rank_alt
       FROM users u
       WHERE u.id = $1`,
      [req.userId]
    );

    if (rankResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = rankResult.rows[0];
    const myRank = userData.rank_alt || 1;

    // 전체 사용자 수
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM users');
    const totalUsers = totalResult.rows[0].total;

    const percentile = Math.round(((totalUsers - myRank + 1) / totalUsers) * 100);

    res.json({
      rank: myRank,
      totalPoints: userData.total_points,
      percentile,
    });
  } catch (error: any) {
    console.error('❌ Get my rank error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
