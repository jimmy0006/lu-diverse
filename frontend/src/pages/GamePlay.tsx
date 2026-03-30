import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getGame, addWishlist, removeWishlist, getGameDownloadUrl } from '../api';
import GameFrame from '../components/GameFrame';
import { useAuth } from '../contexts/AuthContext';

interface Version {
  id: number;
  version: string;
  s3_prefix: string;
  created_at: string;
}

interface BuildFile {
  os: 'windows' | 'mac' | 'linux';
  file_size: number;
  original_filename: string;
}

interface GameDetail {
  id: number;
  title: string;
  description: string;
  game_type: 'webgl' | 'build';
  current_version: string;
  thumbnail_url: string | null;
  view_count: number;
  wishlist_count: number;
  uploader: string;
  created_at: string;
  updated_at: string;
  native_width: number | null;
  native_height: number | null;
}

const OS_INFO: Record<string, { label: string; icon: string }> = {
  windows: { label: 'Windows', icon: '🪟' },
  mac: { label: 'macOS', icon: '🍎' },
  linux: { label: 'Linux', icon: '🐧' },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function DownloadButton({ gameId, build }: { gameId: number; build: BuildFile }) {
  const [loading, setLoading] = useState(false);
  const info = OS_INFO[build.os] ?? { label: build.os, icon: '💾' };

  const handleDownload = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await getGameDownloadUrl(gameId, build.os);
      const a = document.createElement('a');
      a.href = res.data.url;
      a.download = build.original_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      alert('다운로드 링크 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="flex items-center gap-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-emerald-600 rounded-xl px-5 py-3.5 transition group w-full sm:w-auto disabled:opacity-50"
    >
      <span className="text-2xl">{info.icon}</span>
      <div className="text-left flex-1">
        <p className="text-white font-semibold text-sm group-hover:text-emerald-300 transition">
          {loading ? '링크 생성 중...' : `${info.label} 다운로드`}
        </p>
        <p className="text-gray-500 text-xs mt-0.5">{formatBytes(build.file_size)}</p>
      </div>
      {loading ? (
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500 group-hover:text-emerald-400 transition">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
    </button>
  );
}

export default function GamePlay() {
  const { id } = useParams<{ id: string }>();
  const { isLoggedIn } = useAuth();

  const [game, setGame] = useState<GameDetail | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [builds, setBuilds] = useState<BuildFile[]>([]);
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getGame(parseInt(id))
      .then((res) => {
        setGame(res.data.game);
        setVersions(res.data.versions);
        setPlayUrl(res.data.play_url);
        setBuilds(res.data.builds ?? []);
        setWishlisted(res.data.wishlisted);
        setWishlistCount(res.data.game.wishlist_count);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleWishlist = async () => {
    if (!id || wishlistLoading) return;
    setWishlistLoading(true);
    try {
      if (wishlisted) {
        await removeWishlist(parseInt(id));
        setWishlisted(false);
        setWishlistCount((n) => n - 1);
      } else {
        await addWishlist(parseInt(id));
        setWishlisted(true);
        setWishlistCount((n) => n + 1);
      }
    } catch {
      // ignore
    } finally {
      setWishlistLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="text-center py-24 text-gray-400">
        게임을 찾을 수 없습니다. <Link to="/" className="text-indigo-400 hover:underline">홈으로</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">
      <div>
        <Link to="/" className="text-gray-500 hover:text-gray-300 text-sm transition">← 목록으로</Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-bold text-white">{game.title}</h1>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            game.game_type === 'webgl' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'
          }`}>
            {game.game_type === 'webgl' ? 'WebGL' : 'Download'}
          </span>
        </div>
        <p className="text-gray-500 text-sm mt-1">
          {game.uploader} · v{game.current_version} · {new Date(game.updated_at).toLocaleDateString('ko-KR')}
        </p>
      </div>

      {/* WebGL 게임 프레임 */}
      {game.game_type === 'webgl' && (
        playUrl ? (
          <GameFrame
            gameId={game.id}
            playUrl={playUrl}
            initialNativeW={game.native_width}
            initialNativeH={game.native_height}
          />
        ) : (
          <div className="w-full h-64 bg-gray-800 rounded-xl flex items-center justify-center text-gray-500">
            게임 파일을 불러올 수 없습니다.
          </div>
        )
      )}

      {/* 빌드 파일 다운로드 섹션 */}
      {game.game_type === 'build' && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-2xl p-6">
          {game.thumbnail_url && (
            <img
              src={game.thumbnail_url}
              alt={game.title}
              className="w-full max-h-64 object-cover rounded-xl mb-6"
            />
          )}
          <h2 className="text-white font-semibold text-lg mb-2">다운로드</h2>
          <p className="text-gray-400 text-sm mb-5">
            아래에서 운영체제에 맞는 빌드 파일을 다운로드하세요. 다운로드 링크는 1시간 동안 유효합니다.
          </p>
          {builds.length > 0 ? (
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              {builds.map((build) => (
                <DownloadButton key={build.os} gameId={game.id} build={build} />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">현재 다운로드 가능한 빌드 파일이 없습니다.</p>
          )}
        </div>
      )}

      {/* 조회수, 찜 */}
      <div className="flex items-center gap-6 py-4 border-y border-gray-800">
        <div className="flex items-center gap-2 text-gray-400">
          <span className="text-lg">👁</span>
          <span className="text-sm">{game.view_count.toLocaleString()} 조회</span>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <span className="text-lg">🤍</span>
          <span className="text-sm">{wishlistCount.toLocaleString()} 찜</span>
        </div>
        {isLoggedIn && (
          <button
            onClick={handleWishlist}
            disabled={wishlistLoading}
            className={`ml-auto flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition ${
              wishlisted
                ? 'bg-pink-600 hover:bg-pink-700 text-white'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
            }`}
          >
            {wishlisted ? '❤️ 찜 취소' : '🤍 찜하기'}
          </button>
        )}
      </div>

      {/* 게임 설명 */}
      {game.description && (
        <div>
          <h2 className="text-white font-semibold mb-2">게임 설명</h2>
          <p className="text-gray-400 leading-relaxed whitespace-pre-wrap">{game.description}</p>
        </div>
      )}

      {/* 버전 이력 (WebGL만) */}
      {game.game_type === 'webgl' && versions.length > 0 && (
        <div>
          <h2 className="text-white font-semibold mb-3">버전 이력</h2>
          <div className="flex flex-col gap-2">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-mono font-semibold ${v.version === game.current_version ? 'text-indigo-400' : 'text-gray-300'}`}>
                    v{v.version}
                  </span>
                  {v.version === game.current_version && (
                    <span className="bg-indigo-900 text-indigo-300 text-xs px-2 py-0.5 rounded">최신</span>
                  )}
                </div>
                <span className="text-gray-500 text-sm">{new Date(v.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
