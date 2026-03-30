import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getMyGames, updateGame } from '../api';

const RESOLUTION_PRESETS = [
  { label: '960×600', w: 960, h: 600 },
  { label: '1280×720', w: 1280, h: 720 },
  { label: '1920×1080', w: 1920, h: 1080 },
  { label: '800×600', w: 800, h: 600 },
  { label: '1024×768', w: 1024, h: 768 },
];

const OS_LIST = [
  { key: 'windows' as const, label: 'Windows', icon: '🪟' },
  { key: 'mac' as const, label: 'macOS', icon: '🍎' },
  { key: 'linux' as const, label: 'Linux', icon: '🐧' },
];

type OsKey = 'windows' | 'mac' | 'linux';

interface Game {
  id: number;
  title: string;
  description: string;
  game_type: 'webgl' | 'build';
  current_version: string;
  thumbnail_url: string | null;
  view_count: number;
  wishlist_count: number;
  updated_at: string;
  native_width: number | null;
  native_height: number | null;
}

interface UpdateForm {
  description: string;
  version: string;
  gameFile: File | null;
  thumbnail: File | null;
  nativeW: string;
  nativeH: string;
  buildFiles: Partial<Record<OsKey, File>>;
}

export default function MyGames() {
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<UpdateForm>({
    description: '', version: '', gameFile: null, thumbnail: null, nativeW: '', nativeH: '', buildFiles: {},
  });
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    getMyGames()
      .then((res) => setGames(res.data.games))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (game: Game) => {
    setEditingId(game.id);
    setForm({
      description: game.description || '',
      version: '',
      gameFile: null,
      thumbnail: null,
      nativeW: game.native_width ? String(game.native_width) : '',
      nativeH: game.native_height ? String(game.native_height) : '',
      buildFiles: {},
    });
    setUpdateError('');
  };

  const setBuildFile = (os: OsKey, file: File | null) => {
    setForm((f) => {
      const next = { ...f.buildFiles };
      if (file) next[os] = file;
      else delete next[os];
      return { ...f, buildFiles: next };
    });
  };

  const handleUpdate = async (gameId: number, gameType: 'webgl' | 'build') => {
    setUpdating(true);
    setUpdateError('');
    const fd = new FormData();
    if (form.description) fd.append('description', form.description);
    if (form.version) fd.append('version', form.version);
    if (form.thumbnail) fd.append('thumbnail', form.thumbnail);

    if (gameType === 'webgl') {
      if (form.gameFile) fd.append('game', form.gameFile);
      fd.append('native_width', form.nativeW);
      fd.append('native_height', form.nativeH);
    } else {
      (Object.entries(form.buildFiles) as [OsKey, File][]).forEach(([os, file]) => {
        fd.append(`${os}_file`, file);
      });
    }

    try {
      await updateGame(gameId, fd);
      const res = await getMyGames();
      setGames(res.data.games);
      setEditingId(null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setUpdateError(e?.response?.data?.message || '업데이트에 실패했습니다.');
    } finally {
      setUpdating(false);
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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">내가 올린 게임</h1>
        <button
          onClick={() => navigate('/upload')}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm transition"
        >
          새 게임 업로드
        </button>
      </div>

      {games.length === 0 ? (
        <div className="text-center py-24 text-gray-500">
          <p className="mb-4">아직 업로드한 게임이 없습니다.</p>
          <button
            onClick={() => navigate('/upload')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg transition"
          >
            첫 게임 업로드하기
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {games.map((game) => (
            <div key={game.id} className="bg-gray-800 rounded-xl p-5">
              <div className="flex gap-4">
                {game.thumbnail_url && (
                  <img src={game.thumbnail_url} alt={game.title} className="w-24 h-16 object-cover rounded-lg shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Link to={`/game/${game.id}`} className="text-white font-semibold hover:text-indigo-400 transition">
                          {game.title}
                        </Link>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          game.game_type === 'webgl' ? 'bg-indigo-700 text-indigo-200' : 'bg-emerald-700 text-emerald-200'
                        }`}>
                          {game.game_type === 'webgl' ? 'WebGL' : 'Download'}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5">
                        v{game.current_version} · {new Date(game.updated_at).toLocaleDateString('ko-KR')} 업데이트
                      </p>
                    </div>
                    <div className="text-xs text-gray-500 flex gap-2 shrink-0">
                      <span>👁 {game.view_count}</span>
                      <span>🤍 {game.wishlist_count}</span>
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm mt-2 line-clamp-2">{game.description}</p>
                </div>
                <button
                  onClick={() => editingId === game.id ? setEditingId(null) : startEdit(game)}
                  className="text-sm text-gray-400 hover:text-white transition shrink-0"
                >
                  {editingId === game.id ? '취소' : '수정'}
                </button>
              </div>

              {editingId === game.id && (
                <div className="mt-4 pt-4 border-t border-gray-700 flex flex-col gap-3">
                  {/* 설명 */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">설명 수정</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      rows={3}
                      className="w-full bg-gray-700 text-white text-sm px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>

                  {/* 버전 & 썸네일 */}
                  <div className="flex gap-3 flex-wrap">
                    <div className="flex-1 min-w-32">
                      <label className="block text-xs text-gray-400 mb-1">새 버전 (비워두면 마이너 +1)</label>
                      <input
                        type="text"
                        value={form.version}
                        onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                        placeholder="예: 1.2.0"
                        className="w-full bg-gray-700 text-white text-sm px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex-1 min-w-32">
                      <label className="block text-xs text-gray-400 mb-1">새 썸네일</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setForm((f) => ({ ...f, thumbnail: e.target.files?.[0] || null }))}
                        className="w-full text-sm text-gray-400"
                      />
                    </div>
                  </div>

                  {/* WebGL 전용: 게임 파일 + 해상도 */}
                  {game.game_type === 'webgl' && (
                    <>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">새 게임 파일 (zip)</label>
                        <input
                          type="file"
                          accept=".zip"
                          onChange={(e) => setForm((f) => ({ ...f, gameFile: e.target.files?.[0] || null }))}
                          className="w-full text-sm text-gray-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5">
                          원본 해상도
                          {game.native_width && game.native_height && (
                            <span className="text-gray-600 ml-1">
                              (현재 {game.native_width} × {game.native_height})
                            </span>
                          )}
                        </label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {RESOLUTION_PRESETS.map((p) => (
                            <button
                              key={p.label}
                              type="button"
                              onClick={() => setForm((f) => ({ ...f, nativeW: String(p.w), nativeH: String(p.h) }))}
                              className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                                form.nativeW === String(p.w) && form.nativeH === String(p.h)
                                  ? 'border-indigo-500 bg-indigo-900/50 text-indigo-300'
                                  : 'border-gray-600 text-gray-400 hover:border-gray-500'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={form.nativeW}
                            onChange={(e) => setForm((f) => ({ ...f, nativeW: e.target.value }))}
                            min={1}
                            placeholder="가로"
                            className="w-24 bg-gray-700 text-white text-sm px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-indigo-500"
                          />
                          <span className="text-gray-500 text-sm">×</span>
                          <input
                            type="number"
                            value={form.nativeH}
                            onChange={(e) => setForm((f) => ({ ...f, nativeH: e.target.value }))}
                            min={1}
                            placeholder="세로"
                            className="w-24 bg-gray-700 text-white text-sm px-3 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Build 전용: OS별 파일 */}
                  {game.game_type === 'build' && (
                    <div>
                      <label className="block text-xs text-gray-400 mb-2">OS별 빌드 파일 교체</label>
                      <div className="flex flex-col gap-2">
                        {OS_LIST.map(({ key, label, icon }) => (
                          <div key={key} className="flex items-center gap-3 bg-gray-700/50 rounded-lg px-3 py-2">
                            <span>{icon}</span>
                            <span className="text-sm text-gray-300 w-16">{label}</span>
                            <div className="flex-1 text-xs text-gray-500">
                              {form.buildFiles[key] ? form.buildFiles[key]!.name : '파일 미선택'}
                            </div>
                            <button
                              type="button"
                              onClick={() => document.getElementById(`edit-build-${key}`)?.click()}
                              className="text-xs px-2.5 py-1 rounded-lg border border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200 transition"
                            >
                              선택
                            </button>
                            <input
                              id={`edit-build-${key}`}
                              type="file"
                              accept=".zip"
                              className="hidden"
                              onChange={(e) => setBuildFile(key, e.target.files?.[0] || null)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {updateError && <p className="text-red-400 text-sm">{updateError}</p>}

                  <button
                    onClick={() => handleUpdate(game.id, game.game_type)}
                    disabled={updating}
                    className="self-end bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-5 py-2 rounded-lg transition flex items-center gap-2"
                  >
                    {updating && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    업데이트
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
