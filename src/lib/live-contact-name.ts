import { findContactByPhone } from '@/services/contactService';
import { isClientIdentity, isPlaceholderCallerName } from '@/lib/call-party-display';
import { normalizePhoneDigits } from '@/lib/utils';

const resolvedNameCache = new Map<string, string | null>();

/** True when a label is empty, a Twilio identity, or just a phone number. */
export function isPhoneLikeDisplayName(value: string | null | undefined): boolean {
  const trimmed = String(value ?? '').trim();
  if (!trimmed || isPlaceholderCallerName(trimmed) || isClientIdentity(trimmed)) {
    return true;
  }

  if (/[a-zA-Z]/.test(trimmed)) {
    return false;
  }

  const digits = normalizePhoneDigits(trimmed);
  return digits.length >= 10;
}

export async function resolveSavedContactName(
  companyId: number | null | undefined,
  phone: string | null | undefined,
  currentName?: string | null
): Promise<string | null> {
  const trimmed = currentName?.trim() || null;
  if (trimmed && !isPhoneLikeDisplayName(trimmed)) {
    return trimmed;
  }

  if (!companyId || !phone) {
    return trimmed;
  }

  const cacheKey = `${companyId}:${normalizePhoneDigits(phone) || phone}`;
  if (resolvedNameCache.has(cacheKey)) {
    return resolvedNameCache.get(cacheKey) || trimmed;
  }

  try {
    const contact = await findContactByPhone(companyId, phone);
    const name = contact?.name?.trim() || null;
    resolvedNameCache.set(cacheKey, name);
    return name || trimmed;
  } catch {
    return trimmed;
  }
}
