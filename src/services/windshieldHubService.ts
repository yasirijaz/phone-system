import axios from '@/lib/axios';

export interface WindshieldHubLeadSummary {
  lead_id: string;
  created_at?: string | null;
  label?: string;
}

export interface WindshieldHubNote {
  id: number;
  notes?: string | null;
  added_by_name?: string | null;
  created_at?: string | null;
}

export interface WindshieldHubActivity {
  id: number;
  name?: string | null;
  activity?: string | null;
  created_at?: string | null;
}

export interface WindshieldHubMessage {
  id: number;
  Body?: string | null;
  From?: string | null;
  To?: string | null;
  direction?: string | null;
  admin_name?: string | null;
  media?: string | null;
  created_at?: string | null;
}

export interface WindshieldHubLead {
  lead_id: string;
  notes: WindshieldHubNote[];
  activities: WindshieldHubActivity[];
  messages: WindshieldHubMessage[];
}

export interface WindshieldHubLookup {
  enabled: boolean;
  phone?: string;
  leads: WindshieldHubLeadSummary[];
  lead: WindshieldHubLead | null;
  error?: string | null;
}

export const lookupWindshieldHubByCall = async (callLogId: number): Promise<WindshieldHubLookup> => {
  const response = await axios.post(`/api/call-logs/${callLogId}/windshieldhub/lookup`);
  return response.data;
};

export const lookupWindshieldHubByPhone = async (companyId: number, phone: string): Promise<WindshieldHubLookup> => {
  const response = await axios.post(`/api/companies/${companyId}/windshieldhub/lookup`, { phone });
  return response.data;
};

export const getWindshieldHubLead = async (companyId: number, leadId: string): Promise<WindshieldHubLead | null> => {
  const response = await axios.get(`/api/companies/${companyId}/windshieldhub/leads/${encodeURIComponent(leadId)}`);
  return response.data.lead ?? null;
};
