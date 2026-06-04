

export interface Communication {
  id: number;
  type: 'call' | 'sms';
  body?: string; // For SMS
  department_id?: number;
  company_id?: number;
  client_name?: string | null;
  user_id?: number | null;
  call_sid?: string;
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
  latest_created_at?: string;
  sms_count?: number;
  call_count?: number;
  status?: string; // for SMS
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
}

export interface ProfilePayload {
  name?: string;
  email?: string;
  password?: string;
  password_confirmation?: string;
  profile_picture?: File;
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

export interface PhoneNumber {
  id: number;
  department_id: number;
  phone_no: string;
  type: string;
  label: string;
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
  integrations?: {
    integration_id: number;
    enabled: boolean;
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
        hold_music_url: string;
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
