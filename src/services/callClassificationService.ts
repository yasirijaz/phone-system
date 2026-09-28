import axios from '@/lib/axios';

export interface CallDispositionOption {
  id: number;
  label: string;
  sort_order: number;
  is_active?: boolean;
}

export interface PendingCallClassification {
  call_log_id: number;
  caller_label: string;
  direction: 'inbound' | 'outbound' | string;
  duration_seconds: number;
  duration_label: string;
}

export interface PendingClassificationResponse {
  pending: PendingCallClassification[];
  dispositions: CallDispositionOption[];
}

export const getPendingClassifications = async () => {
  const response = await axios.get('/api/call-classifications/pending');
  return response.data as { status: string } & PendingClassificationResponse;
};

export const saveCallClassification = async (payload: {
  call_log_id: number;
  disposition_id?: number | null;
  custom_label?: string | null;
  note?: string | null;
}) => {
  const response = await axios.post('/api/call-classifications', payload);
  return response.data;
};

export const getCallDispositions = async (companyId: number) => {
  const response = await axios.get(`/api/companies/${companyId}/call-dispositions`);
  return response.data as { dispositions: CallDispositionOption[] };
};

export const createCallDisposition = async (companyId: number, label: string) => {
  const response = await axios.post(`/api/companies/${companyId}/call-dispositions`, { label });
  return response.data;
};

export const updateCallDisposition = async (
  companyId: number,
  id: number,
  payload: { label?: string; is_active?: boolean }
) => {
  const response = await axios.put(`/api/companies/${companyId}/call-dispositions/${id}`, payload);
  return response.data;
};

export const reorderCallDispositions = async (companyId: number, ids: number[]) => {
  const response = await axios.put(`/api/companies/${companyId}/call-dispositions/reorder`, { ids });
  return response.data;
};

export interface CallOutcomeSummary {
  key: string;
  label: string;
  disposition_id: number | null;
  custom_label: string | null;
  count: number;
}

export interface CallOutcomeCall {
  id: number;
  from: string;
  to: string;
  direction: string;
  call_status?: string;
  duration?: string | number | null;
  created_at?: string | null;
  caller_label: string;
  agent_name?: string | null;
  department_name?: string | null;
  classification?: {
    label: string;
    note?: string | null;
    user_name?: string | null;
  } | null;
}

export const getCallOutcomeSummary = async () => {
  const response = await axios.get('/api/call-outcomes');
  return response.data as { status: string; outcomes: CallOutcomeSummary[] };
};

export const getCallOutcomeCalls = async (params: {
  disposition_id?: number | null;
  custom_label?: string | null;
  page?: number;
  per_page?: number;
}) => {
  const response = await axios.get('/api/call-outcomes/calls', { params });
  return response.data as {
    status: string;
    calls: CallOutcomeCall[];
    pagination: { page: number; per_page: number; total: number; total_pages: number };
  };
};
