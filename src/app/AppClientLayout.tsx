
'use client';

import { useTwilio } from '@/context/TwilioContext';
import IncomingCallModal from '@/components/incoming-call-modal';
import { clear } from 'console';

export default function AppClientLayout({ children }: { children: React.ReactNode }) {
  const { 
    incomingReservation, 
    incomingCall,
    acceptReservation, 
    rejectReservation, 
    clearIncomingCall 
  } = useTwilio();

  const callerName = incomingCall?.from_name || "Unknown Caller";
  const callerNumber = incomingCall?.from || incomingCall?.From || "";

  return (
    <>
      {children}
      <IncomingCallModal
        isOpen={!!incomingCall}
        onClose={clearIncomingCall}
        callerName={callerName}
        callerNumber={callerNumber}
        onAccept={acceptReservation}
        onReject={rejectReservation}
      />
    </>
  );
}
