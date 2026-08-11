'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';
import { Pause, Phone, PhoneOff, Play } from 'lucide-react';

type ElectronWindowStyle = CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag';
};

const dragRegionStyle: ElectronWindowStyle = { WebkitAppRegion: 'drag' };
const noDragRegionStyle: ElectronWindowStyle = { WebkitAppRegion: 'no-drag' };

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function CallProgressBarContent() {
  const searchParams = useSearchParams();
  const [callerName, setCallerName] = useState(searchParams.get('callerName') || 'On Call');
  const [startedAt, setStartedAt] = useState(
    Number(searchParams.get('startedAt')) || Date.now()
  );
  const [duration, setDuration] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isHoldLoading, setIsHoldLoading] = useState(false);

  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    document.body.style.overflow = 'hidden';
  }, []);

  useEffect(() => {
    const update = (payload: { callerName?: string; startedAt?: number; isOnHold?: boolean }) => {
      if (payload.callerName) setCallerName(payload.callerName);
      if (payload.startedAt) setStartedAt(payload.startedAt);
      if (typeof payload.isOnHold === 'boolean') setIsOnHold(payload.isOnHold);
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

  const handleOpenMainControls = () => {
    window.electronAPI?.send('focus-main-window');
    window.electronAPI?.send('restore-active-call-ui');
  };

  const handleEndCall = () => {
    if (isEnding) return;
    setIsEnding(true);
    window.electronAPI?.send('end-call-from-progress');
  };

  const handleToggleHold = () => {
    if (isHoldLoading || isEnding) return;
    setIsHoldLoading(true);
    window.electronAPI?.send('hold-call-from-progress');
    window.setTimeout(() => setIsHoldLoading(false), 1200);
  };

  return (
    <div className="flex h-screen w-screen items-start justify-end p-3">
      <div
        className="flex w-full max-w-[440px] items-center gap-3 rounded-full px-4 py-3 shadow-[0_12px_40px_rgba(5,150,105,0.55)]"
        style={{
          ...dragRegionStyle,
          background: '#059669',
          boxShadow: '0 12px 40px rgba(5, 150, 105, 0.55), 0 0 0 2px rgba(167, 243, 208, 0.85)',
        }}
      >
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
        </span>
        <button
          type="button"
          onClick={handleOpenMainControls}
          className="shrink-0 rounded-full p-0.5 text-white transition-colors hover:bg-white/15"
          style={noDragRegionStyle}
          aria-label="Open call controls"
        >
          <Phone className="h-5 w-5" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          onClick={handleOpenMainControls}
          className="min-w-0 flex-1 truncate text-left text-sm font-semibold tracking-wide text-white"
          style={noDragRegionStyle}
          title="Open in-app call bar"
        >
          {callerName || 'On call'}
        </button>
        <span className="shrink-0 font-mono text-base font-bold tabular-nums tracking-wider text-white">
          {formatTime(duration)}
        </span>
        <button
          type="button"
          onClick={handleToggleHold}
          disabled={isHoldLoading || isEnding}
          className="shrink-0 rounded-full p-1.5 text-white transition-colors hover:bg-white/15 disabled:opacity-50"
          style={noDragRegionStyle}
          aria-label={isOnHold ? 'Resume call' : 'Hold call'}
          title={isOnHold ? 'Resume' : 'Hold'}
        >
          {isOnHold ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={handleEndCall}
          disabled={isEnding}
          className="shrink-0 rounded-full bg-red-500 p-1.5 text-white transition-colors hover:bg-red-400 disabled:opacity-50"
          style={noDragRegionStyle}
          aria-label="End call"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
