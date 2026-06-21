import type { Contact, User } from '@/types';
import type { ConferenceParticipant } from '@/services/twilioService';
import { formatPhoneNumber } from '@/lib/utils';

export type ParticipantConnectionStatus = 'ringing' | 'connecting' | 'connected' | 'on-hold' | 'ended';

export interface PendingOutgoingParticipant {
  callSid: string;
  name: string;
  startedAt: number;
}

export function getParticipantConnectionStatus(participant: ConferenceParticipant): ParticipantConnectionStatus {
  if (participant.connection_status) {
    return participant.connection_status;
  }

  if (participant.hold) {
    return 'on-hold';
  }

  const status = String(participant.call_status || '').toLowerCase();
  if (status === 'ringing' || status === 'queued') {
    return 'ringing';
  }
  if (status === 'in-progress') {
    return 'connected';
  }
  if (['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(status)) {
    return 'ended';
  }

  return 'connecting';
}

export function getParticipantStatusLabel(status: ParticipantConnectionStatus): string {
  switch (status) {
    case 'ringing':
      return 'Ringing';
    case 'connecting':
      return 'Connecting';
    case 'connected':
      return 'Connected';
    case 'on-hold':
      return 'On hold';
    case 'ended':
      return 'Ended';
    default:
      return 'Unknown';
  }
}

export function resolveParticipantDisplayName(
  participant: ConferenceParticipant,
  companyUsers: User[] = [],
  companyContacts: Contact[] = []
): string {
  if (participant.user_id) {
    const user = companyUsers.find((entry) => entry.id === participant.user_id);
    if (user?.name) {
      return user.name;
    }
  }

  const label = participant.label?.trim();
  if (label) {
    const userByEmail = companyUsers.find((entry) => entry.email === label);
    if (userByEmail?.name) {
      return userByEmail.name;
    }

    const userByName = companyUsers.find((entry) => entry.name === label);
    if (userByName?.name) {
      return userByName.name;
    }

    if (!label.startsWith('client:') && !/^CA[a-f0-9]{32}$/i.test(label)) {
      return label;
    }
  }

  const phone = participant.phone;
  if (phone) {
    const contact = companyContacts.find((entry) => entry.phone_no === phone);
    if (contact?.name) {
      return contact.name;
    }
    return formatPhoneNumber(phone);
  }

  return 'Unknown caller';
}

export function isParticipantRinging(participant: ConferenceParticipant): boolean {
  return getParticipantConnectionStatus(participant) === 'ringing';
}

export function isParticipantActiveLeg(participant: ConferenceParticipant): boolean {
  const status = getParticipantConnectionStatus(participant);
  return status === 'connected' || status === 'ringing' || status === 'connecting';
}
