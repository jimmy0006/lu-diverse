import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db';

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
  path: '/',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    res.status(400).json({ message: '모든 필드를 입력해주세요.' });
    return;
  }
  if (typeof username !== 'string' || username.length < 2 || username.length > 30) {
    res.status(400).json({ message: '사용자 이름은 2~30자여야 합니다.' });
    return;
  }
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ message: '올바른 이메일 형식이 아닙니다.' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    res.status(400).json({ message: '비밀번호는 8~128자여야 합니다.' });
    return;
  }

  try {
    const exists = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    if (exists.rows.length > 0) {
      res.status(409).json({ message: '이미 사용 중인 이메일 또는 사용자 이름입니다.' });
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hash]
    );
    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: '7d' }
    );

    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(201).json({ user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: '이메일과 비밀번호를 입력해주세요.' });
    return;
  }
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ message: '올바른 형식이 아닙니다.' });
    return;
  }

  try {
    const result = await pool.query(
      'SELECT id, username, email, password_hash FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];

    // 타이밍 공격 방지: 사용자가 없어도 bcrypt 비교를 수행
    const dummyHash = '$2b$12$invalidhashfortimingnormalization000000000000000000000';
    const passwordToCheck = user?.password_hash ?? dummyHash;
    const valid = await bcrypt.compare(password, passwordToCheck);

    if (!user || !valid) {
      res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET!,
      { algorithm: 'HS256', expiresIn: '7d' }
    );

    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

router.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('token', { path: '/' });
  res.json({ message: '로그아웃 완료' });
});

router.get('/me', async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ message: '인증이 필요합니다.' });
    return;
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] }) as {
      userId: number;
      username: string;
    };
    const result = await pool.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [payload.userId]
    );
    if (!result.rows.length) {
      res.clearCookie('token', { path: '/' });
      res.status(401).json({ message: '사용자를 찾을 수 없습니다.' });
      return;
    }
    res.json({ user: result.rows[0] });
  } catch {
    res.clearCookie('token', { path: '/' });
    res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }
});

export default router;
