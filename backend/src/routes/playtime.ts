import { Router, Response } from 'express';
import pool from '../db';
import { optionalAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { gameId, durationSeconds } = req.body;
  if (!gameId || durationSeconds == null || durationSeconds < 1) {
    res.status(400).json({ message: '유효하지 않은 데이터입니다.' });
    return;
  }

  try {
    await pool.query(
      'INSERT INTO play_sessions (user_id, game_id, duration_seconds) VALUES ($1, $2, $3)',
      [req.userId ?? null, gameId, Math.round(durationSeconds)]
    );
    res.status(201).json({ message: '기록 완료' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

export default router;
