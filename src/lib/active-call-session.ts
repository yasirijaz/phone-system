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

export function isSameCallSession(
  existing: ActiveCallSession | null | undefined,
  patch: Partial<ActiveCallSession>
): boolean {
  if (!existing) return false;

  if (patch.callSid && existing.callSid) {
    return patch.callSid === existing.callSid;
  }

  if (patch.conferenceSid && existing.conferenceSid) {
    return patch.conferenceSid === existing.conferenceSid;
  }

  return false;
}

export function replaceActiveCallSession(session: Partial<ActiveCallSession>): ActiveCallSession {
  const replaced: ActiveCallSession = {
    callSid: session.callSid ?? null,
    conferenceSid: session.conferenceSid ?? null,
    callerName: session.callerName ?? 'Unknown Caller',
    callerNumber: session.callerNumber ?? '',
    departmentName: session.departmentName ?? null,
    startedAt: session.startedAt ?? Date.now(),
  };
  writeActiveCallSession(replaced);
  return replaced;
}

/** Patch the current call session — starts a fresh session when the call identity changes. */
export function mergeActiveCallSession(patch: Partial<ActiveCallSession>): ActiveCallSession {
  const existing = readActiveCallSession();

  if (
    existing &&
    ((patch.callSid && existing.callSid && patch.callSid !== existing.callSid) ||
      (patch.conferenceSid &&
        existing.conferenceSid &&
        patch.conferenceSid !== existing.conferenceSid &&
        patch.callSid !== existing.callSid))
  ) {
    return replaceActiveCallSession({ ...patch, startedAt: patch.startedAt ?? Date.now() });
  }

  const merged: ActiveCallSession = {
    callSid: patch.callSid ?? existing?.callSid ?? null,
    conferenceSid: patch.conferenceSid ?? existing?.conferenceSid ?? null,
    callerName: patch.callerName ?? existing?.callerName ?? 'Unknown Caller',
    callerNumber: patch.callerNumber ?? existing?.callerNumber ?? '',
    departmentName: patch.departmentName ?? existing?.departmentName ?? null,
    startedAt: patch.startedAt ?? existing?.startedAt ?? Date.now(),
  };
  writeActiveCallSession(merged);
  return merged;
}
