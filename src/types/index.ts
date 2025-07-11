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
}

export interface Department {
  id: number;
  name: string;
  company_id: number;
  created_at?: string;
  updated_at?: string;
}
