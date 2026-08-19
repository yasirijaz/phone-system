'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import CallWaitingPanel, { type CallWaitingSummary } from '@/components/call-waiting-panel';

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function IncomingCallNotificationContent() {
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(searchParams.get('from') || '');
  const [callerName, setCallerName] = useState(searchParams.get('callerName') || 'Incoming Call');
  const [activeCall, setActiveCall] = useState<CallWaitingSummary | null>(() => {
    const activeCallerName = searchParams.get('activeCallerName');
    if (!activeCallerName) return null;
    return {
      callerName: activeCallerName,
      callerNumber: searchParams.get('activeCallerNumber') || '',
      durationLabel: '00:00',
    };
  });
  const [activeStartedAt, setActiveStartedAt] = useState(
    Number(searchParams.get('activeStartedAt')) || Date.now()
  );
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    document.body.style.overflow = 'hidden';
  }, []);

  useEffect(() => {
    const update = (payload: {
      from?: string;
      callerName?: string;
      activeCall?: { callerName?: string; callerNumber?: string; startedAt?: number } | null;
    }) => {
      if (payload.from) setFrom(payload.from);
      if (payload.callerName) setCallerName(payload.callerName);
      if (payload.activeCall) {
        setActiveCall({
          callerName: payload.activeCall.callerName || 'On Call',
          callerNumber: payload.activeCall.callerNumber || '',
          durationLabel: '00:00',
        });
        if (payload.activeCall.startedAt) {
          setActiveStartedAt(payload.activeCall.startedAt);
        }
      } else if (payload.activeCall === null) {
        setActiveCall(null);
      }
    };

    const off = window.electronAPI?.on('incoming-call-update', update);
    return () => {
      off?.();
    };
  }, []);

  useEffect(() => {
    if (!activeCall) return;
    const tick = () => {
      const duration = Math.max(0, Math.floor((Date.now() - activeStartedAt) / 1000));
      setActiveCall((current) =>
        current ? { ...current, durationLabel: formatTime(duration) } : current
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [activeCall, activeStartedAt]);

  const sendAction = (channel: string) => {
    if (isBusy) return;
    setIsBusy(true);
    window.electronAPI?.send(channel);
  };

  const handleReject = () => sendAction('reject-call');
  const handleIgnore = () => {
    window.electronAPI?.send('ignore-incoming-overlay');
  };
  const handleAcceptHold = () =>
    sendAction(activeCall ? 'accept-call-hold' : 'accept-call');
  const handleAcceptEndCurrent = () => sendAction('accept-call-end-current');
  const handleAcceptMerge = () => sendAction('accept-call-merge');

  return (
    <div className="flex h-screen w-screen items-start justify-end p-2">
      <div className="w-full max-w-[420px]">
        <CallWaitingPanel
          activeCall={activeCall}
          incomingCall={{
            callerName: callerName || from || 'Incoming Call',
            callerNumber: from,
          }}
          onReject={handleReject}
          onAcceptEndCurrent={handleAcceptEndCurrent}
          onAcceptHold={handleAcceptHold}
          onAcceptMerge={handleAcceptMerge}
          onMinimize={handleIgnore}
          compact
          overlayChrome
          isBusy={isBusy}
        />
      </div>
    </div>
  );
}
