
'use client';

import { useTwilio } from '@/context/TwilioContext';
import IncomingCallModal from '@/components/incoming-call-modal';
import ActiveCallModal from '@/components/active-call-modal';

export default function AppClientLayout({ children }: { children: React.ReactNode }) {
  const { 
    incomingReservation,
    acceptCall, 
    rejectCall,
    connection,
    hangUp
  } = useTwilio();

  const callerName = incomingReservation?.task.attributes.from_name || "Unknown Caller";
  const callerNumber = incomingReservation?.task.attributes.from || "";
  
  const activeCallContact = connection?.parameters?.FriendlyName || connection?.parameters?.To || "Unknown";

  return (
    <>
      {children}
      <IncomingCallModal
        isOpen={!!incomingReservation}
        onClose={rejectCall}
        callerName={callerName}
        callerNumber={callerNumber}
        onAccept={acceptCall}
        onReject={rejectCall}
      />
       <ActiveCallModal
        isOpen={!!connection}
        contactName={activeCallContact}
        onHangUp={hangUp}
      />
    </>
  );
}
