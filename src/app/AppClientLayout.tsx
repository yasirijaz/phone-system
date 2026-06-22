
'use client';

import { useTwilio } from '@/context/TwilioContext';
import IncomingCallModal from '@/components/incoming-call-modal';
import ActiveCallBar from '@/components/active-call-modal';
import { useAuth } from '@/context/AuthContext';
import ReservationModal from '@/components/reservation-modal';
import { useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import UpdateProgress from '@/components/update-progress';
import { usePathname } from 'next/navigation';
import { isInAppRoute } from '@/lib/in-app-routes';
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
    rejectReservation,
    activeCallMeta,
    syncActiveCallState,
  } = useTwilio();

  const { user } = useAuth();
  const pathname = usePathname();
  const showInAppShell = isInAppRoute(pathname);
  const [updateMessage, setUpdateMessage] = useState<string>('');

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
  const hasPersistedActiveCall = Boolean(
    activeCallMeta?.conferenceSid || activeCallMeta?.callSid
  );
  const isIncomingDeviceCall =
    !!connection && (callStatus === 'pending' || callStatus === 'ringing');
  const isIncomingCall =
    isIncomingDeviceCall && !activeReservation && !incomingReservation && !showReservationModal;
  const isActiveCall = hasLiveConnection || !!activeReservation || hasPersistedActiveCall;

  const callerName =
    activeReservation?.task?.attributes?.contact_name ||
    connection?.parameters?.FriendlyName ||
    activeCallMeta?.callerName ||
    'Unknown Caller';
  const callerNumber =
    activeReservation?.task?.attributes?.from ||
    connection?.parameters?.From ||
    connection?.parameters?.To ||
    activeCallMeta?.callerNumber ||
    '';
  const departmentName =
    activeReservation?.task?.attributes?.department_name ||
    incomingReservation?.task?.attributes?.department_name ||
    activeCallMeta?.departmentName ||
    null;
  const effectiveConferenceSid = conferenceSid || activeCallMeta?.conferenceSid || null;

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
        isOpen={!!isActiveCall}
        contactNumber={callerNumber}
        callerName={callerName}
        departmentName={departmentName}
        onLeaveCall={leaveCall}
        onEndCallForAll={endCallForAll}
        connection={connection}
        conferenceSid={effectiveConferenceSid}
        fallbackAgentCallSid={activeCallMeta?.callSid ?? null}
      />
      <ReservationModal
        isOpen={!!showReservationModal}
        onClose={() => rejectReservation(incomingReservation!)}
        reservation={incomingReservation}
        onAccept={acceptReservation}
        onReject={rejectReservation}
      />
      <UpdateProgress message={updateMessage} />
    </>
  );
}
