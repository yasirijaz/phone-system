

import axios from '@/lib/axios';
import type { Communication, PaginatedCommunicationsResponse, User } from '@/types';
import {
  getCallAttendeeName,
  getThreadEndpoints,
  isCallThread,
} from '@/lib/call-attendee';
import { cacheGet, cacheSet } from '@/lib/simpleCache';

const THREAD_ATTENDEE_CACHE_TTL = 5 * 60_000;

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
    const response = await axios.get(`/api/communications/thread/${from}/${to}`);
    return response.data.logs;
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

  const enrichOne = async (thread: Communication): Promise<Communication> => {
    if (!isCallThread(thread) || getCallAttendeeName(thread, companyUsers)) {
      return thread;
    }

    const endpoints = getThreadEndpoints(thread);
    if (!endpoints) return thread;

    const cacheKey = `thread-attendee:${endpoints.from}:${endpoints.to}`;
    const cached = cacheGet<Partial<Communication>>(cacheKey);
    if (cached) {
      return { ...thread, ...cached };
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
      return { ...thread, ...patch };
    } catch {
      return thread;
    }
  };

  return mapWithConcurrency(threads, ENRICH_CONCURRENCY, enrichOne);
}

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
  const url = departmentId
    ? `/api/call-logs/unread/${departmentId}`
    : `/api/call-logs/unread`;

  const response = await axios.get(url);
  return response.data.data;
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
