import type { User } from '@/types';
import { events } from '@/lib/events';

export type WorkerActivityName = 'Available' | 'Unavailable' | 'Offline' | string;

/** Normalize TaskRouter / presence activity labels to canonical UI names. */
export function normalizeWorkerActivityName(
  status: string | null | undefined
): WorkerActivityName | null {
  if (!status || typeof status !== 'string') return null;
  switch (status.trim().toLowerCase()) {
    case 'available':
      return 'Available';
    case 'unavailable':
      return 'Unavailable';
    case 'offline':
      return 'Offline';
    default:
      return status;
  }
}

export function isUnavailableLikeActivity(status: string | null | undefined): boolean {
  const normalized = normalizeWorkerActivityName(status);
  return normalized === 'Unavailable' || normalized === 'Offline';
}

export function getWorkerStatusFromUser(
  user: User | Record<string, unknown> | null | undefined
): WorkerActivityName | undefined {
  if (!user) return undefined;
  const u = user as Record<string, unknown>;
  const status = u.worker_status ?? u.activity_name ?? u.activity ?? u.worker_activity;
  if (typeof status !== 'string' || !status.length) return undefined;
  return normalizeWorkerActivityName(status) ?? status;
}

export function parseWorkerStatusPayload(
  data: Record<string, unknown> | null | undefined
): { user_id: number; worker_status: WorkerActivityName } | null {
  if (!data) return null;
  const userId = data.user_id ?? data.userId;
  const status =
    data.worker_status ?? data.activity_name ?? data.activity ?? data.status;
  if (userId == null || typeof status !== 'string' || !status) return null;
  return {
    user_id: Number(userId),
    worker_status: normalizeWorkerActivityName(status) ?? status,
  };
}

export function dispatchOperatorStatusUpdate(
  data: Record<string, unknown> | null | undefined
): void {
  if (!data || data.user_id == null) return;

  const statusPayload = parseWorkerStatusPayload(data);
  if (statusPayload) {
    events.emit('refreshWorkerStatus', statusPayload);
  }

  if (data.in_call != null) {
    events.emit('refreshInCallStatus', data);
  }

  const dndValue = data.is_dnd ?? data.do_not_disturb;
  if (dndValue != null) {
    events.emit('refreshOperators', {
      user_id: data.user_id,
      is_dnd: dndValue,
      department_id: data.department_id,
    });
  }
}

export function getWorkerStatusBadgeVariant(
  status: WorkerActivityName | undefined
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'Available':
      return 'default';
    case 'Unavailable':
      return 'secondary';
    case 'Offline':
      return 'destructive';
    default:
      return 'outline';
  }
}
