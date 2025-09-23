

import axios from '@/lib/axios';
import type { Communication, PaginatedCommunicationsResponse } from '@/types';

export const getCommunications = async (filters: Record<string, any> = {}): Promise<PaginatedCommunicationsResponse> => {
  const params = new URLSearchParams(filters);
  const response = await axios.get(`/api/communications/threads?${params.toString()}`);
  return response.data.data;
};

export const getCommunicationThreads = async (type: string, page: number = 1, limit: number = 10, departmentId?: number): Promise<PaginatedCommunicationsResponse> => {
    const url = departmentId 
        ? `/api/communications/threads/${departmentId}` 
        : '/api/communications/threads';
    const response = await axios.get(url, {
        params: { type, page, limit }
    });
    return response.data.data;
};

export const getCommunicationThread = async (from: string, to: string): Promise<Communication[]> => {
    const response = await axios.get(`/api/communications/thread/${from}/${to}`);
    return response.data.logs;
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

export const starCall = async (id: string): Promise<void> => {
  await axios.post(`/api/call-logs/${id}/star`);
};

export const unstarCall = async (id: string): Promise<void> => {
    await axios.post(`/api/call-logs/${id}/unstar`);
};

    

    


