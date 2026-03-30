import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadGame } from '../api';

const RESOLUTION_PRESETS = [
  { label: '960 × 600', w: 960, h: 600 },
  { label: '1280 × 720', w: 1280, h: 720 },
  { label: '1920 × 1080', w: 1920, h: 1080 },
  { label: '800 × 600', w: 800, h: 600 },
  { label: '1024 × 768', w: 1024, h: 768 },
];

const OS_LIST = [
  { key: 'windows', label: 'Windows', icon: '🪟' },
  { key: 'mac', label: 'macOS', icon: '🍎' },
  { key: 'linux', label: 'Linux', icon: '🐧' },
] as const;

type GameTab = 'webgl' | 'build';
type OsKey = 'windows' | 'mac' | 'linux';

export default function Upload() {
  const navigate = useNavigate();

  // 탭 상태
  const [tab, setTab] = useState<GameTab>('webgl');

  // 공통
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // WebGL 전용
  const [gameFile, setGameFile] = useState<File | null>(null);
  const [nativeW, setNativeW] = useState('');
  const [nativeH, setNativeH] = useState('');
  const [showZipGuide, setShowZipGuide] = useState(false);

  // Build 전용
  const [buildFiles, setBuildFiles] = useState<Partial<Record<OsKey, File>>>({});

  const handlePreset = (w: number, h: number) => {
    setNativeW(String(w));
    setNativeH(String(h));
  };

  const setBuildFile = (os: OsKey, file: File | null) => {
    setBuildFiles((prev) => {
      const next = { ...prev };
      if (file) next[os] = file;
      else delete next[os];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) { setError('게임 제목은 필수입니다.'); return; }

    if (tab === 'webgl') {
      if (!gameFile) { setError('WebGL zip 파일은 필수입니다.'); return; }
      if (!gameFile.name.endsWith('.zip')) { setError('zip 파일만 업로드 가능합니다.'); return; }
      if (gameFile.size > 1024 * 1024 * 1024) { setError('파일 크기는 1GB를 초과할 수 없습니다.'); return; }
    } else {
      const selectedOsList = Object.keys(buildFiles) as OsKey[];
      if (selectedOsList.length === 0) { setError('최소 하나의 OS 빌드 파일을 업로드해야 합니다.'); return; }
    }

    setError('');
    setLoading(true);

    const formData = new FormData();
    formData.append('game_type', tab);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('version', version);
    if (thumbnail) formData.append('thumbnail', thumbnail);

    if (tab === 'webgl') {
      formData.append('game', gameFile!);
      if (nativeW) formData.append('native_width', nativeW);
      if (nativeH) formData.append('native_height', nativeH);
    } else {
      (Object.entries(buildFiles) as [OsKey, File][]).forEach(([os, file]) => {
        formData.append(`${os}_file`, file);
      });
    }

    try {
      const res = await uploadGame(formData);
      navigate(`/game/${res.data.gameId}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message || '업로드에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-white mb-6">게임 업로드</h1>

      {/* 탭 스위처 */}
      <div className="relative flex bg-gray-800 rounded-xl p-1 mb-8 w-full">
        {/* 슬라이딩 바 */}
        <div
          className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-indigo-600 rounded-lg transition-transform duration-200"
          style={{ transform: tab === 'webgl' ? 'translateX(0)' : 'translateX(calc(100% + 8px))' }}
        />
        <button
          type="button"
          onClick={() => setTab('webgl')}
          className={`relative z-10 flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors duration-200 ${
            tab === 'webgl' ? 'text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          🌐 WebGL
        </button>
        <button
          type="button"
          onClick={() => setTab('build')}
          className={`relative z-10 flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors duration-200 ${
            tab === 'build' ? 'text-white' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          📦 게임 파일
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* 제목 */}
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

        {/* 설명 */}
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

        {/* 버전 */}
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

        {/* 썸네일 */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">썸네일 이미지</label>
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

        {/* ── WebGL 전용 ── */}
        {tab === 'webgl' && (
          <>
            {/* 원본 해상도 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                게임 원본 해상도
                <span className="text-gray-500 font-normal ml-2">(선택사항 — Unity 빌드 설정의 해상도)</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {RESOLUTION_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handlePreset(p.w, p.h)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                      nativeW === String(p.w) && nativeH === String(p.h)
                        ? 'border-indigo-500 bg-indigo-900/50 text-indigo-300'
                        : 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                {(nativeW || nativeH) && (
                  <button
                    type="button"
                    onClick={() => { setNativeW(''); setNativeH(''); }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-500 hover:text-gray-300 transition"
                  >
                    초기화
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={nativeW}
                  onChange={(e) => setNativeW(e.target.value)}
                  min={1}
                  placeholder="가로 (px)"
                  className="w-32 bg-gray-800 text-white placeholder-gray-500 px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm"
                />
                <span className="text-gray-500">×</span>
                <input
                  type="number"
                  value={nativeH}
                  onChange={(e) => setNativeH(e.target.value)}
                  min={1}
                  placeholder="세로 (px)"
                  className="w-32 bg-gray-800 text-white placeholder-gray-500 px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm"
                />
                {nativeW && nativeH && (
                  <span className="text-xs text-gray-500">
                    비율 {(parseInt(nativeW) / parseInt(nativeH)).toFixed(2)}:1
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 mt-1.5">
                입력하지 않으면 기본값(960 × 600)이 사용됩니다.
              </p>
            </div>

            {/* 게임 파일 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">
                  게임 파일 (WebGL zip) <span className="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowZipGuide((v) => !v)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                  </svg>
                  zip 구성 방법
                </button>
              </div>

              {showZipGuide && (
                <div className="mb-3 bg-gray-900 border border-gray-700 rounded-xl p-4 text-xs text-gray-300 space-y-3">
                  <p className="font-semibold text-gray-200">Unity WebGL Build → zip 파일 구성 방법</p>
                  <p className="text-gray-400">
                    Unity에서 <strong className="text-white">File → Build Settings → WebGL → Build</strong>로 빌드하면
                    아래 두 가지 구조 중 하나가 생성됩니다. <strong className="text-indigo-300">두 구조 모두 지원합니다.</strong>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-indigo-300 font-medium mb-2">구조 A — 최상위 폴더 있음</p>
                      <pre className="text-gray-400 leading-relaxed whitespace-pre">{`MyGame.zip
└── MyGame/
    ├── index.html
    ├── Build/
    │   ├── game.loader.js
    │   ├── game.data
    │   ├── game.wasm
    │   └── game.framework.js
    └── TemplateData/
        └── style.css`}</pre>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-3">
                      <p className="text-indigo-300 font-medium mb-2">구조 B — 루트에 바로 파일</p>
                      <pre className="text-gray-400 leading-relaxed whitespace-pre">{`MyGame.zip
├── index.html
├── Build/
│   ├── game.loader.js
│   ├── game.data
│   ├── game.wasm
│   └── game.framework.js
└── TemplateData/
    └── style.css`}</pre>
                    </div>
                  </div>
                  <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3 space-y-1">
                    <p className="text-yellow-300 font-medium">주의사항</p>
                    <ul className="text-gray-400 space-y-0.5 list-disc list-inside">
                      <li>반드시 <strong className="text-white">index.html</strong>이 포함되어야 합니다.</li>
                      <li>최대 파일 수: 500개 / 최대 압축 해제 크기: 3GB</li>
                      <li>zip 파일 자체 크기: 최대 1GB</li>
                    </ul>
                  </div>
                </div>
              )}

              <div
                className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-500 transition"
                onClick={() => document.getElementById('game-input')?.click()}
              >
                {gameFile ? (
                  <div>
                    <p className="text-gray-300 text-sm">{gameFile.name}</p>
                    <p className="text-gray-500 text-xs mt-1">{(gameFile.size / 1024 / 1024).toFixed(1)} MB</p>
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
          </>
        )}

        {/* ── 게임 파일(Build) 전용 ── */}
        {tab === 'build' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              OS별 빌드 파일 <span className="text-red-400">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-4">
              지원할 OS를 선택하고 각각의 zip 파일을 업로드하세요. 최소 하나 이상 필요합니다.
            </p>
            <div className="flex flex-col gap-4">
              {OS_LIST.map(({ key, label, icon }) => (
                <div key={key} className="flex items-center gap-4 bg-gray-800 rounded-xl px-4 py-3">
                  <span className="text-2xl w-8 text-center">{icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-200">{label}</p>
                    {buildFiles[key] ? (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {buildFiles[key]!.name} ({(buildFiles[key]!.size / 1024 / 1024).toFixed(1)} MB)
                      </p>
                    ) : (
                      <p className="text-xs text-gray-600 mt-0.5">파일 미선택</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => document.getElementById(`build-input-${key}`)?.click()}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                        buildFiles[key]
                          ? 'border-emerald-600 bg-emerald-900/40 text-emerald-300 hover:bg-emerald-900/60'
                          : 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {buildFiles[key] ? '변경' : '선택'}
                    </button>
                    {buildFiles[key] && (
                      <button
                        type="button"
                        onClick={() => setBuildFile(key, null)}
                        className="text-xs px-2 py-1.5 rounded-lg border border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-800 transition"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <input
                    id={`build-input-${key}`}
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

        {error && (
          <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-4 py-2">
            {error}
          </p>
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
