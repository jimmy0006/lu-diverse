import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: number;
  username?: string;
}

const JWT_OPTIONS: jwt.VerifyOptions = { algorithms: ['HS256'] };

function extractToken(req: Request): string | null {
  // 1순위: httpOnly 쿠키
  if (req.cookies?.token) return req.cookies.token as string;
  // 2순위: Authorization 헤더 (API 클라이언트 호환성 유지)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.split(' ')[1];
  return null;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ message: '인증이 필요합니다.' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!, JWT_OPTIONS) as {
      userId: number;
      username: string;
    };
    req.userId = payload.userId;
    req.username = payload.username;
    next();
  } catch {
    res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!, JWT_OPTIONS) as {
        userId: number;
        username: string;
      };
      req.userId = payload.userId;
      req.username = payload.username;
    } catch {
      // 토큰 오류 시 무시 (비로그인으로 처리)
    }
  }
  next();
}
