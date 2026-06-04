import type { User } from '@/types';

export type WorkerActivityName = 'Available' | 'Unavailable' | 'Offline' | string;

export function getWorkerStatusFromUser(
  user: User | Record<string, unknown> | null | undefined
): WorkerActivityName | undefined {
  if (!user) return undefined;
  const u = user as Record<string, unknown>;
  const status = u.worker_status ?? u.activity_name ?? u.activity ?? u.worker_activity;
  return typeof status === 'string' && status.length > 0 ? status : undefined;
}

export function parseWorkerStatusPayload(
  data: Record<string, unknown> | null | undefined
): { user_id: number; worker_status: WorkerActivityName } | null {
  if (!data) return null;
  const userId = data.user_id ?? data.userId;
  const status =
    data.worker_status ?? data.activity_name ?? data.activity ?? data.status;
  if (userId == null || typeof status !== 'string' || !status) return null;
  return { user_id: Number(userId), worker_status: status };
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
