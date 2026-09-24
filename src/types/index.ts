

export interface Communication {
  id: number;
  type: 'call' | 'sms';
  body?: string; // For MMS / text messages
  department_id?: number;
  company_id?: number;
  client_name?: string | null;
  contact_name?: string | null;
  contact_id?: number | null;
  user_id?: number | null;
  call_sid?: string;
  customer_sid?: string;
  conference_sid?: string;
  account_sid?: string;
  to: string;
  from: string;
  call_status?: string;
  direction: 'inbound' | 'outbound';
  task_sid?: string;
  worker_sid?: string;
  duration?: string;
  call_duration?: string;
  meta_data?: any;
  media_urls?: string[];
  is_read?: boolean | number | null;
  is_starred?: boolean;
  recording_url?: string | null;
  voice_mail?: string | null;
  created_at: string;
  updated_at?: string;
  to_name?: Partial<Contact> | null;
  from_name?: Partial<Contact> | null;
  department?: Department;
  user?: User | null;
  user_name?: string;
  notes?: string;
  category?: string;
  transcribe_text?: string;
  task_assignments?: {
    worker_sid: string;
    assignment_status: string;
    worker_name?: string;
    user?: Partial<User>;
  }[];
  latest_type?: 'call' | 'sms';
  department_name?: string | null;
  follow_up?: {
    status: 'needs_follow_up' | 'in_progress' | 'completed';
    claimed_by?: string | null;
    claimed_at?: string | null;
    completed_by?: string | null;
    completed_at?: string | null;
    note?: string | null;
  } | null;
  latest_created_at?: string;
  sms_count?: number;
  call_count?: number;
  status?: string; // for SMS
}

export interface Call {
  id: string | number;
  contact?: string;
  from?: string;
  to?: string;
  created_at?: string;
  duration?: number | string;
  direction: 'inbound' | 'outbound';
  notes?: string;
  category?: string;
}

export interface PaginatedCommunicationsResponse {
    TotalRecords: number;
    TotalPages: number;
    recordsFiltered: number;
    page_no: number;
    success: boolean;
    results: Communication[];
}


export interface User {
  id: number;
  name:string;
  email: string;
  profile_picture?: string;
  role_id?: number;
  company_id?: number;
  company?: Company;
  is_dnd?: boolean;
  do_not_disturb?: number;
  in_call?: number;
  worker_status?: string;
  slack_user_id?: string | null;
  has_slack_access_token?: boolean;
  slack_connected?: boolean;
}

export interface ProfilePayload {
  name?: string;
  email?: string;
  password?: string;
  password_confirmation?: string;
  profile_picture?: File;
  slack_user_id?: string;
  slack_access_token?: string;
}

export interface Company {
    id: number;
    name: string;
    subdomain: string;
    email?: string;
    owner_id?: number;
    workspace_sid?: string | null;
    status?: string;
    created_at?: string;
    updated_at?: string;
    owner?: User;
    users?: User[];
    departments?: Department[];
}

export interface Department {
  id: number;
  name: string;
  company_id: number;
  workflow_sid?: string;
  created_at?: string;
  updated_at?: string;
  unread_count: number;
}

export interface OperatorDepartment {
  id: number;
  name: string;
  role_id?: number;
  is_dnd?: boolean | number;
}

export interface Operator {
  id: number;
  name: string;
  email: string;
  role_id?: number;
  do_not_disturb?: number;
  in_call?: number;
  worker_status?: string;
  departments?: OperatorDepartment[];
}

export interface PhoneNumber {
  id: number;
  company_id?: number;
  department_id?: number | null;
  phone_no: string;
  type: string;
  label: string;
  is_default?: boolean;
  department?: Pick<Department, 'id' | 'name' | 'company_id'>;
}

export interface Holiday {
  name: string;
  date: string;
}

export interface Integration {
    id: number;
    integration_name: string;
}

export interface CompanySettings {
  id: number;
  company_id: number;
  call_settings: {
    record_calls: boolean;
    greeting_message?: string;
    hold_music_url?: string;
  };
  voicemail_settings: {
    enabled: boolean;
    greeting?: string;
    send_transcription: boolean;
  };
  business_hours: {
    is_24_7: boolean;
    days: {
      day: string;
      enabled: boolean;
      open: string;
      close: string;
    }[];
  };
  holiday_schedule: {
    holidays: Holiday[];
  };
  routing_preferences: {
    default_route: string;
    timeout: number;
  };
  slack_settings?: {
    has_bot_token?: boolean;
    bot_token?: string;
    client_id?: string;
    has_client_secret?: boolean;
    client_secret?: string;
    oauth_configured?: boolean;
  };
  integrations?: {
    integration_id: number;
    enabled: boolean;
    api_key?: string;
  }[];
}

export type CompanySettingsPayload = Omit<CompanySettings, 'id'>;

export interface IvrOption {
  digit: string;
  action: string;
  destination: string;
}

export interface DepartmentSettings {
    id: number;
    department_id: number;
    timezone: string;
    call_settings: {
        greeting_message: string;
        hold_music_url?: string;
    };
    business_hours: {
        is_24_7: boolean;
        days: {
            day: string;
            enabled: boolean;
            open: string;
            close: string;
        }[];
    };
    ivr_menu: {
        enabled: boolean;
        greeting: string;
        options: IvrOption[];
    };
    break_handling: {
        enabled: boolean;
        max_break_duration: number;
    };
    holiday_schedule: {
        holidays: Holiday[];
    };
    slack_settings?: {
        notify_missed_calls?: boolean;
        sync_in_call_status?: boolean;
        channel_id?: string;
        channel_name?: string;
    };
}

export type DepartmentSettingsPayload = Omit<DepartmentSettings, 'id'>;


export interface PaginatedResponse<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  from: number;
  last_page: number;
  last_page_url: string;
  links: {
    url: string | null;
    label: string;
    active: boolean;
  }[];
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number;
  total: number;
}

export interface Assignment {
    id: number;
    user_id: number;
    department_id: number;
    user_name: string;
    department_name: string;
    role_id?: number;
}

export interface Package {
  id: number;
  title: string;
  description: string;
  price: number;
  stripe_price_id: string;
  stripe_product_id: string;
  status: 0 | 1;
}

export interface Contact {
  id: number;
  company_id: number;
  name: string;
  email: string | null;
  phone_no: string;
  phone_type: string;
  status?: 'active' | 'blocked';
  is_block?: boolean | number | null;
}

export interface MediaFile {
    id: number;
    title: string | null;
    company_id: number;
    user_id: number;
    file_name: string;
    file_url: string;
    file_path: string;
    file_size: number;
    file_type: string;
    created_at: string;
    updated_at: string;
}

export type DashboardTimeRange = '24h' | '7d' | '30d' | '12m';

export interface DashboardSeriesPoint {
  bucket: string;
  label: string;
  calls: number;
  duration_seconds: number;
}

export interface DashboardNamedCount {
  name: string;
  value: number;
  key: string;
}

export interface DashboardTopContact {
  phone: string | null;
  name: string | null;
  label: string;
  calls: number;
  duration_seconds: number;
}

export interface DashboardTopAgent {
  user_id: number;
  name: string;
  email?: string | null;
  calls: number;
  duration_seconds: number;
}

export interface DashboardTopDepartment {
  department_id: number;
  name: string;
  calls: number;
  duration_seconds: number;
}

export interface DashboardSummary {
  total_calls: number;
  completed: number;
  missed: number;
  rejected: number;
  in_progress: number;
  total_duration_seconds: number;
  avg_duration_seconds: number;
  answer_rate: number;
  inbound: number;
  outbound: number;
  sms_count: number;
  voicemail_count: number;
  recording_count: number;
  active_agents: number;
}

export interface DashboardPreviousSummary {
  total_calls: number;
  completed: number;
  missed: number;
  rejected: number;
  in_progress: number;
  total_duration_seconds: number;
  avg_duration_seconds: number;
  answer_rate: number;
  inbound: number;
  outbound: number;
  sms_count: number;
}

export interface DashboardTrends {
  total_calls: number | null;
  total_duration: number | null;
  avg_duration: number | null;
  answer_rate: number | null;
  missed: number | null;
  sms_count: number | null;
}

export interface DashboardStats {
  range: DashboardTimeRange;
  period: {
    start: string;
    end: string;
    previous_start: string;
    previous_end: string;
  };
  summary: DashboardSummary;
  previous_summary: DashboardPreviousSummary;
  trends: DashboardTrends;
  series: DashboardSeriesPoint[];
  status_breakdown: DashboardNamedCount[];
  direction_breakdown: DashboardNamedCount[];
  top_contacts: DashboardTopContact[];
  top_agents: DashboardTopAgent[];
  top_departments: DashboardTopDepartment[];
  active_agents: Array<{
    id: number;
    name: string;
    email?: string | null;
    profile_picture?: string | null;
    in_call?: number;
  }>;
}
