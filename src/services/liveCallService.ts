import axios from '@/lib/axios';

export type LiveTranscriptSegment = {
  role: string;
  text: string;
  at?: string;
  partial?: boolean;
  track?: string;
};

export type LiveJourneyStep = {
  stage: string;
  status: 'done' | 'active' | 'pending' | string;
  duration_label?: string | null;
};

export type LiveMoment = {
  label: string;
  type?: string;
  after_index: number;
  at?: string;
};

export type AnalysisWidgetField = {
  key: string;
  label: string;
  type: 'stars' | 'percent' | 'badge' | 'text' | string;
  value: string | number;
};

export type LiveCallAnalysis = {
  profile?: string;
  agenda?: string;
  purpose?: string;
  topic?: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | string;
  sentiment_score?: number;
  sentiment_rationale?: string;
  buying_intent?: number;
  stage?: string;
  objection?: string;
  risk_level?: 'low' | 'medium' | 'high' | string;
  booking_probability?: number;
  key_points?: string[];
  insight_alert?: string | null;
  moments?: LiveMoment[];
  next_best_action?: {
    title?: string;
    reason?: string;
    success_chance?: number;
  };
  suggested_scripts?: string[];
  journey?: LiveJourneyStep[];
  widget_fields?: AnalysisWidgetField[];
  updated_at?: string;
  is_final?: boolean;
};

export type LiveCall = {
  id: number;
  call_sid: string | null;
  customer_sid?: string | null;
  conference_sid: string | null;
  from: string | null;
  to: string | null;
  direction: string | null;
  call_status: string | null;
  company_id?: number | null;
  department_id?: number | null;
  department?: { id: number; name: string } | null;
  user_id?: number | null;
  user?: { id: number; name: string; profile_picture?: string | null } | null;
  transcript: LiveTranscriptSegment[];
  live_analysis?: LiveCallAnalysis | null;
  transcription_sid?: string | null;
  live_transcription_started_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  event?: string;
  timestamp?: string;
};

export type LiveCallsSummary = {
  live_calls: number;
  live_calls_delta: number;
  conversion_today: number;
  conversion_delta: number;
  avg_sentiment: number;
  critical_calls: number;
  bookings_today: number;
  bookings_delta: number;
  objections: { label: string; count: number }[];
  queue_by_stage: Record<string, number>;
  top_agents: {
    id: number;
    name: string;
    profile_picture?: string | null;
    calls_count: number;
    booking_rate: number;
  }[];
  alerts: {
    type: string;
    message: string;
    action: string;
    call_id?: number;
  }[];
};

export type LiveCallsResponse = {
  live_calls: LiveCall[];
  summary: LiveCallsSummary;
};

export async function getLiveCalls(): Promise<LiveCallsResponse> {
  const response = await axios.get('/api/live-calls');
  return {
    live_calls: response.data.live_calls ?? [],
    summary: response.data.summary ?? {
      live_calls: 0,
      live_calls_delta: 0,
      conversion_today: 0,
      conversion_delta: 0,
      avg_sentiment: 0,
      critical_calls: 0,
      bookings_today: 0,
      bookings_delta: 0,
      objections: [],
      queue_by_stage: {},
      top_agents: [],
      alerts: [],
    },
  };
}

export async function getLiveCall(id: number): Promise<LiveCall> {
  const response = await axios.get(`/api/live-calls/${id}`);
  return response.data.live_call;
}

/** Tell the backend this admin/supervisor has the Live Calls dashboard open. */
export async function pingLiveDashboardWatching(): Promise<void> {
  await axios.post('/api/live-calls/watching');
}

/** Clear watching flag when leaving the Live Calls dashboard. */
export function leaveLiveDashboardWatching(): void {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';

  fetch(`${baseUrl}/api/live-calls/leave`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: '{}',
    keepalive: true,
  }).catch(() => {});
}
