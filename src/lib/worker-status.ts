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

const MANUAL_UNAVAILABLE_KEY = 'wsh-manual-unavailable';
const PRESENCE_UNLOAD_KEY = 'wsh-presence-unload';

/** True when the agent explicitly chose Unavailable/Offline in this browser session. */
export function readManualUnavailableIntent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(MANUAL_UNAVAILABLE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeManualUnavailableIntent(unavailable: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (unavailable) {
      sessionStorage.setItem(MANUAL_UNAVAILABLE_KEY, '1');
    } else {
      sessionStorage.removeItem(MANUAL_UNAVAILABLE_KEY);
    }
  } catch {
    // ignore
  }
}

/** Mark that this tab is unloading (reload or close). sessionStorage survives reload only. */
export function markPresenceUnload(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(PRESENCE_UNLOAD_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/** True when this boot follows a reload (sessionStorage survived). */
export function consumePresenceReload(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const at = Number(sessionStorage.getItem(PRESENCE_UNLOAD_KEY) || 0);
    sessionStorage.removeItem(PRESENCE_UNLOAD_KEY);
    return at > 0 && Date.now() - at < 30_000;
  } catch {
    return false;
  }
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

  // Department DND is only published on `dnd_notification` / `dnd_status_change`.
  // Presence payloads must not be replayed as a per-department DND change — even
  // when they happen to include both department_id and is_dnd.
  const overallDnd = data.do_not_disturb ?? (data.department_id == null ? data.is_dnd : null);
  if (overallDnd != null) {
    events.emit('refreshOverallDnd', {
      user_id: data.user_id,
      do_not_disturb: overallDnd,
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
