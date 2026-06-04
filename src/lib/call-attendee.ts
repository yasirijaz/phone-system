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

/** Name of the agent who handled or placed the latest call on a thread row. */
export function getCallAttendeeName(
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
