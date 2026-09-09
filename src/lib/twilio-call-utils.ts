import type { Call, Device } from '@twilio/voice-sdk';

export function isLiveCallStatus(status?: string | null): boolean {
  const normalized = String(status ?? '').toLowerCase();
  return Boolean(normalized) && !['pending', 'ringing', 'closed', ''].includes(normalized);
}

function* iterateDeviceCalls(calls: unknown): Iterable<Call> {
  if (!calls) return;
  if (typeof (calls as Map<string, Call>).values === 'function') {
    yield* (calls as Map<string, Call>).values();
    return;
  }
  if (Array.isArray(calls)) {
    yield* calls as Call[];
    return;
  }
  if (typeof (calls as Iterable<Call>)[Symbol.iterator] === 'function') {
    yield* calls as Iterable<Call>;
  }
}

/**
 * Find a live Call on the Device.
 *
 * After accept, Twilio Voice SDK moves the Call from `device.calls` (ringing/pending)
 * into private `_activeCall`. Pass `trackedCall` (our liveCallRef) so restore/clear
 * guards still work after React state was wiped.
 */
export function findLiveCallOnDevice(
  device: Device | null | undefined,
  trackedCall?: Call | null
): Call | null {
  if (trackedCall && isLiveCallStatus(trackedCall.status?.())) {
    return trackedCall;
  }

  if (!device) return null;

  try {
    // Voice SDK keeps accepted media on private `_activeCall` (not on public `calls`).
    const d = device as unknown as {
      calls?: unknown;
      _activeCall?: Call | null;
      activeCall?: Call | null;
      _call?: Call | null;
    };

    const active = d._activeCall ?? d.activeCall ?? d._call ?? null;
    if (active && isLiveCallStatus(active.status?.())) {
      return active;
    }

    for (const call of iterateDeviceCalls(d.calls)) {
      if (isLiveCallStatus(call?.status?.())) {
        return call;
      }
    }
  } catch {
    return trackedCall && isLiveCallStatus(trackedCall.status?.()) ? trackedCall : null;
  }

  return null;
}
