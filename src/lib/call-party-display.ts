import type { Call } from '@twilio/voice-sdk';
import { formatPhoneNumber } from '@/lib/utils';

const PLACEHOLDER_NAMES = new Set([
  '',
  'unknown caller',
  'unknown',
  'on call',
  'incoming call',
]);

export function isClientIdentity(value: string | null | undefined): boolean {
  return Boolean(value && String(value).toLowerCase().startsWith('client:'));
}

export function isPlaceholderCallerName(value: string | null | undefined): boolean {
  if (value == null) return true;
  return PLACEHOLDER_NAMES.has(String(value).trim().toLowerCase());
}

/** Prefer a real phone number over Twilio client identities. */
export function pickDisplayablePhoneNumber(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const value = String(candidate ?? '').trim();
    if (!value || isClientIdentity(value)) continue;
    return value;
  }
  return '';
}

function readCustomParam(call: Call | null | undefined, key: string): string {
  try {
    return String(call?.customParameters?.get?.(key) ?? '').trim();
  } catch {
    return '';
  }
}

/**
 * Best-effort remote party number from a Twilio Voice Call.
 * Outbound Device.connect params land in customParameters (`To`), while
 * parameters.From is usually the agent client identity.
 */
export function getRemotePartyNumberFromCall(call: Call | null | undefined): string {
  if (!call) return '';

  return pickDisplayablePhoneNumber(
    readCustomParam(call, 'To'),
    readCustomParam(call, 'to'),
    call.parameters?.To,
    call.parameters?.From,
    readCustomParam(call, 'From'),
    readCustomParam(call, 'from')
  );
}

export function getRemotePartyNameFromCall(call: Call | null | undefined): string {
  if (!call) return '';

  const friendly = String(call.parameters?.FriendlyName ?? '').trim();
  if (friendly && !isPlaceholderCallerName(friendly) && !isClientIdentity(friendly)) {
    return friendly;
  }

  return getRemotePartyNumberFromCall(call);
}

/** Title shown in the active-call bar / Electron pill. */
export function resolveActiveCallDisplayName(
  name: string | null | undefined,
  number: string | null | undefined
): string {
  const trimmedName = String(name ?? '').trim();
  const displayNumber = pickDisplayablePhoneNumber(number);

  if (!isPlaceholderCallerName(trimmedName) && !isClientIdentity(trimmedName)) {
    return trimmedName;
  }

  if (displayNumber) {
    return formatPhoneNumber(displayNumber);
  }

  if (trimmedName && !isPlaceholderCallerName(trimmedName)) {
    return trimmedName;
  }

  return displayNumber ? formatPhoneNumber(displayNumber) : 'Unknown Caller';
}
