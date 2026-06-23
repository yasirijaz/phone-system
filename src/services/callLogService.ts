

import axios from '@/lib/axios';
import type { Communication, PaginatedCommunicationsResponse, User } from '@/types';
import {
  getCallAttendeeName,
  getThreadEndpoints,
  isCallThread,
} from '@/lib/call-attendee';
import { cacheGet, cacheSet } from '@/lib/simpleCache';

const THREAD_ATTENDEE_CACHE_TTL = 5 * 60_000;
const THREAD_LOGS_CACHE_TTL = 2 * 60_000;
const MAX_THREADS_TO_ENRICH = 5;

const inFlightThreadRequests = new Map<string, Promise<Communication[]>>();

export const getCommunications = async (filters: Record<string, any> = {}): Promise<PaginatedCommunicationsResponse> => {
  const safeFilters: Record<string, any> = { ...filters };
  const requestedLimit = Number(safeFilters.limit ?? 10);
  const cappedLimit = isNaN(requestedLimit) ? 10 : Math.min(requestedLimit, 50);
  safeFilters.limit = cappedLimit;
  const params = new URLSearchParams(safeFilters);
  const response = await axios.get(`/api/communications/threads?${params.toString()}`);
  return response.data.data;
};

export const getCommunicationThreads = async (type: string, page: number = 1, limit: number = 10, departmentId?: number): Promise<PaginatedCommunicationsResponse> => {
    const url = departmentId 
        ? `/api/communications/threads/${departmentId}` 
        : '/api/communications/threads';
    const requestedLimit = Number(limit ?? 10);
    const cappedLimit = isNaN(requestedLimit) ? 10 : Math.min(requestedLimit, 50);
    const response = await axios.get(url, {
        params: { type, page, limit: cappedLimit }
    });
    return response.data.data;
};

export const getCommunicationThread = async (from: string, to: string): Promise<Communication[]> => {
    const cacheKey = `thread-logs:${from}:${to}`;
    const cached = cacheGet<Communication[]>(cacheKey);
    if (cached) return cached;

    let inFlight = inFlightThreadRequests.get(cacheKey);
    if (!inFlight) {
      inFlight = axios
        .get(`/api/communications/thread/${from}/${to}`)
        .then((response) => {
          const logs = response.data.logs ?? [];
          cacheSet(cacheKey, logs, THREAD_LOGS_CACHE_TTL);
          return logs;
        })
        .finally(() => {
          inFlightThreadRequests.delete(cacheKey);
        });
      inFlightThreadRequests.set(cacheKey, inFlight);
    }

    return inFlight;
};

function pickLatestCallLog(logs: Communication[]): Communication | null {
  const callLogs = logs.filter((l) => l.type === 'call');
  if (!callLogs.length) return null;
  return callLogs.reduce((latest, log) => {
    const latestTime = new Date(latest.created_at || 0).getTime();
    const logTime = new Date(log.created_at || 0).getTime();
    return logTime > latestTime ? log : latest;
  }, callLogs[0]);
}

const ENRICH_CONCURRENCY = 2;

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (!items.length) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await fn(items[current]);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

/** Thread list rows omit agent info; load it from the conversation thread (same as detail page). */
export async function enrichThreadsWithLastAttendee(
  threads: Communication[],
  companyUsers?: User[]
): Promise<Communication[]> {
  if (!threads.length) return threads;

  const needsEnrichment = threads.filter(
    (thread) => isCallThread(thread) && !getCallAttendeeName(thread, companyUsers)
  );
  if (!needsEnrichment.length) return threads;

  const toEnrich = needsEnrichment.slice(0, MAX_THREADS_TO_ENRICH);
  const enrichedById = new Map<number | string, Communication>();

  const enrichedSubset = await mapWithConcurrency(toEnrich, ENRICH_CONCURRENCY, async (thread) => {
    const endpoints = getThreadEndpoints(thread);
    if (!endpoints) return thread;

    const cacheKey = `thread-attendee:${endpoints.from}:${endpoints.to}`;
    const cached = cacheGet<Partial<Communication>>(cacheKey);
    if (cached) {
      const merged = { ...thread, ...cached };
      if (thread.id != null) enrichedById.set(thread.id, merged);
      return merged;
    }

    try {
      const logs = await getCommunicationThread(endpoints.from, endpoints.to);
      const latestCall = pickLatestCallLog(Array.isArray(logs) ? logs : []);
      if (!latestCall) return thread;

      const attendeeName = getCallAttendeeName(latestCall, companyUsers);
      const patch: Partial<Communication> = {
        user: latestCall.user ?? thread.user,
        user_id: latestCall.user_id ?? thread.user_id,
        task_assignments: latestCall.task_assignments ?? thread.task_assignments,
      };
      if (attendeeName) {
        patch.user_name = attendeeName;
      }

      cacheSet(cacheKey, patch, THREAD_ATTENDEE_CACHE_TTL);
      const merged = { ...thread, ...patch };
      if (thread.id != null) enrichedById.set(thread.id, merged);
      return merged;
    } catch {
      return thread;
    }
  });

  enrichedSubset.forEach((thread) => {
    if (thread.id != null) enrichedById.set(thread.id, thread);
  });

  return threads.map((thread) =>
    thread.id != null && enrichedById.has(thread.id)
      ? enrichedById.get(thread.id)!
      : thread
  );
}

export const getActiveCall = async (): Promise<Communication | null> => {
  try {
    const response = await axios.get('/api/call-logs/active/current');
    return response.data.call_log || null;
  } catch (error) {
    console.error('Error fetching active call:', error);
    return null;
  }
};

export const getCallLogsBySid = async (callSid: string): Promise<Communication | null> => {
  try {
    const response = await axios.get(`/api/call-logs/${callSid}`);
    return response.data.call_log || null;
  } catch (error) {
    console.error('Error fetching call log by SID:', error);
    return null;
  }
};

export const getDepartmentNewCalls = async (department_id: number, page: number = 1): Promise<PaginatedCommunicationsResponse> => {
    const response = await axios.post(`/api/departments/getDepartmentNewCalls?page=${page}`, { department_id });
    return response.data;
};

export const getDepartmentMissedCalls = async (department_id: number, page: number = 1): Promise<PaginatedCommunicationsResponse> => {
    const response = await axios.post(`/api/departments/getDepartmentMissedCalls?page=${page}`, { department_id });
    return response.data.data;
};

export const getDepartmentRecordings = async (department_id: number, page: number = 1): Promise<PaginatedCommunicationsResponse> => {
    const response = await axios.post(`/api/departments/getDepartmentRecordings?page=${page}`, { department_id });
    return response.data.data;
};

export const getDepartmentVoiceMails = async (department_id: number, page: number = 1): Promise<PaginatedCommunicationsResponse> => {
    const response = await axios.post(`/api/departments/getDepartmentVoiceMails?page=${page}`, { department_id });
    return response.data.data;
};

export const getUnreadCallLogs = async (departmentId?: number): Promise<Communication[]> => {
  const cacheKey = departmentId ? `unread-logs:${departmentId}` : 'unread-logs:all';
  const cached = cacheGet<Communication[]>(cacheKey);
  if (cached) return cached;

  const url = departmentId
    ? `/api/call-logs/unread/${departmentId}`
    : `/api/call-logs/unread`;

  const response = await axios.get(url);
  const data = response.data.data ?? [];
  cacheSet(cacheKey, data, 5_000);
  return data;
};

export const markRead = async (id: string, type: 'call' | 'sms'): Promise<void> => {
    if (!id || (type !== 'call' && type !== 'sms')) {
        console.warn("markRead: Invalid id or type provided.", { id, type });
        return;
    }
    const endpoint = type === 'call' ? 'call-logs' : 'sms-logs';
    await axios.post(`/api/${endpoint}/${id}/mark-read`);
};

export const markThreadAsRead = async (from: string, to: string): Promise<void> => {
  await axios.post(`/api/communications/thread/mark-read`, { from, to });
};

type MarkField = 'is_starred' | 'is_spam';

export const markCommunicationField = async (
  id: number | string,
  type: 'sms' | 'call',
  field: MarkField,
  value: boolean
): Promise<void> => {
  await axios.post(`/api/communications/mark-log`, {
    id: Number(id),
    type,
    field,
    value,
  });
};

export const starCall = async (id: string): Promise<void> => {
  await axios.post(`/api/call-logs/${id}/star`);
};

export const unstarCall = async (id: string): Promise<void> => {
    await axios.post(`/api/call-logs/${id}/unstar`);
};

export const saveTranscription = async (id: number, transcribe_text: string): Promise<void> => {
    await axios.post(`/api/call-logs/${id}/transcription`, { transcribe_text });
}

export type CallActivityEntry = {
  id: number;
  call_sid?: string;
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  call_status?: string;
  call_duration?: string;
  created_at: string;
  user?: { id: number; name: string; email: string } | null;
};

/** @deprecated Use CallActivityEntry */
export type PhoneActivityCall = CallActivityEntry;

export type PhoneActivityDetails = {
  phone_number: string;
  calls: CallActivityEntry[];
  total_calls: number;
};

export type UserCallActivityDetails = {
  user: { id: number; name: string; email: string };
  calls: CallActivityEntry[];
  total_calls: number;
};

export const getPhoneCallHistory = async (
  phoneNumber: string,
  departmentId?: number
): Promise<PhoneActivityDetails> => {
  const response = await axios.post('/api/communications/phone-details', {
    phone_number: phoneNumber,
    calls_only: true,
    ...(departmentId ? { department_id: departmentId } : {}),
  });
  const data = response.data;
  return {
    phone_number: data.phone_number ?? phoneNumber,
    calls: Array.isArray(data.calls) ? data.calls : [],
    total_calls: data.total_calls ?? 0,
  };
};

/** @deprecated Use getPhoneCallHistory */
export const getPhoneActivityDetails = getPhoneCallHistory;

export const getUserCallHistory = async (
  userId: number,
  departmentId?: number
): Promise<UserCallActivityDetails> => {
  const response = await axios.post('/api/communications/user-calls', {
    user_id: userId,
    ...(departmentId ? { department_id: departmentId } : {}),
  });
  const data = response.data;
  return {
    user: data.user,
    calls: Array.isArray(data.calls) ? data.calls : [],
    total_calls: data.total_calls ?? 0,
  };
};
