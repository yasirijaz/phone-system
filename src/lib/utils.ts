
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

const CONTACT_AVATAR_COLORS = [
  'bg-pink-200 text-pink-900',
  'bg-sky-200 text-sky-900',
  'bg-violet-200 text-violet-900',
  'bg-amber-200 text-amber-900',
  'bg-emerald-200 text-emerald-900',
  'bg-rose-200 text-rose-900',
];

export function getContactAvatarColorClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CONTACT_AVATAR_COLORS[Math.abs(hash) % CONTACT_AVATAR_COLORS.length];
}

export function formatPhoneNumber(phoneNumberString: string | undefined | null): string {
  if (!phoneNumberString) return '';
  const cleaned = ('' + phoneNumberString).replace(/\D/g, '');
  const match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    const a = match[2];
    const b = match[3];
    const c = match[4];
    return `(${a}) ${b}-${c}`;
  }
  return phoneNumberString;
}

/** Strip phone numbers to comparable digits (10-digit US when possible). */
export function normalizePhoneDigits(phone: string | undefined | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

export function phonesMatch(
  a: string | undefined | null,
  b: string | undefined | null
): boolean {
  const left = normalizePhoneDigits(a);
  const right = normalizePhoneDigits(b);
  if (!left || !right) return false;
  return left === right;
}

/** True when two from/to pairs refer to the same SMS/call thread (either direction). */
export function isSameConversationThread(
  threadFrom: string,
  threadTo: string,
  payloadFrom: string,
  payloadTo: string
): boolean {
  return (
    (phonesMatch(threadFrom, payloadFrom) && phonesMatch(threadTo, payloadTo)) ||
    (phonesMatch(threadFrom, payloadTo) && phonesMatch(threadTo, payloadFrom))
  );
}

type PhoneNumberLike = {
  phone_no: string;
  label?: string | null;
  is_default?: boolean;
};

/** Primary display name for a saved company number (label, else formatted number). */
export function getPhoneNumberDisplayName(num: PhoneNumberLike): string {
  const label = num.label?.trim();
  if (label) return label;
  return formatPhoneNumber(num.phone_no);
}

/** Dropdown label: show saved name with number, or just the number. */
export function getPhoneNumberOptionLabel(num: PhoneNumberLike): string {
  const formatted = formatPhoneNumber(num.phone_no);
  const label = num.label?.trim();
  const defaultSuffix = num.is_default ? ' (Default)' : '';
  if (label) return `${label} · ${formatted}${defaultSuffix}`;
  return `${formatted}${defaultSuffix}`;
}

/** Format a scheduled SMS time in the viewer's local timezone. */
export function formatScheduledAt(value: string): string {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const hasTimezone = /Z$/i.test(normalized) || /[+-]\d{2}:\d{2}$/.test(normalized);
  const date = new Date(hasTimezone ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function parseScheduledAt(value: string): Date | null {
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const hasTimezone = /Z$/i.test(normalized) || /[+-]\d{2}:\d{2}$/.test(normalized);
  const date = new Date(hasTimezone ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Human remaining time until a scheduled send, e.g. "in 12m" or "due now". */
export function formatScheduleRemaining(value: string, nowMs = Date.now()): string {
  const date = parseScheduledAt(value);
  if (!date) return '';
  const diffMs = date.getTime() - nowMs;
  if (diffMs <= 0) return 'due now';
  const totalSeconds = Math.ceil(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  if (minutes > 0) return `in ${minutes}m ${seconds}s`;
  return `in ${seconds}s`;
}
