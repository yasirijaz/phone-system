'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Phone } from 'lucide-react';

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function CallProgressBarPage() {
  const searchParams = useSearchParams();
  const [callerName, setCallerName] = useState(searchParams.get('callerName') || 'On Call');
  const [startedAt, setStartedAt] = useState(
    Number(searchParams.get('startedAt')) || Date.now()
  );
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    document.body.style.overflow = 'hidden';
  }, []);

  useEffect(() => {
    const update = (payload: { callerName?: string; startedAt?: number }) => {
      if (payload.callerName) setCallerName(payload.callerName);
      if (payload.startedAt) setStartedAt(payload.startedAt);
    };

    const off = window.electronAPI?.on('call-progress-update', update);
    return () => {
      off?.();
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      setDuration(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const handleFocusMain = () => {
    window.electronAPI?.send('focus-main-window');
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center p-1">
      <div
        className="flex w-full max-w-[300px] items-center gap-2.5 rounded-full border border-white/15 px-3.5 py-2 shadow-2xl"
        style={{
          WebkitAppRegion: 'drag',
          background: 'rgba(15, 23, 42, 0.78)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
        </span>
        <button
          type="button"
          onClick={handleFocusMain}
          className="shrink-0 rounded-full p-0.5 text-green-400 transition-colors hover:text-green-300"
          style={{ WebkitAppRegion: 'no-drag' }}
          aria-label="Focus main window"
        >
          <Phone className="h-4 w-4" />
        </button>
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">
          {callerName}
        </p>
        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-white">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
