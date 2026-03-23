import { Router, Response } from 'express';
import pool from '../db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getPresignedUrl } from '../services/s3Service';

const router = Router();

// 찜한 게임 목록 + 플레이 시간
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT g.id, g.title, g.current_version, g.thumbnail_s3_key,
              g.view_count, g.wishlist_count, g.created_at, g.updated_at,
              w.created_at AS wishlisted_at,
              COALESCE(SUM(ps.duration_seconds), 0) AS total_play_seconds
       FROM wishlists w
       JOIN games g ON w.game_id = g.id
       LEFT JOIN play_sessions ps ON ps.game_id = g.id AND ps.user_id = $1
       WHERE w.user_id = $1
       GROUP BY g.id, g.title, g.current_version, g.thumbnail_s3_key,
                g.view_count, g.wishlist_count, g.created_at, g.updated_at, w.created_at
       ORDER BY w.created_at DESC`,
      [req.userId]
    );

    const games = await Promise.all(
      result.rows.map(async (g) => ({
        ...g,
        thumbnail_url: g.thumbnail_s3_key ? await getPresignedUrl(g.thumbnail_s3_key) : null,
      }))
    );

    res.json({ games });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 찜하기
router.post('/:gameId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const gameId = parseInt(req.params.gameId as string);
  try {
    await pool.query(
      'INSERT INTO wishlists (user_id, game_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.userId, gameId]
    );
    await pool.query(
      'UPDATE games SET wishlist_count = (SELECT COUNT(*) FROM wishlists WHERE game_id = $1) WHERE id = $1',
      [gameId]
    );
    res.status(201).json({ message: '찜 완료' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 찜 취소
router.delete('/:gameId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const gameId = parseInt(req.params.gameId as string);
  try {
    await pool.query(
      'DELETE FROM wishlists WHERE user_id = $1 AND game_id = $2',
      [req.userId, gameId]
    );
    await pool.query(
      'UPDATE games SET wishlist_count = (SELECT COUNT(*) FROM wishlists WHERE game_id = $1) WHERE id = $1',
      [gameId]
    );
    res.json({ message: '찜 취소 완료' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

export default router;
