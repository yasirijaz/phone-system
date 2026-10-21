'use client';

import { Reservation } from 'twilio-taskrouter';
import { useEffect, useState } from 'react';
import CallWaitingPanel, { type CallWaitingSummary } from '@/components/call-waiting-panel';
import { IncomingCallMinimizedPill } from '@/components/incoming-call-modal';
import { useAuth } from '@/context/AuthContext';
import { useResolvedContactName } from '@/hooks/use-resolved-contact-name';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: Reservation | null;
  activeCall?: (CallWaitingSummary & { startedAt?: number }) | null;
  onAccept: (reservation: Reservation) => void;
  onAcceptEndCurrent: (reservation: Reservation) => void;
  onAcceptHold: (reservation: Reservation) => void;
  onAcceptMerge: (reservation: Reservation) => void;
  onReject: (reservation: Reservation) => void;
  isMinimized?: boolean;
  onMinimize?: () => void;
  onExpand?: () => void;
}

export default function ReservationModal({
  isOpen,
  reservation,
  activeCall,
  onAccept,
  onAcceptEndCurrent,
  onAcceptHold,
  onAcceptMerge,
  onReject,
  isMinimized = false,
  onMinimize,
  onExpand,
}: ReservationModalProps) {
  const { user } = useAuth();
  const [activeCallDisplay, setActiveCallDisplay] = useState<CallWaitingSummary | null>(activeCall ?? null);
  const callerNumber = reservation?.task?.attributes?.from || '';
  const savedContactName = useResolvedContactName(
    user?.company_id,
    callerNumber,
    reservation?.task?.attributes?.contact_name
  );

  useEffect(() => {
    if (!activeCall) {
      setActiveCallDisplay(null);
      return;
    }

    const startedAt = activeCall.startedAt ?? Date.now();
    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
      const secs = (seconds % 60).toString().padStart(2, '0');
      return `${mins}:${secs}`;
    };

    const tick = () => {
      const durationLabel = formatTime(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
      setActiveCallDisplay({
        callerName: activeCall.callerName,
        callerNumber: activeCall.callerNumber,
        departmentName: activeCall.departmentName,
        durationLabel,
      });
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [activeCall]);

  if (!isOpen || !reservation) return null;

  const callerName = savedContactName || reservation.task.attributes.contact_name || 'Unknown Caller';
  const departmentName = reservation.task.attributes.department_name || '';
  const aiHandoff = reservation.task.attributes.ai_handoff as
    | { customer_name?: string; vehicle?: string; glass?: string; reason?: string; summary?: string; appointment_id?: string }
    | undefined;
  const onCall = Boolean(activeCallDisplay);

  if (isMinimized) {
    return (
      <IncomingCallMinimizedPill
        callerName={callerName}
        onExpand={() => onExpand?.()}
      />
    );
  }

  return (
    <div
      className="fixed bottom-4 left-1/2 z-[120] w-[95%] max-w-5xl -translate-x-1/2 animate-in slide-in-from-bottom-4 duration-300"
      role="region"
      aria-label="Incoming reservation"
      aria-live="assertive"
    >
      {aiHandoff && (
        <div className="mb-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900 shadow-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-600">Transferred by AI agent</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {aiHandoff.customer_name && <span><strong>Caller:</strong> {aiHandoff.customer_name}</span>}
            {aiHandoff.vehicle && <span><strong>Vehicle:</strong> {aiHandoff.vehicle}</span>}
            {aiHandoff.glass && <span><strong>Glass:</strong> {aiHandoff.glass}</span>}
            {aiHandoff.reason && <span><strong>Reason:</strong> {aiHandoff.reason}</span>}
          </div>
          {aiHandoff.summary && <p className="mt-1 text-violet-800">{aiHandoff.summary}</p>}
        </div>
      )}
      <CallWaitingPanel
        activeCall={activeCallDisplay}
        incomingCall={{ callerName, callerNumber, departmentName }}
        onReject={() => onReject(reservation)}
        onAcceptEndCurrent={() => onAcceptEndCurrent(reservation)}
        onAcceptHold={() => (onCall ? onAcceptHold(reservation) : onAccept(reservation))}
        onAcceptMerge={() => onAcceptMerge(reservation)}
        onMinimize={onMinimize}
      />
    </div>
  );
}
