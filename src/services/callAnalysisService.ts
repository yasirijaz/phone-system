import axios from '@/lib/axios';
import type { LiveCall, LiveCallAnalysis, LiveTranscriptSegment } from '@/services/liveCallService';

export type CallAnalysisFilter = 'all' | 'pending' | 'ready' | 'critical';

export type CallAnalysisListItem = {
  id: number;
  call_sid: string | null;
  from: string | null;
  to: string | null;
  direction: string | null;
  call_status: string | null;
  company_id?: number | null;
  department?: { id: number; name: string } | null;
  user?: { id: number; name: string; profile_picture?: string | null } | null;
  duration_seconds: number;
  has_transcript: boolean;
  eligible_for_analysis?: boolean;
  has_analysis: boolean;
  is_critical: boolean;
  analysis_preview?: {
    agenda?: string | null;
    sentiment?: string | null;
    risk_level?: string | null;
    buying_intent?: number | null;
    stage?: string | null;
    is_final?: boolean;
  } | null;
  created_at?: string | null;
};

export type CallAnalysisDetail = LiveCall & {
  has_analysis?: boolean;
  eligible_for_analysis?: boolean;
  min_analysis_duration_seconds?: number;
  duration_seconds?: number;
  live_analysis?: LiveCallAnalysis | null;
  transcript: LiveTranscriptSegment[];
};

export type CallAnalysisListResponse = {
  from: string;
  to: string;
  filter: CallAnalysisFilter;
  summary: {
    total: number;
    pending: number;
    ready: number;
    critical: number;
  };
  calls: CallAnalysisListItem[];
};

export type CallAnalysisRunResponse = {
  cached: boolean;
  source: string;
  call: CallAnalysisDetail;
};

export async function getCallAnalysisList(params: {
  from: string;
  to: string;
  filter?: CallAnalysisFilter;
  search?: string;
}): Promise<CallAnalysisListResponse> {
  const response = await axios.get('/api/call-analysis', { params });
  return {
    from: response.data.from,
    to: response.data.to,
    filter: response.data.filter ?? 'all',
    summary: response.data.summary ?? { total: 0, pending: 0, ready: 0, critical: 0 },
    calls: response.data.calls ?? [],
  };
}

export async function getCallAnalysisDetail(id: number): Promise<CallAnalysisDetail> {
  const response = await axios.get(`/api/call-analysis/${id}`);
  return response.data.call;
}

export async function runCallAnalysis(
  id: number,
  force = false
): Promise<CallAnalysisRunResponse> {
  const response = await axios.post(`/api/call-analysis/${id}/analyze`, { force });
  return {
    cached: Boolean(response.data.cached),
    source: response.data.source ?? 'stored',
    call: response.data.call,
  };
}
