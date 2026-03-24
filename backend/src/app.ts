import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { initDB } from './db';
import { authLimiter, apiLimiter } from './middleware/rateLimits';
import authRouter from './routes/auth';
import gamesRouter from './routes/games';
import wishlistRouter from './routes/wishlist';
import playtimeRouter from './routes/playtime';

// Fail fast if required secrets are missing
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be set and at least 32 characters long.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_ORIGIN) {
  console.error('FATAL: CLIENT_ORIGIN must be set in production.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/games', apiLimiter, gamesRouter);
app.use('/api/wishlist', apiLimiter, wishlistRouter);
app.use('/api/playtime', apiLimiter, playtimeRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

async function start() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
