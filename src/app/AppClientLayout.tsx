
'use client';

import { useTwilio } from '@/context/TwilioContext';
import IncomingCallModal from '@/components/incoming-call-modal';
import ActiveCallBar from '@/components/active-call-modal';
import { useAuth } from '@/context/AuthContext';
import ReservationModal from '@/components/reservation-modal';
import { useEffect, useState, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import UpdateProgress from '@/components/update-progress';
import { usePathname } from 'next/navigation';
import { isInAppRoute } from '@/lib/in-app-routes';
import { isElectronOverlayRoute } from '@/lib/electron-overlay-routes';
import { isElectron } from '@/lib/is-electron';
import { InAppShell } from '@/components/in-app-shell';
import { isLiveCallStatus } from '@/lib/twilio-call-utils';
import { readActiveCallSession } from '@/lib/active-call-session';

export default function AppClientLayout({ children }: { children: React.ReactNode }) {
  const {
    connection,
    conferenceSid,
    acceptCall,
    rejectCall,
    leaveCall,
    endCallForAll,
    incomingReservation,
    activeReservation,
    showReservationModal,
    acceptReservation,
    acceptReservationAndEndCurrent,
    acceptReservationWithHold,
    acceptReservationAndMerge,
    rejectReservation,
    activeCallMeta,
    syncActiveCallState,
    isOnLiveCall,
  } = useTwilio();

  const { user } = useAuth();
  const pathname = usePathname();
  const isOverlayRoute = isElectronOverlayRoute(pathname);
  const showInAppShell = isInAppRoute(pathname);
  const [updateMessage, setUpdateMessage] = useState<string>('');
  const callStartedAtRef = useRef<number | null>(null);
  const prevIsActiveCallRef = useRef(false);

  useEffect(() => {
    void syncActiveCallState();
  }, [pathname, syncActiveCallState]);
   useEffect(() => {
    if(window.api)
      window.api.receive('updatelog', handleUpdates);
  }, []);

  useEffect(() => {
    const handleChunkError = (event: ErrorEvent) => {
      const message = event.message || '';
      if (message.includes('ChunkLoadError') || message.includes('Loading chunk')) {
        if (readActiveCallSession()) {
          console.warn('Skipping chunk reload while a call is in progress.');
          return;
        }
        const reloadKey = 'chunk-reload';
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, '1');
          window.location.reload();
        }
      }
    };

    window.addEventListener('error', handleChunkError);
    return () => window.removeEventListener('error', handleChunkError);
  }, []);

  const handleUpdates = (data:any) => {
    console.log('Received updates from Main:', data);
    setUpdateMessage(String(data));
  };


  const recieveFromMain = async (data:any) => {
    console.log('Received data from Main:', data)
    toast({
      title: "Notification from Main",
      description: JSON.stringify(data),
    });
  }

  const callStatus = connection?.status?.();
  const hasLiveConnection = !!connection && isLiveCallStatus(callStatus);
  const isIncomingDeviceCall =
    !!connection && (callStatus === 'pending' || callStatus === 'ringing');
  const isIncomingCall =
    isIncomingDeviceCall && !activeReservation && !incomingReservation && !showReservationModal;
  const isActiveCall =
    hasLiveConnection ||
    !!activeReservation ||
    isOnLiveCall;

  const isAgentOnCall =
    isActiveCall && !isIncomingDeviceCall;

  // When a call ends, check whether a deferred logout was queued while the user was on the call
  // (set by the axios 401 interceptor to avoid hard-redirecting mid-call).
  useEffect(() => {
    const wasOnCall = prevIsActiveCallRef.current;
    prevIsActiveCallRef.current = isActiveCall;

    if (wasOnCall && !isActiveCall) {
      if (typeof window !== 'undefined' && sessionStorage.getItem('pending_auth_logout')) {
        sessionStorage.removeItem('pending_auth_logout');
        window.location.href = '/login';
      }
    }
  }, [isActiveCall]);

  const liveCallSid = connection?.parameters?.CallSid ?? null;
  const storedMetaApplies = Boolean(
    activeCallMeta &&
      (!liveCallSid || !activeCallMeta.callSid || activeCallMeta.callSid === liveCallSid) &&
      (!activeReservation ||
        !activeCallMeta.callerNumber ||
        activeCallMeta.callerNumber === activeReservation.task?.attributes?.from)
  );

  const callerName =
    activeReservation?.task?.attributes?.contact_name ||
    connection?.parameters?.FriendlyName ||
    (storedMetaApplies ? activeCallMeta?.callerName : null) ||
    'Unknown Caller';
  const callerNumber =
    activeReservation?.task?.attributes?.from ||
    connection?.parameters?.From ||
    connection?.parameters?.To ||
    (storedMetaApplies ? activeCallMeta?.callerNumber : null) ||
    '';
  const departmentName =
    activeReservation?.task?.attributes?.department_name ||
    incomingReservation?.task?.attributes?.department_name ||
    (storedMetaApplies ? activeCallMeta?.departmentName : null) ||
    null;
  const effectiveConferenceSid =
    conferenceSid ||
    (storedMetaApplies ? activeCallMeta?.conferenceSid : null) ||
    null;
  const activeCallKey =
    effectiveConferenceSid ||
    connection?.parameters?.CallSid ||
    activeCallMeta?.callSid ||
    activeReservation?.task?.sid ||
    incomingReservation?.task?.sid ||
    'idle';

  useEffect(() => {
    if (!isElectron() || !window.electronAPI || isOverlayRoute) return;

    if (isActiveCall) {
      if (!callStartedAtRef.current) {
        callStartedAtRef.current = Date.now();
      }
      window.electronAPI.send('show-call-progress', {
        callerName,
        callerNumber,
        startedAt: callStartedAtRef.current,
      });
      return;
    }

    callStartedAtRef.current = null;
    window.electronAPI.send('hide-call-progress');
  }, [isActiveCall, callerName, callerNumber, isOverlayRoute]);

  if (isOverlayRoute) {
    return <>{children}</>;
  }

  return (
    <>
      {showInAppShell ? <InAppShell>{children}</InAppShell> : children}
      <IncomingCallModal
        isOpen={!!isIncomingCall}
        onClose={rejectCall}
        callerName={callerName}
        callerNumber={callerNumber}
        departmentName={departmentName}
        onAccept={acceptCall}
        onReject={rejectCall}
      />
       <ActiveCallBar
        key={activeCallKey}
        isOpen={!!isActiveCall && !showReservationModal}
        contactNumber={callerNumber}
        callerName={callerName}
        departmentName={departmentName}
        onLeaveCall={leaveCall}
        onEndCallForAll={endCallForAll}
        connection={connection}
        conferenceSid={effectiveConferenceSid}
        fallbackAgentCallSid={
          storedMetaApplies ? activeCallMeta?.callSid ?? null : liveCallSid
        }
      />
      <ReservationModal
        isOpen={!!showReservationModal}
        onClose={() => rejectReservation(incomingReservation!)}
        reservation={incomingReservation}
        activeCall={
          isAgentOnCall && showReservationModal
            ? {
                callerName,
                callerNumber,
                departmentName,
                startedAt: callStartedAtRef.current ?? activeCallMeta?.startedAt ?? Date.now(),
              }
            : null
        }
        onAccept={acceptReservation}
        onAcceptEndCurrent={acceptReservationAndEndCurrent}
        onAcceptHold={acceptReservationWithHold}
        onAcceptMerge={acceptReservationAndMerge}
        onReject={rejectReservation}
      />
      <UpdateProgress message={updateMessage} />
    </>
  );
}
