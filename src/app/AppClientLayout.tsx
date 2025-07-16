
'use client';

import { useTwilio } from '@/context/TwilioContext';
import IncomingCallModal from '@/components/incoming-call-modal';

export default function AppClientLayout({ children }: { children: React.ReactNode }) {
  const { 
    incomingReservation, 
    acceptReservation, 
    rejectReservation, 
  } = useTwilio();

  const taskAttributes = incomingReservation?.task.attributes;
  const callerName = taskAttributes?.from_name || "Unknown Caller";
  const callerNumber = taskAttributes?.from || "";

  return (
    <>
      {children}
      <IncomingCallModal
        isOpen={!!incomingReservation}
        onClose={rejectReservation}
        callerName={callerName}
        callerNumber={callerNumber}
        onAccept={acceptReservation}
        onReject={rejectReservation}
      />
    </>
  );
}
