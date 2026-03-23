import { useEffect, useRef } from 'react';
import { recordPlaytime } from '../api';

interface GameFrameProps {
  gameId: number;
  playUrl: string;
}

export default function GameFrame({ gameId, playUrl }: GameFrameProps) {
  const startTimeRef = useRef<number | null>(null);
  const activeRef = useRef(false);

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
    <div className="w-full bg-black rounded-xl overflow-hidden border border-gray-700">
      <iframe
        src={playUrl}
        title="game"
        className="w-full"
        style={{ height: '600px', border: 'none' }}
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms"
      />
    </div>
  );
}
