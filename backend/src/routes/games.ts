import { Router, Response } from 'express';
import multer from 'multer';
import pool from '../db';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth';
import { uploadGameZip, uploadThumbnail, getPresignedUrl } from '../services/s3Service';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
});

function bumpMinorVersion(version: string): string {
  const parts = version.split('.').map(Number);
  if (parts.length === 3) {
    parts[2] += 1;
    return parts.join('.');
  }
  return '1.0.1';
}

// 게임 목록 (검색, 정렬)
router.get('/', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, sort = 'popular', page = '1', limit = '12' } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let orderBy = 'g.view_count DESC';
  if (sort === 'latest') orderBy = 'g.created_at DESC';
  if (sort === 'wishlist') orderBy = 'g.wishlist_count DESC';

  const searchCondition = search
    ? `AND (g.title ILIKE $3 OR g.description ILIKE $3)`
    : '';
  const params: (string | number)[] = [parseInt(limit), offset];
  if (search) params.push(`%${search}%`);

  try {
    const result = await pool.query(
      `SELECT g.id, g.title, g.description, g.current_version, g.thumbnail_s3_key,
              g.view_count, g.wishlist_count, g.created_at, g.updated_at,
              u.username AS uploader
       FROM games g
       JOIN users u ON g.user_id = u.id
       WHERE 1=1 ${searchCondition}
       ORDER BY ${orderBy}
       LIMIT $1 OFFSET $2`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM games g WHERE 1=1 ${search ? `AND (g.title ILIKE $1 OR g.description ILIKE $1)` : ''}`,
      search ? [`%${search}%`] : []
    );

    const games = await Promise.all(
      result.rows.map(async (g) => ({
        ...g,
        thumbnail_url: g.thumbnail_s3_key ? await getPresignedUrl(g.thumbnail_s3_key) : null,
      }))
    );

    res.json({ games, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 내 게임 목록
router.get('/my', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT g.id, g.title, g.description, g.current_version, g.thumbnail_s3_key,
              g.view_count, g.wishlist_count, g.created_at, g.updated_at
       FROM games g WHERE g.user_id = $1 ORDER BY g.created_at DESC`,
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

// 게임 상세 + 버전 이력
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const gameId = parseInt(req.params.id as string);

  try {
    await pool.query('UPDATE games SET view_count = view_count + 1 WHERE id = $1', [gameId]);

    const result = await pool.query(
      `SELECT g.*, u.username AS uploader
       FROM games g JOIN users u ON g.user_id = u.id
       WHERE g.id = $1`,
      [gameId]
    );
    if (!result.rows.length) {
      res.status(404).json({ message: '게임을 찾을 수 없습니다.' });
      return;
    }

    const game = result.rows[0];
    const versionsResult = await pool.query(
      'SELECT id, version, s3_prefix, created_at FROM game_versions WHERE game_id = $1 ORDER BY created_at DESC',
      [gameId]
    );

    const latestVersion = versionsResult.rows[0];
    let playUrl: string | null = null;
    if (latestVersion) {
      playUrl = await getPresignedUrl(`${latestVersion.s3_prefix}index.html`);
    }

    let thumbnailUrl: string | null = null;
    if (game.thumbnail_s3_key) {
      thumbnailUrl = await getPresignedUrl(game.thumbnail_s3_key);
    }

    let wishlisted = false;
    if (req.userId) {
      const wl = await pool.query(
        'SELECT id FROM wishlists WHERE user_id = $1 AND game_id = $2',
        [req.userId, gameId]
      );
      wishlisted = wl.rows.length > 0;
    }

    res.json({
      game: { ...game, thumbnail_url: thumbnailUrl },
      versions: versionsResult.rows,
      play_url: playUrl,
      wishlisted,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// 게임 업로드
router.post(
  '/',
  requireAuth,
  upload.fields([
    { name: 'game', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { title, description, version = '1.0.0' } = req.body;
    const files = req.files as Record<string, Express.Multer.File[]>;

    if (!title || !files.game?.[0]) {
      res.status(400).json({ message: '게임 제목과 파일은 필수입니다.' });
      return;
    }

    const gameFile = files.game[0];
    if (gameFile.mimetype !== 'application/zip' && !gameFile.originalname.endsWith('.zip')) {
      res.status(400).json({ message: 'zip 파일만 업로드 가능합니다.' });
      return;
    }

    try {
      const gameResult = await pool.query(
        `INSERT INTO games (user_id, title, description, current_version)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [req.userId, title, description, version]
      );
      const gameId = gameResult.rows[0].id;

      let thumbnailKey: string | null = null;
      if (files.thumbnail?.[0]) {
        thumbnailKey = await uploadThumbnail(gameId, files.thumbnail[0].buffer, files.thumbnail[0].mimetype);
        await pool.query('UPDATE games SET thumbnail_s3_key = $1 WHERE id = $2', [thumbnailKey, gameId]);
      }

      const s3Prefix = await uploadGameZip(gameId, version, gameFile.buffer);
      await pool.query(
        'INSERT INTO game_versions (game_id, version, s3_prefix) VALUES ($1, $2, $3)',
        [gameId, version, s3Prefix]
      );

      res.status(201).json({ message: '업로드 완료', gameId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
  }
);

// 게임 업데이트
router.patch(
  '/:id',
  requireAuth,
  upload.fields([
    { name: 'game', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const gameId = parseInt(req.params.id as string);

    try {
      const gameResult = await pool.query(
        'SELECT user_id, current_version FROM games WHERE id = $1',
        [gameId]
      );
      if (!gameResult.rows.length) {
        res.status(404).json({ message: '게임을 찾을 수 없습니다.' });
        return;
      }
      if (gameResult.rows[0].user_id !== req.userId) {
        res.status(403).json({ message: '권한이 없습니다.' });
        return;
      }

      const currentVersion: string = gameResult.rows[0].current_version;
      const files = req.files as Record<string, Express.Multer.File[]>;
      const { description, version } = req.body;

      const newVersion = version || bumpMinorVersion(currentVersion);

      const updates: string[] = ['current_version = $1'];
      const params: (string | number)[] = [newVersion];

      if (description !== undefined) {
        updates.push(`description = $${params.length + 1}`);
        params.push(description);
      }

      if (files?.thumbnail?.[0]) {
        const thumbnailKey = await uploadThumbnail(gameId, files.thumbnail[0].buffer, files.thumbnail[0].mimetype);
        updates.push(`thumbnail_s3_key = $${params.length + 1}`);
        params.push(thumbnailKey);
      }

      params.push(gameId);
      await pool.query(
        `UPDATE games SET ${updates.join(', ')} WHERE id = $${params.length}`,
        params
      );

      if (files?.game?.[0]) {
        const s3Prefix = await uploadGameZip(gameId, newVersion, files.game[0].buffer);
        await pool.query(
          'INSERT INTO game_versions (game_id, version, s3_prefix) VALUES ($1, $2, $3) ON CONFLICT (game_id, version) DO UPDATE SET s3_prefix = $3',
          [gameId, newVersion, s3Prefix]
        );
      }

      res.json({ message: '업데이트 완료', version: newVersion });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
  }
);

export default router;
