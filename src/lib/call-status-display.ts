import type { CallActivityEntry } from '@/services/callLogService';

export type CallStatusKind =
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'missed'
  | 'hung_up'
  | 'failed'
  | 'unknown';

export type CallStatusDisplay = {
  kind: CallStatusKind;
  label: string;
  className: string;
  dotClassName: string;
  isLive: boolean;
};

const MISSED_STATUSES = new Set([
  'missed',
  'no-answer',
  'no_answer',
  'busy',
  'canceled',
  'cancelled',
]);

const HUNG_UP_STATUSES = new Set([
  'hangup',
  'hang-up',
  'hung-up',
  'hung_up',
  'hang_up',
  'hungup',
]);

const REJECTED_STATUSES = new Set(['rejected', 'declined']);

const FAILED_STATUSES = new Set(['failed', 'failure']);

function normalizeStatus(status?: string | null): string {
  return String(status || '').trim().toLowerCase();
}

function parseDurationSeconds(entry: CallActivityEntry): number {
  return parseInt(String(entry.call_duration || '0'), 10) || 0;
}

export function isMissedCallEntry(entry: CallActivityEntry): boolean {
  const status = normalizeStatus(entry.call_status);
  if (MISSED_STATUSES.has(status)) return true;

  const durationSec = parseDurationSeconds(entry);
  return (
    entry.direction === 'inbound' &&
    durationSec === 0 &&
    status !== 'in_progress' &&
    status !== 'completed' &&
    !HUNG_UP_STATUSES.has(status) &&
    !REJECTED_STATUSES.has(status)
  );
}

export function getCallStatusDisplay(entry: CallActivityEntry): CallStatusDisplay {
  const status = normalizeStatus(entry.call_status);

  if (status === 'in_progress') {
    return {
      kind: 'in_progress',
      label: 'In progress',
      className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      dotClassName: 'bg-emerald-500 animate-pulse',
      isLive: true,
    };
  }

  if (status === 'completed' || (!status && parseDurationSeconds(entry) > 0)) {
    return {
      kind: 'completed',
      label: 'Completed',
      className: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
      dotClassName: 'bg-sky-500',
      isLive: false,
    };
  }

  if (REJECTED_STATUSES.has(status)) {
    return {
      kind: 'rejected',
      label: 'Rejected',
      className: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
      dotClassName: 'bg-rose-500',
      isLive: false,
    };
  }

  if (HUNG_UP_STATUSES.has(status)) {
    return {
      kind: 'hung_up',
      label: 'Hung up',
      className: 'border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300',
      dotClassName: 'bg-orange-500',
      isLive: false,
    };
  }

  if (FAILED_STATUSES.has(status)) {
    return {
      kind: 'failed',
      label: 'Failed',
      className: 'border-destructive/40 bg-destructive/10 text-destructive',
      dotClassName: 'bg-destructive',
      isLive: false,
    };
  }

  if (isMissedCallEntry(entry)) {
    return {
      kind: 'missed',
      label: 'Missed',
      className: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300',
      dotClassName: 'bg-amber-500',
      isLive: false,
    };
  }

  const label = status
    ? status.replace(/[_-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
    : 'Unknown';

  return {
    kind: 'unknown',
    label,
    className: 'border-muted-foreground/30 bg-muted text-muted-foreground',
    dotClassName: 'bg-muted-foreground',
    isLive: false,
  };
}

export function formatCallDuration(entry: CallActivityEntry): string {
  if (getCallStatusDisplay(entry).isLive) return 'Live';

  const seconds = parseDurationSeconds(entry);
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  if (seconds > 0) return `${seconds}s`;
  return '—';
}

export function summarizeCalls(calls: CallActivityEntry[]) {
  const summary = {
    total: calls.length,
    completed: 0,
    missed: 0,
    inProgress: 0,
    rejected: 0,
  };

  for (const call of calls) {
    const kind = getCallStatusDisplay(call).kind;
    if (kind === 'completed') summary.completed += 1;
    if (kind === 'missed' || kind === 'hung_up' || kind === 'failed') summary.missed += 1;
    if (kind === 'in_progress') summary.inProgress += 1;
    if (kind === 'rejected') summary.rejected += 1;
  }

  return summary;
}
