import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getWishlist, removeWishlist } from '../api';

interface WishlistedGame {
  id: number;
  title: string;
  current_version: string;
  thumbnail_url: string | null;
  view_count: number;
  wishlist_count: number;
  updated_at: string;
  wishlisted_at: string;
  total_play_seconds: number;
}

function formatPlayTime(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

export default function MyWishlist() {
  const [games, setGames] = useState<WishlistedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    getWishlist()
      .then((res) => setGames(res.data.games))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRemove = async (gameId: number) => {
    setRemovingId(gameId);
    try {
      await removeWishlist(gameId);
      setGames((gs) => gs.filter((g) => g.id !== gameId));
    } catch {
      // 에러 무시
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-white mb-8">내가 찜한 게임</h1>

      {games.length === 0 ? (
        <div className="text-center py-24 text-gray-500">
          <p className="mb-4">찜한 게임이 없습니다.</p>
          <Link
            to="/"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg transition inline-block"
          >
            게임 둘러보기
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {games.map((game) => (
            <div key={game.id} className="bg-gray-800 rounded-xl p-4 flex gap-4 items-center">
              {game.thumbnail_url ? (
                <img
                  src={game.thumbnail_url}
                  alt={game.title}
                  className="w-20 h-14 object-cover rounded-lg shrink-0"
                />
              ) : (
                <div className="w-20 h-14 bg-gray-700 rounded-lg shrink-0 flex items-center justify-center text-2xl">
                  🎮
                </div>
              )}
              <div className="flex-1 min-w-0">
                <Link
                  to={`/game/${game.id}`}
                  className="text-white font-medium hover:text-indigo-400 transition"
                >
                  {game.title}
                </Link>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                  <span>v{game.current_version}</span>
                  <span>업데이트 {new Date(game.updated_at).toLocaleDateString('ko-KR')}</span>
                  <span>찜 {new Date(game.wishlisted_at).toLocaleDateString('ko-KR')}</span>
                  <span>👁 {game.view_count.toLocaleString()}</span>
                  <span>🤍 {game.wishlist_count.toLocaleString()}</span>
                </div>
                <div className="mt-1.5 text-xs text-indigo-400 font-medium">
                  플레이 시간: {formatPlayTime(Number(game.total_play_seconds))}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link
                  to={`/game/${game.id}`}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-1.5 rounded-lg transition"
                >
                  플레이
                </Link>
                <button
                  onClick={() => handleRemove(game.id)}
                  disabled={removingId === game.id}
                  className="text-gray-500 hover:text-red-400 text-sm transition disabled:opacity-40"
                >
                  찜 취소
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
