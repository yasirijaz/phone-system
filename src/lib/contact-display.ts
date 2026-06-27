import type { Communication, Contact } from '@/types';
import { formatPhoneNumber, phonesMatch } from '@/lib/utils';

export type OtherPartyDisplay = {
  number: string;
  displayName: string;
  sublabel: string | null;
  hasContactName: boolean;
  initial: string;
};

function getInitials(name: string): string {
  if (!name) return '?';
  const nameParts = name.split(' ').filter(Boolean);
  if (nameParts.length > 1) {
    return `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase();
  }
  return name.charAt(0).toUpperCase();
}

/** Phone number of the external party on a communication row. */
export function getOtherPartyNumber(comm: Communication): string {
  return comm.direction === 'outbound' ? comm.to : comm.from;
}

/** contact_id returned by the call/thread detail API. */
export function getApiContactId(comm: Communication): number | null {
  const ext = comm as Communication & { contact_id?: number | string | null };
  const raw = ext.contact_id;
  if (raw == null || String(raw) === '') return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function getThreadApiContactId(
  logs: Communication[],
  otherPartyNumber: string
): number | null {
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    const log = logs[i];
    if (getOtherPartyNumber(log) !== otherPartyNumber) continue;
    const id = getApiContactId(log);
    if (id) return id;
  }
  return null;
}

/** contact_name returned by the call/thread detail API (saved contact indicator). */
export function getApiContactName(comm: Communication): string | null {
  return comm.contact_name?.trim() || null;
}

export function getThreadApiContactName(
  logs: Communication[],
  otherPartyNumber: string
): string | null {
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    const log = logs[i];
    if (getOtherPartyNumber(log) !== otherPartyNumber) continue;
    const name = getApiContactName(log);
    if (name) return name;
  }
  return null;
}

/** True when the thread detail API returned contact_name for this number. */
export function isThreadContactSavedFromApi(
  logs: Communication[],
  otherPartyNumber: string
): boolean {
  return Boolean(getThreadApiContactName(logs, otherPartyNumber));
}

/** Saved contact fields from thread detail API, merged with local contact when available. */
export function getThreadSavedContactFromApi(
  logs: Communication[],
  otherPartyNumber: string,
  localContact?: Contact | null
): Partial<Contact> | null {
  const apiName = getThreadApiContactName(logs, otherPartyNumber);
  if (!apiName) return null;

  for (let i = logs.length - 1; i >= 0; i -= 1) {
    const log = logs[i];
    if (getOtherPartyNumber(log) !== otherPartyNumber) continue;
    if (!getApiContactName(log)) continue;

    const contactId = getApiContactId(log);
    const isOutbound = log.direction === 'outbound';
    const nameRecord = isOutbound ? log.to_name : log.from_name;
    const recordId =
      contactId ||
      (typeof nameRecord?.id === 'number' && nameRecord.id > 0 ? nameRecord.id : null);

    if (recordId || (nameRecord && typeof nameRecord === 'object')) {
      return {
        ...nameRecord,
        id: recordId ?? nameRecord?.id,
        name: apiName,
        phone_no: otherPartyNumber,
      };
    }
  }

  if (localContact) {
    return {
      ...localContact,
      name: apiName,
      phone_no: otherPartyNumber,
    };
  }

  return {
    name: apiName,
    phone_no: otherPartyNumber,
  };
}

export function buildThreadContactState(
  logs: Communication[],
  otherPartyNumber: string,
  localContact?: Contact | null
): Partial<Contact> & {
  sublabel: string | null;
  hasContactName: boolean;
  apiContactName: string | null;
  isSavedFromApi: boolean;
} {
  const display = getThreadContactDisplay(logs, otherPartyNumber, localContact);
  const apiContactName = getThreadApiContactName(logs, otherPartyNumber);
  const apiContactId = getThreadApiContactId(logs, otherPartyNumber);
  const apiSavedContact = getThreadSavedContactFromApi(logs, otherPartyNumber, localContact);

  return {
    ...(localContact || {}),
    ...(apiSavedContact || {}),
    id: apiContactId ?? apiSavedContact?.id ?? localContact?.id,
    phone_no: otherPartyNumber,
    name: display.displayName,
    sublabel: display.sublabel,
    hasContactName: display.hasContactName,
    apiContactName,
    isSavedFromApi: Boolean(apiContactName),
  };
}

/** Resolve a human-readable name; contact_name from the API takes priority. */
export function resolveContactName(
  comm: Communication,
  localContact?: Pick<Contact, 'name'> | null
): string | null {
  const isOutbound = comm.direction === 'outbound';
  return (
    comm.contact_name?.trim() ||
    (isOutbound ? comm.to_name?.name : comm.from_name?.name)?.trim() ||
    comm.client_name?.trim() ||
    localContact?.name?.trim() ||
    null
  );
}

export function getOtherPartyDisplay(
  comm: Communication,
  localContact?: Pick<Contact, 'name'> | null
): OtherPartyDisplay {
  const number = getOtherPartyNumber(comm);
  const contactName = resolveContactName(comm, localContact);
  const formattedNumber = formatPhoneNumber(number);

  return {
    number,
    displayName: contactName || formattedNumber,
    sublabel: contactName ? formattedNumber : null,
    hasContactName: Boolean(contactName),
    initial: getInitials(contactName || number),
  };
}

/** Pick the best display info from a thread's communications (e.g. conversation header). */
export function getThreadContactDisplay(
  logs: Communication[],
  otherPartyNumber: string,
  localContact?: Pick<Contact, 'name'> | null
): OtherPartyDisplay {
  for (let i = logs.length - 1; i >= 0; i -= 1) {
    const log = logs[i];
    if (getOtherPartyNumber(log) !== otherPartyNumber) continue;
    const display = getOtherPartyDisplay(log, localContact);
    if (display.hasContactName) return display;
  }

  const fallbackComm: Communication = {
    id: 0,
    type: 'call',
    from: otherPartyNumber,
    to: otherPartyNumber,
    direction: 'inbound',
    created_at: new Date().toISOString(),
  };

  return getOtherPartyDisplay(fallbackComm, localContact);
}

export function findLocalContactByPhone(
  contacts: Pick<Contact, 'phone_no' | 'name'>[],
  phone: string
): Pick<Contact, 'name'> | null {
  if (!phone || contacts.length === 0) {
    return null;
  }

  return contacts.find((contact) => phonesMatch(contact.phone_no, phone)) ?? null;
}

/** Label for SMS notifications: "Name (+1 …)" when saved, otherwise formatted number only. */
export function formatSmsNotificationSenderLabel(
  from: string,
  options?: { contactName?: string | null; localContact?: Pick<Contact, 'name'> | null }
): string {
  const name =
    options?.contactName?.trim() ||
    options?.localContact?.name?.trim() ||
    null;
  const formattedNumber = formatPhoneNumber(from);

  if (name) {
    return `${name} (${formattedNumber})`;
  }

  return formattedNumber;
}
