
'use client';

import { useTwilio } from '@/context/TwilioContext';
import IncomingCallModal from '@/components/incoming-call-modal';
import ActiveCallModal from '@/components/active-call-modal';
import { Button } from '@/components/ui/button';
import { Phone, UserCheck, Zap } from 'lucide-react';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useAuth } from '@/context/AuthContext';
import ReservationModal from '@/components/reservation-modal';

function TwilioStatus() {
  const { isDeviceReady, isWorkerReady, connectTwilio, isConnecting } = useTwilio();

  if (isDeviceReady && isWorkerReady) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <TooltipProvider>
        <div className="flex items-center gap-3 bg-background p-3 rounded-full shadow-lg border">
          <Tooltip>
            <TooltipTrigger className="cursor-default">
              <div className="flex items-center gap-2">
                <Phone className={`h-5 w-5 ${isDeviceReady ? 'text-green-500' : 'text-destructive'}`} />
                <span className="text-sm font-medium sr-only">Device: {isDeviceReady ? 'Ready' : 'Not Ready'}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" align="center">
              <p>Device: {isDeviceReady ? 'Ready' : 'Not Ready'}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger className="cursor-default">
               <div className="flex items-center gap-2">
                <UserCheck className={`h-5 w-5 ${isWorkerReady ? 'text-green-500' : 'text-destructive'}`} />
                <span className="text-sm font-medium sr-only">Worker: {isWorkerReady ? 'Ready' : 'Not Ready'}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" align="center">
              <p>Worker: {isWorkerReady ? 'Ready' : 'Not Ready'}</p>
            </TooltipContent>
          </Tooltip>
          <Button onClick={connectTwilio} disabled={isConnecting} size="sm">
            <Zap className="mr-2 h-4 w-4" />
            {isConnecting ? 'Connecting...' : 'Connect to Twilio'}
          </Button>
        </div>
      </TooltipProvider>
    </div>
  );
}

export default function AppClientLayout({ children }: { children: React.ReactNode }) {
  const {
    connection,
    acceptCall,
    rejectCall,
    hangUp,
    incomingReservation,
    showReservationModal,
    acceptReservation,
    rejectReservation,
  } = useTwilio();

  const { user } = useAuth();

  const isIncomingCall = connection && (connection.status() === 'pending' || connection.status() === 'ringing');
  const isActiveCall = connection && connection.status() === 'open';

  const callerName = connection?.parameters?.FriendlyName || "Unknown Caller";
  const callerNumber = connection?.parameters?.From || "";
  
  const activeCallContact = connection?.parameters?.FriendlyName || connection?.parameters?.To || "Unknown";

  return (
    <>
      {children}
      {user && <TwilioStatus />}
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
      <ReservationModal
        isOpen={!!showReservationModal}
        onClose={() => rejectReservation(incomingReservation!)}
        reservation={incomingReservation}
        onAccept={acceptReservation}
        onReject={rejectReservation}
      />
    </>
  );
}
