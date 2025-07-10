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
  name: string;
  email: string;
}
