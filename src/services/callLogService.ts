
import axios from '@/lib/axios';
import type { Call } from '@/types';

export const getCallLogs = async (): Promise<Call[]> => {
  const response = await axios.get('/api/call-logs/');
  return response.data.call_logs;
};

// Fetch call logs with callSid
export const getCallLogsBySid = async (callSid: string): Promise<Call | null> => {
  try {
    const response = await axios.get(`/api/call-logs/${callSid}`);
    return response.data.call_log || null;
  } catch (error) {
    console.error('Error fetching call log by SID:', error);
    return null;
  }
};

export const getDepartmentNewCalls = async (department_id: number): Promise<Call[]> => {
    const response = await axios.post('/api/department/getDepartmentNewCalls', { department_id });
    return response.data.calls;
};


export const getUnreadCallLogs = async (): Promise<Call[]> => {
  const response = await axios.get('/api/call-logs/unread');
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

    