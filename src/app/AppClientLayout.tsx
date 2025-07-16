
'use client';

import { useTwilio } from '@/context/TwilioContext';
import IncomingCallModal from '@/components/incoming-call-modal';

export default function AppClientLayout({ children }: { children: React.ReactNode }) {
  const { 
    incomingReservation, 
    acceptReservation, 
    rejectReservation, 
    clearIncomingReservation 
  } = useTwilio();

  const callerName = incomingReservation?.task?.attributes?.from_name || "Unknown Caller";
  const callerNumber = incomingReservation?.task?.attributes?.from || "";

  return (
    <>
      {children}
      <IncomingCallModal
        isOpen={!!incomingReservation}
        onClose={clearIncomingReservation}
        callerName={callerName}
        callerNumber={callerNumber}
        onAccept={acceptReservation}
        onReject={rejectReservation}
      />
    </>
  );
}
