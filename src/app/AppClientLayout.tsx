
'use client';

import { useTwilio } from '@/context/TwilioContext';
import IncomingCallModal from '@/components/incoming-call-modal';
import ActiveCallModal from '@/components/active-call-modal';

export default function AppClientLayout({ children }: { children: React.ReactNode }) {
  const { 
    incomingCall, 
    acceptCall, 
    rejectCall,
    connection,
    hangUp
  } = useTwilio();

  const callerName = incomingCall?.parameters?.FriendlyName || "Unknown Caller";
  const callerNumber = incomingCall?.parameters?.From || "";
  
  const activeCallContact = connection?.parameters?.FriendlyName || connection?.parameters?.To || "Unknown";

  return (
    <>
      {children}
      <IncomingCallModal
        isOpen={!!incomingCall}
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
