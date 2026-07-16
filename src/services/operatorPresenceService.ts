import axios from '@/lib/axios';

export type OperatorPresenceEvent = 'online' | 'offline' | 'status_change';

export interface BroadcastOperatorPresencePayload {
  event: OperatorPresenceEvent;
  worker_status?: string;
  /** When true, backend also writes activity to Twilio REST (default false — SDK owns activity). */
  sync_twilio?: boolean;
}

export const broadcastOperatorPresence = async (
  payload: BroadcastOperatorPresencePayload
): Promise<void> => {
  await axios.post('/api/operators/presence', payload);
};

export const broadcastOperatorPresenceKeepalive = (
  payload: BroadcastOperatorPresencePayload
): void => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';

  fetch(`${baseUrl}/api/operators/presence`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
};
