import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getGame, addWishlist, removeWishlist } from '../api';
import GameFrame from '../components/GameFrame';
import { useAuth } from '../contexts/AuthContext';

interface Version {
  id: number;
  version: string;
  s3_prefix: string;
  created_at: string;
}

interface GameDetail {
  id: number;
  title: string;
  description: string;
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

export default function GamePlay() {
  const { id } = useParams<{ id: string }>();
  const { isLoggedIn } = useAuth();

  const [game, setGame] = useState<GameDetail | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
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
      // 에러 무시
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
        <h1 className="text-2xl font-bold text-white mt-2">{game.title}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {game.uploader} · v{game.current_version} · {new Date(game.updated_at).toLocaleDateString('ko-KR')}
        </p>
      </div>

      {/* 게임 프레임 */}
      {playUrl ? (
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

      {/* 버전 이력 */}
      {versions.length > 0 && (
        <div>
          <h2 className="text-white font-semibold mb-3">버전 이력</h2>
          <div className="flex flex-col gap-2">
            {versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-mono font-semibold ${
                      v.version === game.current_version ? 'text-indigo-400' : 'text-gray-300'
                    }`}
                  >
                    v{v.version}
                  </span>
                  {v.version === game.current_version && (
                    <span className="bg-indigo-900 text-indigo-300 text-xs px-2 py-0.5 rounded">최신</span>
                  )}
                </div>
                <span className="text-gray-500 text-sm">
                  {new Date(v.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
