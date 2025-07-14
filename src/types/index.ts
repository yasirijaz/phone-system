
export interface Call {
  id: string;
  contact: string;
  dateTime: string;
  duration: number; // in minutes
  type: 'incoming' | 'outgoing';
  notes?: string;
  category?: string;
}

export interface User {
  id: number;
  name:string;
  email: string;
  role_id?: number;
  company_id?: number;
  company?: Company;
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
  created_at?: string;
  updated_at?: string;
}

export interface CompanySettings {
  id: number;
  company_id: number;
  call_settings: {
    record_calls: boolean;
    greeting_message?: string;
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
  routing_preferences: {
    default_route: string;
    timeout: number;
  };
}

export type CompanySettingsPayload = Omit<CompanySettings, 'id'>;

export interface IvrOption {
  digit: string;
  action: string;
  destination: string;
}

export interface Holiday {
  name: string;
  date: string;
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
