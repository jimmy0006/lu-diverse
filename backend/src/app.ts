import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { initDB } from './db';
import authRouter from './routes/auth';
import gamesRouter from './routes/games';
import wishlistRouter from './routes/wishlist';
import playtimeRouter from './routes/playtime';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/games', gamesRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/playtime', playtimeRouter);

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
