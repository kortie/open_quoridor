import express, { Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';
import pool from '../db.js';
import { getAIMove } from '../services/aiService.js';

const router = express.Router();

// 게임 결과 저장
router.post('/save-record', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      aiLevel,
      winner,
      playerWallsUsed,
      aiWallsUsed,
      totalMoves,
      gameDuration,
      pointsEarned,
    } = req.body;

    // 1. 게임 기록 저장
    const recordResult = await pool.query(
      `INSERT INTO game_records
       (player_id, ai_level, winner, player_walls_used, ai_walls_used, total_moves, game_duration, points_earned)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, created_at`,
      [userId, aiLevel, winner, playerWallsUsed, aiWallsUsed, totalMoves, gameDuration, pointsEarned]
    );

    const recordId = recordResult.rows[0].id;

    // 2. 사용자 통계 업데이트
    if (winner === 'player') {
      await pool.query(
        `UPDATE users
         SET total_games = total_games + 1,
             total_wins = total_wins + 1,
             total_points = total_points + $1,
             current_streak = current_streak + 1,
             best_streak = CASE WHEN current_streak + 1 > best_streak THEN current_streak + 1 ELSE best_streak END,
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

    res.json({
      id: recordId,
      success: true,
      pointsEarned,
    });
  } catch (error: any) {
    console.error('❌ Save game record error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 게임 히스토리 조회
router.get('/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT id, ai_level, winner, player_walls_used, ai_walls_used, total_moves, game_duration, points_earned, created_at
       FROM game_records
       WHERE player_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error('❌ Get history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 게임 통계 조회
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT total_games, total_wins, total_points, current_streak, best_streak
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const stats = result.rows[0];

    res.json({
      totalGames: stats.total_games,
      totalWins: stats.total_wins,
      totalPoints: stats.total_points,
      currentStreak: stats.current_streak,
      bestStreak: stats.best_streak,
      winRate: stats.total_games > 0 ? (stats.total_wins / stats.total_games) * 100 : 0,
    });
  } catch (error: any) {
    console.error('❌ Get stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// AI move decision
router.post('/ai-move', async (req: any, res: Response) => {
  try {
    const aiDecisionRequest = req.body;

    if (!aiDecisionRequest || !aiDecisionRequest.aiLevel) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const move = await getAIMove(aiDecisionRequest);
    res.json(move);
  } catch (error: any) {
    console.error('❌ AI move error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
