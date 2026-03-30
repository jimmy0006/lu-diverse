import { Router, Response } from 'express';
import multer from 'multer';
import pool from '../db';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth';
import {
  uploadGameZip,
  uploadBuildFile,
  uploadThumbnail,
  getPublicUrl,
  getPresignedDownloadUrl,
} from '../services/s3Service';
import { uploadLimiter } from '../middleware/rateLimits';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB
});

const SEMVER_RE = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const ALLOWED_THUMBNAIL_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const SUPPORTED_OS = ['windows', 'mac', 'linux'] as const;
type OS = typeof SUPPORTED_OS[number];

function validateZipFile(file: Express.Multer.File): boolean {
  return file.mimetype === 'application/zip' || file.originalname.toLowerCase().endsWith('.zip');
}

function parseId(raw: unknown): number | null {
  const n = parseInt(raw as string, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function bumpMinorVersion(version: string): string {
  const parts = version.split('.').map(Number);
  if (parts.length === 3) { parts[2] += 1; return parts.join('.'); }
  return '1.0.1';
}

function parseOptionalInt(val: string | undefined): number | null | undefined {
  if (val === undefined) return undefined;
  if (val === '') return null;
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : undefined;
}

// ─── 게임 목록 ───────────────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const { search, sort = 'popular', game_type } = req.query as Record<string, string>;
  const pageRaw = Math.max(1, parseInt(req.query.page as string) || 1);
  const limitRaw = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));
  const offset = (pageRaw - 1) * limitRaw;

  let orderBy = 'g.view_count DESC';
  if (sort === 'latest') orderBy = 'g.created_at DESC';
  if (sort === 'wishlist') orderBy = 'g.wishlist_count DESC';

  const conditions: string[] = [];
  const params: (string | number)[] = [limitRaw, offset];

  if (game_type === 'webgl' || game_type === 'build') {
    conditions.push(`g.game_type = $${params.length + 1}`);
    params.push(game_type);
  }
  if (search) {
    conditions.push(`(g.title ILIKE $${params.length + 1} OR g.description ILIKE $${params.length + 1})`);
    params.push(`%${search}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const result = await pool.query(
      `SELECT g.id, g.title, g.description, g.game_type, g.current_version, g.thumbnail_s3_key,
              g.native_width, g.native_height, g.view_count, g.wishlist_count, g.created_at, g.updated_at,
              u.username AS uploader
       FROM games g JOIN users u ON g.user_id = u.id
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $1 OFFSET $2`,
      params
    );

    const countParams = params.slice(2);
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM games g ${whereClause.replace('LIMIT $1 OFFSET $2', '')}`,
      countParams
    );

    const games = result.rows.map((g) => ({
      ...g,
      thumbnail_url: g.thumbnail_s3_key ? getPublicUrl(g.thumbnail_s3_key) : null,
    }));

    res.json({ games, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ─── 내 게임 목록 ─────────────────────────────────────────────────────────────
router.get('/my', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT g.id, g.title, g.description, g.game_type, g.current_version, g.thumbnail_s3_key,
              g.native_width, g.native_height, g.view_count, g.wishlist_count, g.created_at, g.updated_at
       FROM games g WHERE g.user_id = $1 ORDER BY g.created_at DESC`,
      [req.userId]
    );
    const games = result.rows.map((g) => ({
      ...g,
      thumbnail_url: g.thumbnail_s3_key ? getPublicUrl(g.thumbnail_s3_key) : null,
    }));
    res.json({ games });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ─── 빌드 파일 다운로드 Presigned URL ─────────────────────────────────────────
router.get('/:id/download/:os', async (req, res: Response): Promise<void> => {
  const gameId = parseId(req.params.id);
  const os = req.params.os as OS;

  if (!gameId) { res.status(400).json({ message: '유효하지 않은 게임 ID입니다.' }); return; }
  if (!SUPPORTED_OS.includes(os)) { res.status(400).json({ message: '지원하지 않는 OS입니다.' }); return; }

  try {
    const result = await pool.query(
      'SELECT s3_key, original_filename FROM game_builds WHERE game_id = $1 AND os = $2',
      [gameId, os]
    );
    if (!result.rows.length) {
      res.status(404).json({ message: `${os} 빌드 파일이 없습니다.` });
      return;
    }
    const { s3_key, original_filename } = result.rows[0];
    const url = await getPresignedDownloadUrl(s3_key, original_filename);
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ─── 게임 상세 ────────────────────────────────────────────────────────────────
router.get('/:id', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const gameId = parseId(req.params.id);
  if (!gameId) { res.status(400).json({ message: '유효하지 않은 게임 ID입니다.' }); return; }

  try {
    await pool.query('UPDATE games SET view_count = view_count + 1 WHERE id = $1', [gameId]);

    const result = await pool.query(
      `SELECT g.*, u.username AS uploader FROM games g JOIN users u ON g.user_id = u.id WHERE g.id = $1`,
      [gameId]
    );
    if (!result.rows.length) { res.status(404).json({ message: '게임을 찾을 수 없습니다.' }); return; }

    const game = result.rows[0];

    // WebGL: 버전 이력 + play URL
    const versionsResult = await pool.query(
      'SELECT id, version, s3_prefix, created_at FROM game_versions WHERE game_id = $1 ORDER BY created_at DESC',
      [gameId]
    );
    const latestVersion = versionsResult.rows[0];
    const playUrl = latestVersion ? getPublicUrl(`${latestVersion.s3_prefix}index.html`) : null;

    // Build: OS별 빌드 파일 목록
    const buildsResult = await pool.query(
      'SELECT os, file_size, original_filename FROM game_builds WHERE game_id = $1 ORDER BY os',
      [gameId]
    );

    const thumbnailUrl = game.thumbnail_s3_key ? getPublicUrl(game.thumbnail_s3_key) : null;

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
      play_url: game.game_type === 'webgl' ? playUrl : null,
      builds: buildsResult.rows,
      wishlisted,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ─── 게임 업로드 ──────────────────────────────────────────────────────────────
router.post(
  '/',
  requireAuth,
  uploadLimiter,
  upload.fields([
    { name: 'game', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
    { name: 'windows_file', maxCount: 1 },
    { name: 'mac_file', maxCount: 1 },
    { name: 'linux_file', maxCount: 1 },
  ]),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { title, description } = req.body;
    const version: string = req.body.version || '1.0.0';
    const gameType: string = req.body.game_type === 'build' ? 'build' : 'webgl';
    const files = req.files as Record<string, Express.Multer.File[]>;

    const nativeWidth = req.body.native_width ? parseInt(req.body.native_width, 10) : null;
    const nativeHeight = req.body.native_height ? parseInt(req.body.native_height, 10) : null;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ message: '게임 제목은 필수입니다.' }); return;
    }
    if (!SEMVER_RE.test(version)) {
      res.status(400).json({ message: '버전은 x.y.z 형식이어야 합니다.' }); return;
    }

    const thumbnailFile = files?.thumbnail?.[0];
    if (thumbnailFile && !ALLOWED_THUMBNAIL_TYPES.includes(thumbnailFile.mimetype)) {
      res.status(400).json({ message: '썸네일은 jpeg, png, gif, webp만 가능합니다.' }); return;
    }

    if (gameType === 'webgl') {
      if (!files?.game?.[0]) { res.status(400).json({ message: 'WebGL zip 파일은 필수입니다.' }); return; }
      if (!validateZipFile(files.game[0])) { res.status(400).json({ message: 'zip 파일만 업로드 가능합니다.' }); return; }
    } else {
      const hasAnyBuild = SUPPORTED_OS.some((os) => files?.[`${os}_file`]?.[0]);
      if (!hasAnyBuild) { res.status(400).json({ message: '최소 하나의 OS 빌드 파일을 업로드해야 합니다.' }); return; }
    }

    try {
      const gameResult = await pool.query(
        `INSERT INTO games (user_id, title, description, game_type, current_version, native_width, native_height)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [req.userId, title, description, gameType, version, nativeWidth, nativeHeight]
      );
      const gameId = gameResult.rows[0].id;

      if (thumbnailFile) {
        const thumbnailKey = await uploadThumbnail(gameId, thumbnailFile.buffer, thumbnailFile.mimetype);
        await pool.query('UPDATE games SET thumbnail_s3_key = $1 WHERE id = $2', [thumbnailKey, gameId]);
      }

      if (gameType === 'webgl') {
        const s3Prefix = await uploadGameZip(gameId, version, files.game[0].buffer);
        await pool.query(
          'INSERT INTO game_versions (game_id, version, s3_prefix) VALUES ($1, $2, $3)',
          [gameId, version, s3Prefix]
        );
      } else {
        for (const os of SUPPORTED_OS) {
          const f = files?.[`${os}_file`]?.[0];
          if (!f) continue;
          const s3Key = await uploadBuildFile(gameId, os, f.buffer, f.originalname);
          await pool.query(
            `INSERT INTO game_builds (game_id, os, s3_key, file_size, original_filename)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (game_id, os) DO UPDATE SET s3_key=$3, file_size=$4, original_filename=$5`,
            [gameId, os, s3Key, f.size, f.originalname]
          );
        }
      }

      res.status(201).json({ message: '업로드 완료', gameId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
  }
);

// ─── 게임 업데이트 ────────────────────────────────────────────────────────────
router.patch(
  '/:id',
  requireAuth,
  uploadLimiter,
  upload.fields([
    { name: 'game', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
    { name: 'windows_file', maxCount: 1 },
    { name: 'mac_file', maxCount: 1 },
    { name: 'linux_file', maxCount: 1 },
  ]),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const gameId = parseId(req.params.id);
    if (!gameId) { res.status(400).json({ message: '유효하지 않은 게임 ID입니다.' }); return; }

    try {
      const gameResult = await pool.query(
        'SELECT user_id, current_version, game_type FROM games WHERE id = $1',
        [gameId]
      );
      if (!gameResult.rows.length) { res.status(404).json({ message: '게임을 찾을 수 없습니다.' }); return; }
      if (gameResult.rows[0].user_id !== req.userId) { res.status(403).json({ message: '권한이 없습니다.' }); return; }

      const currentVersion: string = gameResult.rows[0].current_version;
      const gameType: string = gameResult.rows[0].game_type;
      const files = req.files as Record<string, Express.Multer.File[]>;
      const { description, version } = req.body;

      const nativeWidth = parseOptionalInt(req.body.native_width);
      const nativeHeight = parseOptionalInt(req.body.native_height);

      if (version && !SEMVER_RE.test(version)) {
        res.status(400).json({ message: '버전은 x.y.z 형식이어야 합니다.' }); return;
      }
      if (files?.game?.[0] && !validateZipFile(files.game[0])) {
        res.status(400).json({ message: 'zip 파일만 업로드 가능합니다.' }); return;
      }
      if (files?.thumbnail?.[0] && !ALLOWED_THUMBNAIL_TYPES.includes(files.thumbnail[0].mimetype)) {
        res.status(400).json({ message: '썸네일은 jpeg, png, gif, webp만 가능합니다.' }); return;
      }

      const newVersion = version || bumpMinorVersion(currentVersion);
      const updates: string[] = ['current_version = $1'];
      const params: (string | number)[] = [newVersion];

      if (description !== undefined) { updates.push(`description = $${params.length + 1}`); params.push(description); }
      if (nativeWidth !== undefined) { updates.push(`native_width = $${params.length + 1}`); params.push(nativeWidth ?? (null as unknown as number)); }
      if (nativeHeight !== undefined) { updates.push(`native_height = $${params.length + 1}`); params.push(nativeHeight ?? (null as unknown as number)); }

      if (files?.thumbnail?.[0]) {
        const thumbnailKey = await uploadThumbnail(gameId, files.thumbnail[0].buffer, files.thumbnail[0].mimetype);
        updates.push(`thumbnail_s3_key = $${params.length + 1}`);
        params.push(thumbnailKey);
      }

      params.push(gameId);
      await pool.query(`UPDATE games SET ${updates.join(', ')} WHERE id = $${params.length}`, params);

      if (gameType === 'webgl' && files?.game?.[0]) {
        const s3Prefix = await uploadGameZip(gameId, newVersion, files.game[0].buffer);
        await pool.query(
          'INSERT INTO game_versions (game_id, version, s3_prefix) VALUES ($1, $2, $3) ON CONFLICT (game_id, version) DO UPDATE SET s3_prefix = $3',
          [gameId, newVersion, s3Prefix]
        );
      } else if (gameType === 'build') {
        for (const os of SUPPORTED_OS) {
          const f = files?.[`${os}_file`]?.[0];
          if (!f) continue;
          const s3Key = await uploadBuildFile(gameId, os, f.buffer, f.originalname);
          await pool.query(
            `INSERT INTO game_builds (game_id, os, s3_key, file_size, original_filename)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (game_id, os) DO UPDATE SET s3_key=$3, file_size=$4, original_filename=$5`,
            [gameId, os, s3Key, f.size, f.originalname]
          );
        }
      }

      res.json({ message: '업데이트 완료', version: newVersion });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
  }
);

export default router;
