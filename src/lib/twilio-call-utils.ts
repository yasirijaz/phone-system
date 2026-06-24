import type { Call, Device } from '@twilio/voice-sdk';

export function isLiveCallStatus(status?: string | null): boolean {
  const normalized = String(status ?? '').toLowerCase();
  return Boolean(normalized) && !['pending', 'ringing', 'closed', ''].includes(normalized);
}

export function findLiveCallOnDevice(device: Device | null | undefined): Call | null {
  if (!device) return null;

  try {
    const calls = (device as Device & { calls?: Map<string, Call> }).calls;
    if (!calls || typeof calls.values !== 'function') return null;

    for (const call of calls.values()) {
      if (isLiveCallStatus(call.status?.())) {
        return call;
      }
    }
  } catch {
    return null;
  }

  return null;
}
