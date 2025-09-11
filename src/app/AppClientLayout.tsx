
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

export default function AppClientLayout({ children }: { children: React.ReactNode }) {
  const {
    connection,
    conferenceSid,
    acceptCall,
    rejectCall,
    hangUp,
    incomingReservation,
    showReservationModal,
    acceptReservation,
    rejectReservation,
    reconnectInfo,
    reconnectCall,
    dismissReconnect
  } = useTwilio();

  // set update status state
  const [updateMessage, setUpdateMessage] = useState<string>("");
  const { user } = useAuth();
   useEffect(() => {
    if(window.api)
      window.api.receive('updatelog', handleUpdates);
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

  const isIncomingCall = connection && (connection.status() === 'pending' || connection.status() === 'ringing');
  // An active call is one that is 'open' or one associated with an accepted reservation that is now in progress.
  const isActiveCall = connection && (connection.status() === 'open' || (incomingReservation && connection.parameters.CallSid === incomingReservation.sid));
  
  const callerName = connection?.parameters?.FriendlyName || "Unknown Caller";
  const callerNumber = connection?.parameters?.From || "";
  
  const activeCallContact = connection?.parameters?.FriendlyName || connection?.parameters?.To || "Unknown";

  return (
    <>
      {children}
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
        contactName={activeCallContact}
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
      {reconnectInfo && <ReconnectPrompt onReconnect={reconnectCall} onDismiss={dismissReconnect} />}
      <UpdateProgress message={updateMessage} />
    </>
  );
}
