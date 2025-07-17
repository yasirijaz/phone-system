
'use client';

import { useTwilio } from '@/context/TwilioContext';
import IncomingCallModal from '@/components/incoming-call-modal';
import ActiveCallModal from '@/components/active-call-modal';

export default function AppClientLayout({ children }: { children: React.ReactNode }) {
  const { 
    connection,
    acceptCall, 
    rejectCall,
    hangUp
  } = useTwilio();

  const isIncomingCall = connection && (connection.status() === 'pending' || connection.status() === 'ringing');
  const isActiveCall = connection && connection.status() === 'open';

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
       <ActiveCallModal
        isOpen={!!isActiveCall}
        contactName={activeCallContact}
        onHangUp={hangUp}
      />
    </>
  );
}
