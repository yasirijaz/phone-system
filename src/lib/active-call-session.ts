export interface ActiveCallSession {
  callSid: string | null;
  conferenceSid: string | null;
  callerName: string;
  callerNumber: string;
  departmentName: string | null;
  startedAt: number;
}

const STORAGE_KEY = 'active_call_session';

export function readActiveCallSession(): ActiveCallSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveCallSession;
    if (!parsed?.conferenceSid && !parsed?.callSid) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeActiveCallSession(session: ActiveCallSession): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore quota / private mode errors
  }
}

export function clearActiveCallSession(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function mergeActiveCallSession(patch: Partial<ActiveCallSession>): ActiveCallSession {
  const existing = readActiveCallSession();
  const merged: ActiveCallSession = {
    callSid: patch.callSid ?? existing?.callSid ?? null,
    conferenceSid: patch.conferenceSid ?? existing?.conferenceSid ?? null,
    callerName: patch.callerName ?? existing?.callerName ?? 'Unknown Caller',
    callerNumber: patch.callerNumber ?? existing?.callerNumber ?? '',
    departmentName: patch.departmentName ?? existing?.departmentName ?? null,
    startedAt: existing?.startedAt ?? patch.startedAt ?? Date.now(),
  };
  writeActiveCallSession(merged);
  return merged;
}
