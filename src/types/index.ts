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
}

export interface Department {
  id: number;
  name: string;
  company_id: number;
  created_at?: string;
  updated_at?: string;
}
