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
