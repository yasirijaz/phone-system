'use client';

import { format, parseISO } from 'date-fns';
import { PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import CallStatusBadge from '@/components/call-status-badge';
import {
  formatCallDuration,
  getCallStatusDisplay,
  isMissedCallEntry,
} from '@/lib/call-status-display';
import { cn, formatPhoneNumber } from '@/lib/utils';
import type { CallActivityEntry } from '@/services/callLogService';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type CallHistoryTableProps = {
  calls: CallActivityEntry[];
  subjectPhone?: string;
};

export default function CallHistoryTable({ calls, subjectPhone }: CallHistoryTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="min-w-[140px] font-semibold">Status</TableHead>
            <TableHead className="min-w-[110px] font-semibold">Direction</TableHead>
            <TableHead className="min-w-[150px] font-semibold">From</TableHead>
            <TableHead className="min-w-[150px] font-semibold">To</TableHead>
            <TableHead className="min-w-[140px] font-semibold">Agent</TableHead>
            <TableHead className="min-w-[90px] font-semibold">Duration</TableHead>
            <TableHead className="min-w-[180px] font-semibold text-right">Date & time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((entry) => {
            const status = getCallStatusDisplay(entry);
            const isInbound = entry.direction === 'inbound';
            const isMissed = isMissedCallEntry(entry);
            const when = entry.created_at
              ? format(parseISO(entry.created_at), 'MMM d, yyyy · h:mm a')
              : '—';
            const DirectionIcon = isInbound ? PhoneIncoming : PhoneOutgoing;

            return (
              <TableRow
                key={entry.id}
                className={cn(
                  'hover:bg-muted/40',
                  status.isLive && 'bg-emerald-500/5',
                  isMissed && !status.isLive && 'bg-amber-500/5'
                )}
              >
                <TableCell className="whitespace-nowrap py-3">
                  <CallStatusBadge display={status} />
                </TableCell>
                <TableCell className="whitespace-nowrap py-3">
                  <span className="inline-flex items-center gap-2 text-sm font-medium">
                    <DirectionIcon
                      className={cn(
                        'h-4 w-4',
                        isInbound ? 'text-emerald-600' : 'text-sky-600',
                        isMissed && 'text-amber-600'
                      )}
                    />
                    {isInbound ? 'Inbound' : 'Outbound'}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap py-3 font-medium">
                  {formatPhoneNumber(entry.from)}
                </TableCell>
                <TableCell className="whitespace-nowrap py-3 font-medium">
                  {formatPhoneNumber(entry.to || subjectPhone || '')}
                </TableCell>
                <TableCell className="whitespace-nowrap py-3 text-muted-foreground">
                  {entry.user?.name || '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap py-3 font-medium tabular-nums">
                  {formatCallDuration(entry)}
                </TableCell>
                <TableCell className="whitespace-nowrap py-3 text-right text-sm text-muted-foreground tabular-nums">
                  {when}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
