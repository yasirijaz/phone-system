
'use client';

import { Button } from '@/components/ui/button';
import { Phone, PhoneOff } from 'lucide-react';
import { formatPhoneNumber } from '@/lib/utils';
import { Avatar, AvatarFallback } from './ui/avatar';

interface IncomingCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callerName: string;
  callerNumber: string;
  departmentName?: string | null;
  onAccept: () => void;
  onReject: () => void;
}

function formatCallerNumber(callerNumber: string) {
  if (callerNumber?.toLowerCase().startsWith('client:')) {
    return callerNumber.length > 20 ? `${callerNumber.substring(0, 20)}...` : callerNumber;
  }
  return formatPhoneNumber(callerNumber);
}

export default function IncomingCallModal({
  isOpen,
  callerName,
  callerNumber,
  departmentName,
  onAccept,
  onReject,
}: IncomingCallModalProps) {
  if (!isOpen) {
    return null;
  }

  const contactInitial = callerName ? callerName.charAt(0).toUpperCase() : '?';

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] max-w-5xl z-50 animate-in slide-in-from-bottom-4 duration-300"
      role="region"
      aria-label="Incoming call"
      aria-live="assertive"
    >
      <div className="relative overflow-hidden rounded-2xl bg-background shadow-2xl ring-2 ring-green-500/60">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-green-400 via-green-500 to-green-400 animate-pulse" />

        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              <span className="absolute -inset-1 rounded-full bg-green-500/20 animate-ping" />
              <Avatar className="relative h-14 w-14 ring-2 ring-green-500">
                <AvatarFallback className="bg-green-600 text-white text-lg font-semibold">
                  {contactInitial}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                </span>
                <p className="text-sm font-semibold uppercase tracking-wide text-green-600">
                  Incoming call
                </p>
              </div>
              <p className="truncate text-lg font-bold">{callerName}</p>
              <p className="truncate text-sm text-muted-foreground">
                {formatCallerNumber(callerNumber)}
              </p>
              {departmentName ? (
                <p className="truncate text-sm text-muted-foreground">
                  Department: {departmentName}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="destructive"
              size="lg"
              className="h-12 flex-1 rounded-full px-6 sm:flex-none sm:min-w-[130px]"
              onClick={onReject}
            >
              <PhoneOff className="mr-2 h-5 w-5" />
              Decline
            </Button>
            <Button
              size="lg"
              className="h-12 flex-1 rounded-full bg-green-600 px-6 hover:bg-green-700 sm:flex-none sm:min-w-[130px]"
              onClick={onAccept}
            >
              <Phone className="mr-2 h-5 w-5" />
              Accept
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
