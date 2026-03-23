import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadGame } from '../api';

export default function Upload() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [gameFile, setGameFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !gameFile) {
      setError('제목과 게임 파일은 필수입니다.');
      return;
    }
    if (!gameFile.name.endsWith('.zip')) {
      setError('zip 파일만 업로드 가능합니다.');
      return;
    }
    if (gameFile.size > 1024 * 1024 * 1024) {
      setError('파일 크기는 1GB를 초과할 수 없습니다.');
      return;
    }

    setError('');
    setLoading(true);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('version', version);
    formData.append('game', gameFile);
    if (thumbnail) formData.append('thumbnail', thumbnail);

    try {
      const res = await uploadGame(formData);
      navigate(`/game/${res.data.gameId}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || '업로드에 실패했습니다.');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-white mb-8">게임 업로드</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            게임 제목 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="게임 제목을 입력하세요"
            className="w-full bg-gray-800 text-white placeholder-gray-500 px-4 py-2.5 rounded-lg border border-gray-700 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">게임 설명</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="게임에 대한 설명을 입력하세요"
            rows={4}
            className="w-full bg-gray-800 text-white placeholder-gray-500 px-4 py-2.5 rounded-lg border border-gray-700 focus:outline-none focus:border-indigo-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">버전</label>
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.0.0"
            className="w-full bg-gray-800 text-white placeholder-gray-500 px-4 py-2.5 rounded-lg border border-gray-700 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            썸네일 이미지
          </label>
          <div
            className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 transition"
            onClick={() => document.getElementById('thumbnail-input')?.click()}
          >
            {thumbnail ? (
              <p className="text-gray-300 text-sm">{thumbnail.name}</p>
            ) : (
              <p className="text-gray-500 text-sm">클릭하여 이미지 선택 (PNG, JPG)</p>
            )}
          </div>
          <input
            id="thumbnail-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setThumbnail(e.target.files?.[0] || null)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            게임 파일 <span className="text-red-400">*</span>
          </label>
          <div
            className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 transition"
            onClick={() => document.getElementById('game-input')?.click()}
          >
            {gameFile ? (
              <div>
                <p className="text-gray-300 text-sm">{gameFile.name}</p>
                <p className="text-gray-500 text-xs mt-1">
                  {(gameFile.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-gray-500 text-sm">클릭하여 zip 파일 선택</p>
                <p className="text-gray-600 text-xs mt-1">최대 1GB, zip 형식만 지원</p>
              </div>
            )}
          </div>
          <input
            id="game-input"
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => setGameFile(e.target.files?.[0] || null)}
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        {loading && progress > 0 && (
          <div>
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <span>업로드 중...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div
                className="bg-indigo-500 h-1.5 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              업로드 중...
            </>
          ) : (
            '업로드'
          )}
        </button>
      </form>
    </div>
  );
}
