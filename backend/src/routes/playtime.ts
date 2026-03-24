import { Router, Response } from 'express';
import pool from '../db';
import { optionalAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const MAX_SESSION_SECONDS = 24 * 60 * 60; // 24시간 상한

router.post('/', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { gameId, durationSeconds } = req.body;

  const parsedGameId = parseInt(gameId, 10);
  if (!Number.isFinite(parsedGameId) || parsedGameId <= 0) {
    res.status(400).json({ message: '유효하지 않은 게임 ID입니다.' });
    return;
  }

  const parsedDuration = Number(durationSeconds);
  if (!Number.isFinite(parsedDuration) || parsedDuration < 1 || parsedDuration > MAX_SESSION_SECONDS) {
    res.status(400).json({ message: `플레이 시간은 1~${MAX_SESSION_SECONDS}초 사이여야 합니다.` });
    return;
  }

  try {
    await pool.query(
      'INSERT INTO play_sessions (user_id, game_id, duration_seconds) VALUES ($1, $2, $3)',
      [req.userId ?? null, parsedGameId, Math.round(parsedDuration)]
    );
    res.status(201).json({ message: '기록 완료' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

export default router;
