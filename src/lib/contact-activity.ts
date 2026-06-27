import type { Communication } from '@/types';
import type { PhoneCommunicationEntry } from '@/services/callLogService';

export function phoneEntryToCommunication(entry: PhoneCommunicationEntry): Communication {
  return {
    id: entry.id,
    type: entry.type,
    from: entry.from,
    to: entry.to,
    direction: entry.direction,
    body: entry.body ?? undefined,
    call_status: entry.call_status ?? undefined,
    call_duration: entry.call_duration ?? undefined,
    duration: entry.call_duration ?? undefined,
    status: entry.status ?? undefined,
    created_at: entry.created_at,
    user: entry.user ?? undefined,
    department: entry.department
      ? ({ id: entry.department.id, name: entry.department.name } as Communication['department'])
      : undefined,
    call_sid: entry.call_sid ?? undefined,
    recording_url: entry.recording_url ?? undefined,
    voice_mail: entry.voice_mail ?? undefined,
    meta_data: entry.meta_data ?? undefined,
    is_read: entry.is_read,
    is_starred: Boolean(entry.is_starred),
  };
}

export function sortCommunicationsChronologically<T extends { created_at: string }>(
  entries: T[]
): T[] {
  return [...entries].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}
