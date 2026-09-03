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
    // Outbound dials store the number before Twilio assigns a CallSid/conference.
    // Keep those sessions so the UI does not fall back to "Unknown Caller".
    if (!parsed?.conferenceSid && !parsed?.callSid && !parsed?.callerNumber) return null;
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

  const existingName = existing?.callerName ?? '';
  const patchName = patch.callerName;
  const preferExistingName =
    patchName != null &&
    /^(unknown caller|unknown|on call)?$/i.test(String(patchName).trim()) &&
    existingName &&
    !/^(unknown caller|unknown|on call)?$/i.test(existingName.trim());

  const existingNumber = existing?.callerNumber ?? '';
  const patchNumber = patch.callerNumber;
  const preferExistingNumber =
    patchNumber != null &&
    (!String(patchNumber).trim() || String(patchNumber).toLowerCase().startsWith('client:')) &&
    existingNumber &&
    !String(existingNumber).toLowerCase().startsWith('client:');

  const merged: ActiveCallSession = {
    callSid: patch.callSid ?? existing?.callSid ?? null,
    conferenceSid: patch.conferenceSid ?? existing?.conferenceSid ?? null,
    callerName: preferExistingName
      ? existingName
      : (patchName ?? existingName ?? 'Unknown Caller'),
    callerNumber: preferExistingNumber
      ? existingNumber
      : (patchNumber ?? existingNumber ?? ''),
    departmentName: patch.departmentName ?? existing?.departmentName ?? null,
    startedAt: patch.startedAt ?? existing?.startedAt ?? Date.now(),
  };
  writeActiveCallSession(merged);
  return merged;
}
