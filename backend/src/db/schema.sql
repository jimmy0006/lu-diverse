CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  game_type VARCHAR(10) NOT NULL DEFAULT 'webgl' CHECK (game_type IN ('webgl', 'build')),
  current_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  thumbnail_s3_key TEXT,
  native_width INT DEFAULT NULL,
  native_height INT DEFAULT NULL,
  view_count INT NOT NULL DEFAULT 0,
  wishlist_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE games ADD COLUMN IF NOT EXISTS native_width INT DEFAULT NULL;
ALTER TABLE games ADD COLUMN IF NOT EXISTS native_height INT DEFAULT NULL;
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_type VARCHAR(10) DEFAULT 'webgl';

-- OS별 빌드 파일 (build 타입 게임에서 사용)
CREATE TABLE IF NOT EXISTS game_builds (
  id SERIAL PRIMARY KEY,
  game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  os VARCHAR(10) NOT NULL CHECK (os IN ('windows', 'mac', 'linux')),
  s3_key TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  original_filename TEXT NOT NULL DEFAULT 'game.zip',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, os)
);

CREATE TABLE IF NOT EXISTS game_versions (
  id SERIAL PRIMARY KEY,
  game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  version VARCHAR(20) NOT NULL,
  s3_prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, version)
);

CREATE TABLE IF NOT EXISTS wishlists (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);

CREATE TABLE IF NOT EXISTS play_sessions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  game_id INT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  duration_seconds INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 조회수 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
