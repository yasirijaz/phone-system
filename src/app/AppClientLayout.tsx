
'use client';

import { useTwilio } from '@/context/TwilioContext';
import IncomingCallModal from '@/components/incoming-call-modal';

export default function AppClientLayout({ children }: { children: React.ReactNode }) {
  const { 
    incomingCall, 
    acceptCall, 
    rejectCall,
  } = useTwilio();

  const callerName = incomingCall?.parameters?.FriendlyName || "Unknown Caller";
  const callerNumber = incomingCall?.parameters?.From || "";

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
    </>
  );
}
