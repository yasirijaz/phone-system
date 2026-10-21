import axios from '@/lib/axios';

export type AiCallOutcome =
  | 'booked'
  | 'transferred'
  | 'payment_pending'
  | 'slot_held'
  | 'quoted'
  | 'not_booked'
  | 'hang_up'
  | 'failed';

export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface AiCallListItem {
  id: number;
  conversation_id: string;
  agent_id: string | null;
  customer_number: string | null;
  routing_reason: string | null;
  outcome: AiCallOutcome | null;
  call_successful: boolean | null;
  success_score: number | null;
  sentiment_label: Sentiment | null;
  sentiment_score: number | null;
  frustration_score: number | null;
  title: string | null;
  message_count: number | null;
  started_at: string | null;
  duration_secs: number | null;
  /** USD */
  cost: number | null;
  summary: string | null;
  appointment_id: string | null;
  status: string | null;
  median_response_ms: number | null;
  initiation_source: string | null;
  main_language: string | null;
  /** % of evaluation criteria that passed (ElevenLabs "Evaluation" column). */
  evaluation_score: number | null;
}

export interface AiCallToolStep {
  name: string;
  params: unknown;
  result: unknown;
  ok: boolean | null;
  time: number | null;
  latency_ms?: number | null;
  error?: string | null;
}

export interface EvaluationResult {
  criteria_id?: string;
  result?: 'success' | 'failure' | 'unknown' | string;
  rationale?: string;
}

export interface DataCollectionResult {
  data_collection_id?: string;
  value?: unknown;
  rationale?: string;
  json_schema?: { type?: string; description?: string } | null;
}

export interface AiCallDetail extends Omit<AiCallListItem, 'evaluation_score'> {
  call_sid: string | null;
  agent_number: string | null;
  direction: string | null;
  termination_reason: string | null;
  has_audio: boolean;
  cost_credits: number | null;
  call_credits: number | null;
  llm_credits: number | null;
  llm_cost: number | null;
  call_result: string | null;
  environment: string | null;
  llm_model: string | null;
  llm_requests: number | null;
  p90_response_ms: number | null;
  avg_llm_ttfb_ms: number | null;
  avg_tts_ttfb_ms: number | null;
  avg_asr_ms: number | null;
  tool_call_count: number | null;
  tool_error_count: number | null;
  avg_tool_latency_ms: number | null;
  tts_seconds: number | null;
  asr_seconds: number | null;
  transcript: { role: 'user' | 'agent'; message: string; time: number | null }[] | null;
  tool_calls: AiCallToolStep[] | null;
  evaluation: Record<string, EvaluationResult> | null;
  data_collection: Record<string, DataCollectionResult> | null;
  workflow_nodes: Record<string, number> | null;
}

export interface TurnTool {
  request_id: string | null;
  name: string;
  params: unknown;
  result: unknown;
  ok: boolean | null;
  latency_ms: number | null;
  error: string | null;
  /** plain-English explanation when the call failed */
  reason?: string | null;
}

export interface ConversationTurn {
  role: 'user' | 'agent';
  message: string;
  time: number | null;
  node_id: string | null;
  interrupted: boolean;
  llm_model: string | null;
  metrics: {
    response_ms: number | null;
    llm_ttfb_ms: number | null;
    llm_ttf_sentence_ms: number | null;
    llm_last_sentence_ms: number | null;
    tts_ttfb_ms: number | null;
    asr_ms: number | null;
    silence_ms: number | null;
    tool_request_ms: number | null;
  };
  llm_cost: number | null;
  sentiment: number | null;
  frustration: number | null;
  tools: TurnTool[];
}

export interface WorkflowGraph {
  name: string | null;
  nodes: { id: string; type: string; label: string; x: number | null; y: number | null }[];
  edges: { id: string; source: string; target: string; label: string | null }[];
}

export interface AiHandoff {
  id: number;
  customer_name: string | null;
  vehicle: string | null;
  glass: string | null;
  reason: string | null;
  summary: string | null;
  status: string;
  created_at: string;
}

export interface AiCallShowResponse {
  call: AiCallDetail;
  handoffs: AiHandoff[];
  turns: ConversationTurn[];
  evaluation_score: number | null;
  workflow: WorkflowGraph;
  client_data: {
    overrides: Record<string, unknown> | null;
    dynamic_variables: Record<string, unknown> | null;
    user_id: string | null;
  };
  details: {
    agent_name: string | null;
    branch_id: string | null;
    version_id: string | null;
    environment: string | null;
    channel: string | null;
    stream_sid: string | null;
    timezone: string | null;
    tts_model: string | null;
    tts_characters: number | null;
    asr_model: string | null;
    tier: string | null;
    platform_cost: number | null;
    procedures_used: boolean;
    features_used: string[];
    feedback: { rating?: number | null; comment?: string | null; likes?: number; dislikes?: number } | null;
    warnings: unknown[];
    error: unknown;
    sentiment: {
      overall_label?: string;
      overall_sentiment_score?: number;
      overall_frustration_score?: number;
      min_user_sentiment_score?: number;
      max_user_frustration_score?: number;
      num_scored_user_turns?: number;
    } | null;
  };
}

export interface AiCallListResponse {
  calls: AiCallListItem[];
  summary: {
    total: number;
    by_outcome: Partial<Record<AiCallOutcome, number>>;
    booking_rate: number;
    minutes: number;
    cost: number;
  };
}

/* ------------------------------------------------------------------ dashboard */

export type Granularity = 'auto' | 'hour' | 'day' | 'week';

export interface DashboardKpis {
  conversations: number;
  total_duration_secs: number;
  avg_duration_secs: number;
  total_cost: number;
  avg_cost: number;
  cost_per_minute: number;
  total_llm_cost: number;
  avg_llm_cost: number;
  total_credits: number;
  avg_credits: number;
  success_count: number;
  failure_count: number;
  success_rate: number | null;
  avg_success_score: number | null;
  median_response_ms: number | null;
  p90_response_ms: number | null;
  avg_llm_ttfb_ms: number | null;
  avg_tts_ttfb_ms: number | null;
  avg_asr_ms: number | null;
  avg_sentiment: number | null;
  avg_frustration: number | null;
  negative_rate: number | null;
  booked: number;
  transferred: number;
  booking_rate: number;
  transfer_rate: number;
  hang_up_rate: number;
  tool_calls: number;
  tool_errors: number;
  tool_error_rate: number | null;
  avg_tool_latency_ms: number | null;
  llm_requests: number;
  messages: number;
  tts_minutes: number;
  asr_minutes: number;
}

export interface DashboardBucket {
  t: string;
  label: string;
  conversations: number;
  duration_secs: number;
  avg_duration_secs: number | null;
  cost: number;
  llm_cost: number;
  credits: number;
  success: number;
  failure: number;
  success_rate: number | null;
  failure_rate: number | null;
  response_ms: number | null;
  llm_ttfb_ms: number | null;
  tts_ttfb_ms: number | null;
  asr_ms: number | null;
  llm_requests: number;
  tool_calls: number;
  tool_errors: number;
  tool_error_rate: number | null;
  tool_latency_ms: number | null;
  sentiment: number | null;
  frustration: number | null;
  tts_seconds: number;
  asr_seconds: number;
  booked: number;
  transferred: number;
  quoted: number;
  hang_up: number;
  other: number;
  positive: number;
  neutral: number;
  negative: number;
}

export type SeriesRow = { t: string; label: string } & Record<string, number | string | null>;

export interface SpotlightItem {
  id: number;
  title: string | null;
  started_at: string | null;
  duration_secs: number | null;
  outcome: AiCallOutcome | null;
  sentiment_label: Sentiment | null;
  success_score: number | null;
  frustration_score: number | null;
  median_response_ms: number | null;
  p90_response_ms: number | null;
  tool_error_count: number | null;
}

export interface ToolFailure {
  tool: string;
  error: string | null;
  reason: string;
  count: number;
  affected_calls: number;
  last_seen: string | null;
  example: { call_id: number; call_title: string | null; time_in_call: number | null; request: unknown; response: unknown };
}

export interface TopicRow {
  label: string;
  non_engaged: boolean;
  conversations: number;
  sentiment: number | null;
  success_rate: number | null;
  booked: number;
  example_title: string | null;
}

export interface AiCallDashboard {
  range: { from: string; to: string; tz: string; granularity: Exclude<Granularity, 'auto'>; truncated: boolean };
  agents: { id: string; name: string | null }[];
  kpis: DashboardKpis;
  previous: DashboardKpis;
  series: DashboardBucket[];
  outcomes: Record<string, number>;
  sentiment: Record<Sentiment | 'unknown', number>;
  evaluation: {
    criteria: { id: string; success: number; failure: number; unknown: number; rate: number | null }[];
    series: SeriesRow[];
  };
  data_collection: {
    id: string;
    collected: number;
    total: number;
    rate: number | null;
    top_values: { value: string; count: number }[];
  }[];
  tools: {
    list: { name: string; calls: number; errors: number; error_rate: number; avg_latency_ms: number | null }[];
    failures: ToolFailure[];
    names: string[];
    series: { calls: SeriesRow[]; errors: SeriesRow[]; latency: SeriesRow[]; error_rate: SeriesRow[] };
  };
  llm: { models: Record<string, number> };
  workflow: WorkflowGraph & {
    agent_id: string | null;
    visits: Record<string, { conversations: number; turns: number }>;
  };
  breakdowns: {
    termination: { label: string; count: number }[];
    language: { label: string; count: number }[];
    source: { label: string; count: number }[];
    routing_reason: { label: string; count: number }[];
    hour_of_day: { hour: number; count: number }[];
    weekday: { day: string; count: number }[];
  };
  topics: { service: TopicRow[]; vehicle: TopicRow[] };
  alerts: { severity: 'high' | 'medium'; title: string; body: string; tab: string }[];
  spotlight: {
    most_frustrated: SpotlightItem[];
    lowest_score: SpotlightItem[];
    slowest: SpotlightItem[];
    tool_errors: SpotlightItem[];
  };
}

const browserTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

export const getAiCalls = async (params: {
  from?: string;
  to?: string;
  outcome?: string;
  search?: string;
  agent_id?: string;
  sentiment?: string;
  success?: string;
}): Promise<AiCallListResponse> => {
  const response = await axios.get('/api/ai-calls', { params: { ...params, tz: browserTz() } });
  return response.data;
};

export const getAiCallDashboard = async (params: {
  from: string;
  to: string;
  granularity?: Granularity;
  agent_id?: string;
}): Promise<AiCallDashboard> => {
  const response = await axios.get('/api/ai-calls/dashboard', { params: { ...params, tz: browserTz() } });
  return response.data;
};

export const getAiCall = async (id: number): Promise<AiCallShowResponse> => {
  const response = await axios.get(`/api/ai-calls/${id}`);
  return response.data;
};

export const refreshAiCall = async (id: number): Promise<AiCallDetail> => {
  const response = await axios.post(`/api/ai-calls/${id}/refresh`);
  return response.data.call;
};

/** Recording is streamed through the backend (auth required), so fetch it as a blob URL. */
export const getAiCallRecordingUrl = async (id: number): Promise<string> => {
  const response = await axios.get(`/api/ai-calls/${id}/recording`, { responseType: 'blob' });
  return URL.createObjectURL(response.data);
};
