import type { Communication } from '@/types';
import { getMessagePreviewText } from '@/lib/message-media';
import { isMissedCall, isVoicemailCall } from '@/lib/call-attendee';

export type ActivityTone = 'incoming' | 'outgoing' | 'missed' | 'sms' | 'voicemail' | 'neutral';

const FAILED_OUTBOUND = new Set([
  'missed',
  'no-answer',
  'no_answer',
  'busy',
  'canceled',
  'cancelled',
  'failed',
  'failure',
  'rejected',
  'declined',
]);

function durationSeconds(comm: Communication): number {
  const raw = comm.duration || comm.call_duration || '0';
  const parsed = parseInt(String(raw), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDurationLabel(seconds: number): string {
  if (seconds <= 0) return '';
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (secs === 0) return `${mins} min`;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }
  return `0:${String(seconds).padStart(2, '0')}`;
}

export function isFailedDelivery(comm: Communication): boolean {
  const status = String(comm.status || '').toLowerCase();
  return comm.type === 'sms' && (status === 'failed' || status === 'undelivered');
}

export function getActivityPresentation(comm: Communication): {
  tone: ActivityTone;
  label: string;
  icon: 'phone' | 'message' | 'voicemail';
} {
  const isSms = comm.type === 'sms' || comm.latest_type === 'sms';
  if (isSms) {
    const preview = getMessagePreviewText(comm);
    const direction = comm.direction === 'inbound' ? 'Incoming SMS' : 'Outgoing SMS';
    const failed = isFailedDelivery(comm);
    return {
      tone: failed ? 'missed' : 'sms',
      icon: 'message',
      label: preview ? `${direction} · “${preview}”` : failed ? `${direction} · Failed` : direction,
    };
  }

  if (isVoicemailCall(comm)) {
    const length = formatDurationLabel(durationSeconds(comm));
    return {
      tone: 'voicemail',
      icon: 'voicemail',
      label: length ? `Voicemail · ${length}` : 'Voicemail',
    };
  }

  if (isMissedCall(comm) || (comm.direction === 'inbound' && FAILED_OUTBOUND.has(String(comm.call_status || '').toLowerCase()))) {
    return { tone: 'missed', icon: 'phone', label: 'Missed call' };
  }

  const status = String(comm.call_status || '').toLowerCase();
  const seconds = durationSeconds(comm);
  const length = formatDurationLabel(seconds);

  if (comm.direction === 'outbound') {
    const connected = status === 'completed' || status === 'in_progress' || seconds > 0;
    const unanswered = FAILED_OUTBOUND.has(status) || (!connected && status !== 'in_progress');
    if (unanswered && seconds === 0) {
      return { tone: 'missed', icon: 'phone', label: 'Outgoing call · No answer' };
    }
    return {
      tone: 'outgoing',
      icon: 'phone',
      label: length ? `Outgoing call · Connected · ${length}` : 'Outgoing call · Connected',
    };
  }

  const answered = status === 'completed' || status === 'in_progress' || seconds > 0;
  if (!answered) {
    return { tone: 'missed', icon: 'phone', label: 'Missed call' };
  }

  return {
    tone: 'incoming',
    icon: 'phone',
    label: length ? `Incoming call · Answered · ${length}` : 'Incoming call · Answered',
  };
}

export function activityToneClass(tone: ActivityTone): string {
  switch (tone) {
    case 'incoming':
      return 'bg-blue-50 text-[#1D4ED8]';
    case 'outgoing':
      return 'bg-teal-50 text-[#0F766E]';
    case 'missed':
      return 'bg-red-50 text-[#B91C1C]';
    case 'sms':
      return 'bg-slate-100 text-[#475569]';
    case 'voicemail':
      return 'bg-amber-50 text-[#92400E]';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function sidebarPreview(comm: Communication): string {
  const presentation = getActivityPresentation(comm);
  if (comm.type === 'sms' || comm.latest_type === 'sms') {
    return getMessagePreviewText(comm) || presentation.label;
  }
  if (presentation.label.startsWith('Missed')) return 'Missed call';
  if (presentation.tone === 'voicemail') return 'Voicemail';
  return presentation.label.split(' · ')[0];
}

export type FollowUpInfo = {
  status: 'needs_follow_up' | 'in_progress' | 'completed';
  claimed_by?: string | null;
  claimed_at?: string | null;
  completed_by?: string | null;
  completed_at?: string | null;
  note?: string | null;
};

export function followUpLabel(status?: string | null): string | null {
  if (status === 'needs_follow_up') return 'Needs Follow-up';
  if (status === 'in_progress') return 'In Progress';
  if (status === 'completed') return 'Completed';
  return null;
}
