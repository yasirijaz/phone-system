

import axios from '@/lib/axios';
import type {
  CallHistoryDirectionFilter,
  CallHistoryStatusFilter,
} from '@/lib/call-history-filters';
import type { Communication, PaginatedCommunicationsResponse, User } from '@/types';
import {
  getCallAttendeeName,
  getThreadEndpoints,
  isCallThread,
  shouldShowCallAttendee,
} from '@/lib/call-attendee';
import { cacheGet, cacheSet, cacheDel, cacheInvalidatePrefix } from '@/lib/simpleCache';

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

export function invalidateCommunicationThreadCache(from: string, to: string): void {
  for (const key of [`thread-logs:${from}:${to}`, `thread-logs:${to}:${from}`]) {
    cacheDel(key);
    inFlightThreadRequests.delete(key);
  }
}

export const getCommunicationThread = async (
  from: string,
  to: string,
  options?: { bypassCache?: boolean; departmentId?: string | number | null }
): Promise<Communication[]> => {
    const departmentKey = options?.departmentId ? `:dept:${options.departmentId}` : '';
    const cacheKey = `thread-logs:${from}:${to}${departmentKey}`;

    if (options?.bypassCache) {
        invalidateCommunicationThreadCache(from, to);
    } else {
        const cached = cacheGet<Communication[]>(cacheKey);
        if (cached) return cached;
    }

    let inFlight = inFlightThreadRequests.get(cacheKey);
    if (!inFlight) {
      inFlight = axios
        .get(`/api/communications/thread/${from}/${to}`, {
          params: options?.departmentId ? { department_id: options.departmentId } : undefined,
        })
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
    (thread) =>
      isCallThread(thread) &&
      shouldShowCallAttendee(thread) &&
      !getCallAttendeeName(thread, companyUsers)
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

export const dismissActiveCall = async (): Promise<void> => {
  try {
    await axios.post('/api/call-logs/active/dismiss');
  } catch (error) {
    console.warn('Failed to dismiss active call session:', error);
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

export const setActivityReadState = async (
  id: string | number,
  type: 'call' | 'sms',
  isRead: boolean
): Promise<void> => {
  await axios.post('/api/communications/read-state', {
    id: Number(id),
    type,
    is_read: isRead,
  });
  cacheInvalidatePrefix('unread-logs:');
  cacheInvalidatePrefix('dept-summary:');
  cacheInvalidatePrefix('sidebar:');
  cacheInvalidatePrefix('comm:');
};

export const updateActivityFollowUp = async (
  id: string | number,
  type: 'call' | 'sms',
  status: 'needs_follow_up' | 'in_progress' | 'completed',
  note?: string
): Promise<void> => {
  await axios.post('/api/communications/follow-up', {
    id: Number(id),
    type,
    status,
    note,
  });
  cacheInvalidatePrefix('comm:');
};

export const markRead = async (id: string, type: 'call' | 'sms'): Promise<void> => {
    if (!id || (type !== 'call' && type !== 'sms')) {
        console.warn("markRead: Invalid id or type provided.", { id, type });
        return;
    }
    const endpoint = type === 'call' ? 'call-logs' : 'sms-logs';
    await axios.post(`/api/${endpoint}/${id}/mark-read`);
    cacheInvalidatePrefix('unread-logs:');
    cacheInvalidatePrefix('dept-summary:');
    cacheInvalidatePrefix('sidebar:');
};

export const markThreadAsRead = async (
  from: string,
  to: string,
  departmentId?: string | number | null
): Promise<void> => {
  await axios.post(`/api/communications/thread/mark-read`, {
    from,
    to,
    ...(departmentId ? { department_id: Number(departmentId) } : {}),
  });
  cacheInvalidatePrefix('unread-logs:');
  cacheInvalidatePrefix('dept-summary:');
  cacheInvalidatePrefix('sidebar:');
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

export type CallHistorySummary = {
  total: number;
  completed: number;
  missed: number;
  in_progress: number;
  rejected: number;
};

export type CallHistoryPagination = {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  perPage: number;
};

export type PhoneActivityDetails = {
  phone_number: string;
  calls: CallActivityEntry[];
  total_calls: number;
  pagination: CallHistoryPagination;
  summary: CallHistorySummary;
};

export type UserCallActivityDetails = {
  user: { id: number; name: string; email: string };
  calls: CallActivityEntry[];
  total_calls: number;
  pagination: CallHistoryPagination;
  summary: CallHistorySummary;
};

export type PhoneCommunicationEntry = {
  id: number;
  type: 'call' | 'sms';
  from: string;
  to: string;
  direction: 'inbound' | 'outbound';
  body?: string | null;
  call_status?: string | null;
  call_duration?: string | null;
  status?: string | null;
  created_at: string;
  user?: { id: number; name: string; email: string } | null;
  department?: { id: number; name: string } | null;
  call_sid?: string | null;
  recording_url?: string | null;
  voice_mail?: string | null;
  meta_data?: Record<string, unknown> | null;
  is_read?: boolean | number | null;
  is_starred?: boolean | number | null;
};

export type PhoneCommunicationDetails = {
  phone_number: string;
  communications: PhoneCommunicationEntry[];
  total_communications: number;
  total_calls: number;
  total_sms: number;
  pagination: CallHistoryPagination;
  summary: CallHistorySummary;
};

export type CommunicationTypeFilter = 'all' | 'call' | 'sms';

type CallHistoryQuery = {
  page?: number;
  perPage?: number;
  departmentId?: number;
  direction?: CallHistoryDirectionFilter;
  status?: CallHistoryStatusFilter;
};

type PhoneCommunicationQuery = CallHistoryQuery & {
  communicationType?: CommunicationTypeFilter;
};

function mapCallHistoryPagination(
  data: Record<string, unknown>,
  fallbackPerPage: number,
  requestedPage: number,
  callsCount: number
): CallHistoryPagination {
  const perPage = Number(data.per_page ?? fallbackPerPage);
  const totalRecords = Number(data.total_calls ?? callsCount);
  const currentPage = Number(data.current_page ?? requestedPage);

  let totalPages = Number(data.total_pages);
  if (!Number.isFinite(totalPages) || totalPages < 1) {
    totalPages = Math.max(1, Math.ceil(totalRecords / perPage));
  }

  // Correct metadata when the API returned an unpaginated payload.
  if (callsCount > perPage && totalPages <= 1 && totalRecords > perPage) {
    totalPages = Math.max(1, Math.ceil(totalRecords / perPage));
  }

  return {
    currentPage,
    totalPages,
    totalRecords,
    perPage,
  };
}

function normalizePaginatedCalls(
  calls: CallActivityEntry[],
  page: number,
  perPage: number
): CallActivityEntry[] {
  if (calls.length <= perPage) {
    return calls;
  }

  const start = (page - 1) * perPage;
  return calls.slice(start, start + perPage);
}

function mapCallHistorySummary(data: Record<string, unknown>): CallHistorySummary {
  const summary = (data.call_summary ?? {}) as Record<string, unknown>;
  return {
    total: Number(summary.total ?? data.total_calls ?? 0),
    completed: Number(summary.completed ?? 0),
    missed: Number(summary.missed ?? 0),
    in_progress: Number(summary.in_progress ?? 0),
    rejected: Number(summary.rejected ?? 0),
  };
}

export const getPhoneCallHistory = async (
  phoneNumber: string,
  { page = 1, perPage = 10, departmentId, direction = 'all', status = 'all' }: CallHistoryQuery = {}
): Promise<PhoneActivityDetails> => {
  const response = await axios.post('/api/communications/phone-details', {
    phone_number: phoneNumber,
    calls_only: true,
    page,
    per_page: perPage,
    call_direction: direction,
    call_status: status,
    ...(departmentId ? { department_id: departmentId } : {}),
  });
  const data = response.data;
  const rawCalls = Array.isArray(data.calls) ? data.calls : [];
  const effectivePerPage = Number(data.per_page ?? perPage);
  const effectivePage = Number(data.current_page ?? page);
  const calls = normalizePaginatedCalls(rawCalls, effectivePage, effectivePerPage);

  return {
    phone_number: data.phone_number ?? phoneNumber,
    calls,
    total_calls: data.total_calls ?? rawCalls.length,
    pagination: mapCallHistoryPagination(data, perPage, page, rawCalls.length),
    summary: mapCallHistorySummary(data),
  };
};

/** @deprecated Use getPhoneCallHistory */
export const getPhoneActivityDetails = getPhoneCallHistory;

export const getPhoneCommunicationHistory = async (
  phoneNumber: string,
  {
    page = 1,
    perPage = 10,
    departmentId,
    direction = 'all',
    status = 'all',
    communicationType = 'all',
  }: PhoneCommunicationQuery = {}
): Promise<PhoneCommunicationDetails> => {
  const response = await axios.post('/api/communications/phone-details', {
    phone_number: phoneNumber,
    calls_only: false,
    communication_type: communicationType,
    page,
    per_page: perPage,
    call_direction: direction,
    call_status: status,
    ...(departmentId ? { department_id: departmentId } : {}),
  });
  const data = response.data;
  const communications = Array.isArray(data.communications) ? data.communications : [];
  const perPageValue = Number(data.per_page ?? perPage);
  const currentPage = Number(data.current_page ?? page);
  const totalRecords = Number(data.total_communications ?? communications.length);
  let totalPages = Number(data.total_pages);
  if (!Number.isFinite(totalPages) || totalPages < 1) {
    totalPages = Math.max(1, Math.ceil(totalRecords / perPageValue));
  }

  return {
    phone_number: data.phone_number ?? phoneNumber,
    communications,
    total_communications: totalRecords,
    total_calls: Number(data.total_calls ?? 0),
    total_sms: Number(data.total_sms ?? 0),
    pagination: {
      currentPage,
      totalPages,
      totalRecords,
      perPage: perPageValue,
    },
    summary: mapCallHistorySummary(data),
  };
};

export const getUserCallHistory = async (
  userId: number,
  { page = 1, perPage = 10, departmentId, direction = 'all', status = 'all' }: CallHistoryQuery = {}
): Promise<UserCallActivityDetails> => {
  const response = await axios.post('/api/communications/user-calls', {
    user_id: userId,
    page,
    per_page: perPage,
    call_direction: direction,
    call_status: status,
    ...(departmentId ? { department_id: departmentId } : {}),
  });
  const data = response.data;
  const rawCalls = Array.isArray(data.calls) ? data.calls : [];
  const effectivePerPage = Number(data.per_page ?? perPage);
  const effectivePage = Number(data.current_page ?? page);
  const calls = normalizePaginatedCalls(rawCalls, effectivePage, effectivePerPage);

  return {
    user: data.user,
    calls,
    total_calls: data.total_calls ?? rawCalls.length,
    pagination: mapCallHistoryPagination(data, perPage, page, rawCalls.length),
    summary: mapCallHistorySummary(data),
  };
};
