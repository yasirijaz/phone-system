'use client';

import { Button } from '@/components/ui/button';
import { formatPhoneNumber } from '@/lib/utils';
import { GitMerge, Pause, Phone, PhoneOff } from 'lucide-react';
import type { CSSProperties } from 'react';

export type CallWaitingSummary = {
  callerName: string;
  callerNumber: string;
  departmentName?: string | null;
  durationLabel?: string;
};

type ElectronWindowStyle = CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag';
};

const dragRegionStyle: ElectronWindowStyle = { WebkitAppRegion: 'drag' };
const noDragRegionStyle: ElectronWindowStyle = { WebkitAppRegion: 'no-drag' };

const overlayPanelStyle = {
  background: 'rgba(15, 23, 42, 0.78)',
  backdropFilter: 'blur(10px)',
};

type CallWaitingPanelProps = {
  activeCall?: CallWaitingSummary | null;
  incomingCall: CallWaitingSummary;
  onReject: () => void;
  onAcceptEndCurrent: () => void;
  onAcceptHold: () => void;
  onAcceptMerge: () => void;
  compact?: boolean;
  overlayChrome?: boolean;
  isBusy?: boolean;
};

function formatCallerNumber(callerNumber: string) {
  if (callerNumber?.toLowerCase().startsWith('client:')) {
    return callerNumber.length > 20 ? `${callerNumber.substring(0, 20)}...` : callerNumber;
  }
  return formatPhoneNumber(callerNumber);
}

function ActiveCallStrip({
  activeCall,
  compact,
  overlayChrome,
}: {
  activeCall: CallWaitingSummary;
  compact?: boolean;
  overlayChrome?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? 'flex items-center gap-2 rounded-full border border-white/15 px-3 py-2'
          : 'flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3'
      }
      style={
        compact
          ? {
              ...(overlayChrome ? overlayPanelStyle : { background: 'rgba(15, 23, 42, 0.78)', backdropFilter: 'blur(10px)' }),
              ...(overlayChrome ? dragRegionStyle : {}),
            }
          : undefined
      }
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
      </span>
      <Phone className={`shrink-0 text-green-500 ${compact ? 'h-4 w-4' : 'h-5 w-5'}`} />
      <div className="min-w-0 flex-1">
        <p className={`truncate font-medium ${compact ? 'text-sm text-white' : 'text-base'}`}>
          {activeCall.callerName}
        </p>
        {!compact ? (
          <p className="truncate text-sm text-muted-foreground">
            {formatCallerNumber(activeCall.callerNumber)}
          </p>
        ) : null}
      </div>
      {activeCall.durationLabel ? (
        <span
          className={`shrink-0 font-mono tabular-nums ${
            compact ? 'text-sm font-semibold text-white' : 'text-sm text-muted-foreground'
          }`}
        >
          {activeCall.durationLabel}
        </span>
      ) : null}
    </div>
  );
}

export default function CallWaitingPanel({
  activeCall,
  incomingCall,
  onReject,
  onAcceptEndCurrent,
  onAcceptHold,
  onAcceptMerge,
  compact = false,
  overlayChrome = false,
  isBusy = false,
}: CallWaitingPanelProps) {
  const onCall = Boolean(activeCall);

  return (
    <div className={compact ? 'flex w-full flex-col gap-2' : 'flex flex-col gap-3'}>
      {activeCall ? (
        <ActiveCallStrip activeCall={activeCall} compact={compact} overlayChrome={overlayChrome} />
      ) : null}

      <div
        className={
          compact
            ? 'rounded-2xl border border-white/15 p-3 shadow-2xl'
            : 'relative overflow-hidden rounded-2xl bg-background shadow-2xl ring-2 ring-green-500/60'
        }
        style={
          compact
            ? overlayChrome
              ? overlayPanelStyle
              : { background: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(10px)' }
            : undefined
        }
      >
        {!compact ? (
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-green-400 via-green-500 to-green-400 animate-pulse" />
        ) : null}

        <div className={compact ? 'flex flex-col gap-3' : 'flex flex-col gap-4 p-4'}>
          <div className="min-w-0" style={overlayChrome ? dragRegionStyle : undefined}>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
              </span>
              <p
                className={`text-sm font-semibold uppercase tracking-wide ${
                  compact ? 'text-green-400' : 'text-green-600'
                }`}
              >
                Incoming call
              </p>
            </div>
            <p className={`truncate font-bold ${compact ? 'text-base text-white' : 'text-lg'}`}>
              {incomingCall.callerName}
            </p>
            <p className={`truncate text-sm ${compact ? 'text-white/70' : 'text-muted-foreground'}`}>
              {formatCallerNumber(incomingCall.callerNumber)}
            </p>
            {incomingCall.departmentName ? (
              <p className={`truncate text-sm ${compact ? 'text-white/70' : 'text-muted-foreground'}`}>
                Department: {incomingCall.departmentName}
              </p>
            ) : null}
          </div>

          <div
            className={`flex flex-wrap gap-2 ${onCall ? '' : 'justify-end'}`}
            style={overlayChrome ? noDragRegionStyle : undefined}
          >
            <Button
              variant="destructive"
              size={compact ? 'sm' : 'lg'}
              className={compact ? 'rounded-full' : 'h-12 rounded-full px-6'}
              onClick={onReject}
              disabled={isBusy}
            >
              <PhoneOff className="mr-2 h-4 w-4" />
              Decline
            </Button>

            {onCall ? (
              <>
                <Button
                  variant="secondary"
                  size={compact ? 'sm' : 'lg'}
                  className={compact ? 'rounded-full' : 'h-12 rounded-full px-5'}
                  onClick={onAcceptEndCurrent}
                  disabled={isBusy}
                >
                  End &amp; Accept
                </Button>
                <Button
                  variant="secondary"
                  size={compact ? 'sm' : 'lg'}
                  className={compact ? 'rounded-full' : 'h-12 rounded-full px-5'}
                  onClick={onAcceptHold}
                  disabled={isBusy}
                >
                  <Pause className="mr-2 h-4 w-4" />
                  Hold &amp; Accept
                </Button>
                <Button
                  size={compact ? 'sm' : 'lg'}
                  className={
                    compact
                      ? 'rounded-full bg-green-600 hover:bg-green-700'
                      : 'h-12 rounded-full bg-green-600 px-5 hover:bg-green-700'
                  }
                  onClick={onAcceptMerge}
                  disabled={isBusy}
                >
                  <GitMerge className="mr-2 h-4 w-4" />
                  Merge &amp; Accept
                </Button>
              </>
            ) : (
              <Button
                size={compact ? 'sm' : 'lg'}
                className={
                  compact
                    ? 'rounded-full bg-green-600 hover:bg-green-700'
                    : 'h-12 rounded-full bg-green-600 px-6 hover:bg-green-700'
                }
                onClick={onAcceptHold}
                disabled={isBusy}
              >
                <Phone className="mr-2 h-4 w-4" />
                Accept
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
