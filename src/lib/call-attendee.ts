import { format, parseISO, isToday, isYesterday, differenceInMinutes } from 'date-fns';
import type { Communication, User } from '@/types';

const HANDLED_ASSIGNMENT_STATUSES = [
  'completed',
  'accepted',
  'assigned',
  'wrapping',
  'wrapup',
  'reserved',
];

function nameFromRecord(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const name = (value as Record<string, unknown>).name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

export function isCallThread(comm: Communication): boolean {
  return comm.type === 'call' || comm.latest_type === 'call';
}

/** from/to pair used by conversation detail API (matches call-log links). */
export function getThreadEndpoints(
  comm: Communication
): { from: string; to: string } | null {
  if (!comm.from || !comm.to) return null;
  return {
    from: comm.direction === 'inbound' ? comm.to : comm.from,
    to: comm.direction === 'inbound' ? comm.from : comm.to,
  };
}

function getLatestCallLogFromRecord(comm: Communication): Communication | null {
  const ext = comm as Communication & Record<string, unknown>;

  for (const key of ['latest_call', 'last_call', 'call_log', 'latest_log']) {
    const nested = ext[key];
    if (nested && typeof nested === 'object') {
      return nested as Communication;
    }
  }

  const logs = ext.logs ?? ext.call_logs;
  if (Array.isArray(logs) && logs.length > 0) {
    const callLogs = logs.filter(
      (l: Communication) => l.type === 'call' || l.type === undefined
    ) as Communication[];
    if (callLogs.length === 0) return null;
    return callLogs.reduce((latest, log) => {
      const latestTime = new Date(latest.created_at || 0).getTime();
      const logTime = new Date(log.created_at || 0).getTime();
      return logTime > latestTime ? log : latest;
    }, callLogs[0]);
  }

  return null;
}

function resolveAttendeeFromFields(
  comm: Communication,
  companyUsers?: User[]
): string | null {
  if (comm.user?.name) return comm.user.name;

  if (comm.user_id != null && companyUsers?.length) {
    const match = companyUsers.find((u) => Number(u.id) === Number(comm.user_id));
    if (match?.name) return match.name;
  }

  if (typeof comm.user_name === 'string' && comm.user_name.trim()) {
    return comm.user_name.trim();
  }

  const ext = comm as Communication & Record<string, unknown>;
  for (const key of ['last_user', 'latest_user', 'assigned_user', 'handler', 'worker', 'agent']) {
    const name = nameFromRecord(ext[key]);
    if (name) return name;
  }

  const assignments = comm.task_assignments;
  if (assignments?.length) {
    for (const status of HANDLED_ASSIGNMENT_STATUSES) {
      const match = assignments.find(
        (a) => a.assignment_status?.toLowerCase() === status
      );
      if (match) {
        const name = match.user?.name || match.worker_name;
        if (name) return name;
      }
    }
    const fallback = assignments[assignments.length - 1];
    const name = fallback?.user?.name || fallback?.worker_name;
    if (name) return name;
  }

  const meta = comm.meta_data;
  if (meta && typeof meta === 'object') {
    const m = meta as Record<string, unknown>;
    for (const key of [
      'agent_name',
      'worker_name',
      'user_name',
      'attended_by',
      'handler_name',
      'agent',
    ]) {
      const val = m[key];
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
    if (m.user && typeof m.user === 'object') {
      const u = m.user as Record<string, unknown>;
      if (typeof u.name === 'string' && u.name.trim()) return u.name.trim();
    }
  }

  return null;
}

function resolveCallAttendeeName(
  comm: Communication,
  companyUsers?: User[]
): string | null {
  const nestedLatest = getLatestCallLogFromRecord(comm);
  if (nestedLatest) {
    const nestedName = resolveAttendeeFromFields(nestedLatest, companyUsers);
    if (nestedName) return nestedName;
  }

  return resolveAttendeeFromFields(comm, companyUsers);
}

export function isVoicemailCall(comm: Communication): boolean {
  if (Boolean(comm.voice_mail)) return true;
  const nestedLatest = getLatestCallLogFromRecord(comm);
  return Boolean(nestedLatest?.voice_mail);
}

/** Agent names are hidden for missed, hung-up, and voicemail calls. */
export function shouldShowCallAttendee(comm: Communication): boolean {
  if (!isCallThread(comm)) return false;
  if (isVoicemailCall(comm)) return false;
  if (isFailedCallRow(comm)) return false;

  const nestedLatest = getLatestCallLogFromRecord(comm);
  if (nestedLatest) {
    if (isVoicemailCall(nestedLatest) || isFailedCallRow(nestedLatest)) return false;
  }

  return true;
}

/** Name of the agent who handled or placed the latest call on a thread row. */
export function getCallAttendeeName(
  comm: Communication,
  companyUsers?: User[]
): string | null {
  if (!shouldShowCallAttendee(comm)) return null;
  return resolveCallAttendeeName(comm, companyUsers);
}

export function formatCallListingSubtitle(
  comm: Communication,
  companyUsers?: User[],
  options?: { omitAttendee?: boolean }
): string {
  const duration = comm.duration || comm.call_duration || '0';
  const attendeeName = options?.omitAttendee
    ? null
    : getCallAttendeeName(comm, companyUsers);
  const base = `${duration} seconds`;

  if (!attendeeName) return base;

  if (comm.direction === 'inbound') {
    return `${base} · Attended by ${attendeeName}`;
  }

  return `${base} · ${attendeeName}`;
}

export function formatCallAttendeeLabel(
  comm: Communication,
  companyUsers?: User[]
): string | null {
  const name = getCallAttendeeName(comm, companyUsers);
  if (!name) return null;
  return comm.direction === 'inbound' ? `Attended by ${name}` : `Called by ${name}`;
}

export function getCallAttendeeUser(
  comm: Communication,
  companyUsers?: User[]
): Pick<User, 'name' | 'profile_picture' | 'id'> | null {
  if (!shouldShowCallAttendee(comm)) return null;

  if (comm.user?.name) {
    return comm.user;
  }

  if (comm.user_id != null && companyUsers?.length) {
    const match = companyUsers.find((u) => Number(u.id) === Number(comm.user_id));
    if (match?.name) return match;
  }

  const name = getCallAttendeeName(comm, companyUsers);
  if (!name) return null;
  return { name, id: comm.user_id ?? 0 };
}

const MISSED_CALL_STATUSES = new Set([
  'missed',
  'no-answer',
  'no_answer',
  'busy',
  'canceled',
  'cancelled',
]);

const HUNG_UP_CALL_STATUSES = new Set([
  'hangup',
  'hang-up',
  'hung-up',
  'hung_up',
  'hang_up',
  'hungup',
]);

function normalizedCallStatus(comm: Communication): string {
  return String(comm.call_status || '').trim().toLowerCase();
}

export function isMissedCall(comm: Communication): boolean {
  if (!isCallThread(comm)) return false;
  if (MISSED_CALL_STATUSES.has(normalizedCallStatus(comm))) return true;

  const durationSec = parseInt(String(comm.duration || comm.call_duration || '0'), 10);
  const status = normalizedCallStatus(comm);
  return (
    comm.direction === 'inbound' &&
    durationSec === 0 &&
    status !== 'in_progress' &&
    status !== 'completed' &&
    !HUNG_UP_CALL_STATUSES.has(status)
  );
}

export function isHungUpCall(comm: Communication): boolean {
  if (!isCallThread(comm)) return false;
  return HUNG_UP_CALL_STATUSES.has(normalizedCallStatus(comm));
}

export function isFailedCallRow(comm: Communication): boolean {
  return isMissedCall(comm) || isHungUpCall(comm);
}

export function formatCallTypeDurationLine(comm: Communication): string {
  if (comm.type === 'sms' || comm.latest_type === 'sms') {
    return comm.direction === 'inbound' ? 'Inbound / MMS' : 'Outbound / MMS';
  }

  if (comm.call_status === 'in_progress') {
    return 'Active call';
  }

  const directionLabel = comm.direction === 'inbound' ? 'Inbound' : 'Outbound';
  if (isHungUpCall(comm)) {
    return `${directionLabel} / Hung up`;
  }
  if (isMissedCall(comm)) {
    return `${directionLabel} / Missed`;
  }

  const durationSec = parseInt(String(comm.duration || comm.call_duration || '0'), 10);
  if (durationSec >= 60) {
    const minutes = Math.max(1, Math.round(durationSec / 60));
    return `${directionLabel} / ${minutes} min`;
  }
  if (durationSec > 0) {
    return `${directionLabel} / ${durationSec} sec`;
  }

  return directionLabel;
}

export function formatSidebarTimestamp(createdAt?: string | null): string {
  if (!createdAt) return '';
  try {
    const date = parseISO(createdAt);
    if (isToday(date)) return format(date, 'h:mma').toLowerCase();
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d');
  } catch {
    return '';
  }
}

export function formatListingTimestamp(createdAt?: string | null): string {
  if (!createdAt) return '';
  try {
    const date = parseISO(createdAt);
    const minutesAgo = differenceInMinutes(new Date(), date);
    const time = format(date, 'h:mma').toLowerCase();
    if (minutesAgo < 1) return 'Just now';
    if (isToday(date)) return time;
    if (isYesterday(date)) return `Yesterday, ${time}`;
    return format(date, 'MMM d, h:mma').toLowerCase();
  } catch {
    return '';
  }
}
