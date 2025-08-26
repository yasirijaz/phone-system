
import axios from '@/lib/axios';
import type { Communication } from '@/types';

export const getCommunications = async (departmentId?: number): Promise<Communication[]> => {
  const url = departmentId
    ? `/api/communications/${departmentId}`
    : `/api/communications`;

  const response = await axios.get(url);
  return response.data.logs;
};

export const getCommunicationThreads = async (departmentId?: number): Promise<Communication[]> => {
    const url = departmentId 
        ? `/api/communications/threads/${departmentId}` 
        : '/api/communications/threads';
    const response = await axios.get(url);
    return response.data.threads;
};

export const getCommunicationThread = async (from: string, to: string): Promise<Communication[]> => {
    const response = await axios.get(`/api/communications/thread/${from}/${to}`);
    return response.data.logs;
};

// Fetch call logs with callSid
export const getCallLogsBySid = async (callSid: string): Promise<Communication | null> => {
  try {
    const response = await axios.get(`/api/call-logs/${callSid}`);
    return response.data.call_log || null;
  } catch (error) {
    console.error('Error fetching call log by SID:', error);
    return null;
  }
};

export const getDepartmentNewCalls = async (department_id: number): Promise<Communication[]> => {
    const response = await axios.post('/api/departments/getDepartmentNewCalls', { department_id });
    return response.data.calls;
};

export const getDepartmentMissedCalls = async (department_id: number): Promise<Communication[]> => {
    const response = await axios.post('/api/departments/getDepartmentMissedCalls', { department_id });
    return response.data.calls;
};

export const getDepartmentRecordings = async (department_id: number): Promise<Communication[]> => {
    const response = await axios.post('/api/departments/getDepartmentRecordings', { department_id });
    return response.data.calls;
};


export const getUnreadCallLogs = async (departmentId?: number): Promise<Communication[]> => {
  const url = departmentId
    ? `/api/call-logs/unread/${departmentId}`
    : `/api/call-logs/unread`;

  const response = await axios.get(url);
  return response.data.call_logs;
};

export const markRead = async (id: string): Promise<void> => {
  await axios.post(`/api/call-logs/${id}/mark-read`);
};

export const starCall = async (id: string): Promise<void> => {
  await axios.post(`/api/call-logs/${id}/star`);
};

export const unstarCall = async (id: string): Promise<void> => {
    await axios.post(`/api/call-logs/${id}/unstar`);
};

    
