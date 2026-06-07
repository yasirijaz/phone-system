
'use client';

import { useTwilio } from '@/context/TwilioContext';
import IncomingCallModal from '@/components/incoming-call-modal';
import ActiveCallBar from '@/components/active-call-modal';
import { useAuth } from '@/context/AuthContext';
import ReservationModal from '@/components/reservation-modal';
import { useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import UpdateProgress from '@/components/update-progress';
import ReconnectPrompt from '@/components/reconnect-prompt';
import { usePathname } from 'next/navigation';
import { isInAppRoute } from '@/lib/in-app-routes';
import { InAppShell } from '@/components/in-app-shell';

export default function AppClientLayout({ children }: { children: React.ReactNode }) {
  const {
    connection,
    conferenceSid,
    acceptCall,
    rejectCall,
    hangUp,
    incomingReservation,
    activeReservation,
    showReservationModal,
    acceptReservation,
    rejectReservation,
  } = useTwilio();

  // set update status state
  const [updateMessage, setUpdateMessage] = useState<string>("");
  const { user } = useAuth();
  const pathname = usePathname();
  const showInAppShell = isInAppRoute(pathname);
   useEffect(() => {
    if(window.api)
      window.api.receive('updatelog', handleUpdates);
  }, []);

  useEffect(() => {
    const handleChunkError = (event: ErrorEvent) => {
      const message = event.message || '';
      if (message.includes('ChunkLoadError') || message.includes('Loading chunk')) {
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

  const callStatus = connection?.status ? connection.status() : undefined;
  const isIncomingCall = !!connection && (callStatus === 'pending' || callStatus === 'ringing');
  // Consider active when we have a connection and it's not in a ringing/pending/closed state.
  const isActiveCall = !!connection && !['pending', 'ringing', 'closed'].includes(String(callStatus || ''));
  
  // For reservation-based calls, get customer info from reservation
  // For regular calls, get customer info from connection parameters
  const callerName = activeReservation?.task?.attributes?.contact_name || connection?.parameters?.FriendlyName || "Unknown Caller";
  const callerNumber = activeReservation?.task?.attributes?.from || connection?.parameters?.From || "";
  
  // Use customer number (From) for active call display
  const activeCallContact = activeReservation?.task?.attributes?.from || connection?.parameters?.From || connection?.parameters?.To || "Unknown";

  return (
    <>
      {showInAppShell ? <InAppShell>{children}</InAppShell> : children}
      <IncomingCallModal
        isOpen={!!isIncomingCall}
        onClose={rejectCall}
        callerName={callerName}
        callerNumber={callerNumber}
        onAccept={acceptCall}
        onReject={rejectCall}
      />
       <ActiveCallBar
        isOpen={!!isActiveCall}
        contactNumber={callerNumber}
        callerName={callerName}
        onHangUp={hangUp}
        connection={connection}
        conferenceSid={conferenceSid}
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
