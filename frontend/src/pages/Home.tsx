import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGames } from '../api';
import GameCard, { type Game } from '../components/GameCard';
import { useAuth } from '../contexts/AuthContext';

const SORT_OPTIONS = [
  { label: '인기순', value: 'popular' },
  { label: '최신순', value: 'latest' },
  { label: '찜 많은 순', value: 'wishlist' },
];

export default function Home() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  const [games, setGames] = useState<Game[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('popular');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const limit = 12;
  const totalPages = Math.ceil(total / limit);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getGames({ search: search || undefined, sort, page, limit });
      setGames(res.data.games);
      setTotal(res.data.total);
    } catch {
      // 에러 무시
    } finally {
      setLoading(false);
    }
  }, [search, sort, page]);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchGames();
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* 헤더 배너 */}
      <div className="bg-gradient-to-r from-indigo-900 to-purple-900 rounded-2xl p-8 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">WebGL 게임 플랫폼</h1>
          <p className="text-indigo-200">누구나 WebGL 게임을 업로드하고 플레이할 수 있습니다.</p>
        </div>
        {isLoggedIn && (
          <button
            onClick={() => navigate('/upload')}
            className="bg-white text-indigo-900 font-semibold px-6 py-2.5 rounded-xl hover:bg-indigo-50 transition shrink-0"
          >
            게임 업로드
          </button>
        )}
      </div>

      {/* 검색 & 정렬 */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-1 gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="게임 검색..."
            className="flex-1 bg-gray-800 text-white placeholder-gray-500 px-4 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg transition"
          >
            검색
          </button>
        </form>
        <div className="flex gap-2">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setSort(opt.value); setPage(1); }}
              className={`px-4 py-2 rounded-lg text-sm transition ${
                sort === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 게임 그리드 */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : games.length === 0 ? (
        <div className="text-center py-24 text-gray-500">
          {search ? `"${search}"에 대한 검색 결과가 없습니다.` : '아직 업로드된 게임이 없습니다.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 rounded-lg bg-gray-800 text-gray-400 disabled:opacity-40 hover:bg-gray-700 transition"
          >
            이전
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - page) <= 2)
            .map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-4 py-2 rounded-lg transition ${
                  p === page ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {p}
              </button>
            ))}
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 rounded-lg bg-gray-800 text-gray-400 disabled:opacity-40 hover:bg-gray-700 transition"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
