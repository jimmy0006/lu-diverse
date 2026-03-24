import { useEffect, useRef, useState } from 'react';
import { recordPlaytime } from '../api';

interface GameFrameProps {
  gameId: number;
  playUrl: string;
}

const PRESETS = [
  { label: '960 × 600', w: 960, h: 600 },
  { label: '1280 × 720', w: 1280, h: 720 },
  { label: '1920 × 1080', w: 1920, h: 1080 },
  { label: '800 × 600', w: 800, h: 600 },
  { label: '1024 × 768', w: 1024, h: 768 },
];

const MIN_FRAME = 200;

export default function GameFrame({ gameId, playUrl }: GameFrameProps) {
  // Playtime tracking
  const startTimeRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  // Native game resolution (게임이 빌드된 원본 해상도)
  const [nativeW, setNativeW] = useState(960);
  const [nativeH, setNativeH] = useState(600);

  // Frame container size (사용자가 조절하는 프레임 크기)
  const [frameW, setFrameW] = useState(960);
  const [frameH, setFrameH] = useState(600);

  // Settings panel
  const [showSettings, setShowSettings] = useState(false);
  const [inputW, setInputW] = useState('960');
  const [inputH, setInputH] = useState('600');

  const wrapperRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // 마운트 시 부모 너비에 맞게 초기 프레임 크기 설정
  useEffect(() => {
    const parentW = wrapperRef.current?.parentElement?.clientWidth ?? 960;
    const initW = Math.min(parentW, 960);
    const initH = Math.round(initW * (600 / 960));
    setFrameW(initW);
    setFrameH(initH);
  }, []);

  // 게임을 프레임에 맞게 축소하는 배율 계산
  // 프레임이 게임보다 크면 scale > 1, 작으면 scale < 1
  const scale = Math.min(frameW / nativeW, frameH / nativeH);
  const scaledW = Math.round(nativeW * scale);
  const scaledH = Math.round(nativeH * scale);
  // 프레임 내 중앙 정렬 오프셋
  const offsetX = Math.round((frameW - scaledW) / 2);
  const offsetY = Math.round((frameH - scaledH) / 2);

  // 리사이즈 드래그 핸들
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY, w: frameW, h: frameH };

    const onMove = (evt: MouseEvent) => {
      if (!isDraggingRef.current) return;
      setFrameW(Math.max(MIN_FRAME, Math.round(dragStartRef.current.w + evt.clientX - dragStartRef.current.x)));
      setFrameH(Math.max(MIN_FRAME, Math.round(dragStartRef.current.h + evt.clientY - dragStartRef.current.y)));
    };

    const onUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const applyNativeResolution = () => {
    const w = parseInt(inputW, 10);
    const h = parseInt(inputH, 10);
    if (w > 0 && h > 0) {
      setNativeW(w);
      setNativeH(h);
      setShowSettings(false);
    }
  };

  // 플레이타임 추적
  useEffect(() => {
    const handleFocus = () => {
      if (!activeRef.current) {
        activeRef.current = true;
        startTimeRef.current = Date.now();
      }
    };

    const handleBlur = () => {
      if (activeRef.current && startTimeRef.current) {
        activeRef.current = false;
        const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
        if (elapsed >= 1) recordPlaytime(gameId, elapsed).catch(() => {});
        startTimeRef.current = null;
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    startTimeRef.current = Date.now();
    activeRef.current = true;

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      if (activeRef.current && startTimeRef.current) {
        const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
        if (elapsed >= 1) recordPlaytime(gameId, elapsed).catch(() => {});
      }
    };
  }, [gameId]);

  return (
    <div ref={wrapperRef} className="flex flex-col gap-2">
      {/* 툴바 */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          프레임 {frameW} × {frameH}
          {' · '}
          원본 {nativeW} × {nativeH}
          {' · '}
          배율 {(scale * 100).toFixed(0)}%
        </span>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs transition"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          해상도 설정
        </button>
      </div>

      {/* 해상도 설정 패널 */}
      {showSettings && (
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex flex-col gap-3">
          <p className="text-sm text-gray-200 font-medium">게임 원본 해상도</p>
          <p className="text-xs text-gray-500">
            게임이 빌드된 원본 해상도를 입력하세요. 프레임보다 크면 비율을 유지하며 축소됩니다.
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => { setInputW(String(p.w)); setInputH(String(p.h)); }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                  inputW === String(p.w) && inputH === String(p.h)
                    ? 'border-indigo-500 bg-indigo-900/50 text-indigo-300'
                    : 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={inputW}
              onChange={(e) => setInputW(e.target.value)}
              min={1}
              className="w-24 bg-gray-900 border border-gray-600 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-sm text-white outline-none"
              placeholder="너비"
            />
            <span className="text-gray-500 text-sm">×</span>
            <input
              type="number"
              value={inputH}
              onChange={(e) => setInputH(e.target.value)}
              min={1}
              className="w-24 bg-gray-900 border border-gray-600 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-sm text-white outline-none"
              placeholder="높이"
            />
            <button
              onClick={applyNativeResolution}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition"
            >
              적용
            </button>
          </div>
        </div>
      )}

      {/* 게임 프레임 */}
      <div
        className="relative bg-black rounded-xl border border-gray-700 select-none overflow-hidden"
        style={{ width: frameW, height: frameH }}
      >
        {/* 게임 캔버스: 중앙 정렬 + scale 변환 */}
        <div
          style={{
            position: 'absolute',
            left: offsetX,
            top: offsetY,
            width: scaledW,
            height: scaledH,
            overflow: 'hidden',
          }}
        >
          <iframe
            src={playUrl}
            title="game"
            style={{
              width: nativeW,
              height: nativeH,
              border: 'none',
              display: 'block',
              transformOrigin: 'top left',
              transform: `scale(${scale})`,
            }}
            allow="fullscreen"
            sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms"
          />
        </div>

        {/* 리사이즈 핸들 (우측 하단) */}
        <div
          onMouseDown={handleDragStart}
          title="드래그하여 크기 조절"
          className="absolute bottom-0 right-0 w-8 h-8 flex items-end justify-end p-2 cursor-nwse-resize group z-10"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            className="text-gray-600 group-hover:text-gray-300 transition"
          >
            <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="5" x2="5" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <p className="text-xs text-gray-600 text-right">
        ↘ 우측 하단 모서리를 드래그하여 프레임 크기를 조절할 수 있습니다.
      </p>
    </div>
  );
}
