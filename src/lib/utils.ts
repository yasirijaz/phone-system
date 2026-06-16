
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

type PhoneNumberLike = {
  phone_no: string;
  label?: string | null;
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
  if (label) return `${label} · ${formatted}`;
  return formatted;
}
