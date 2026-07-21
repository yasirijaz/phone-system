/**
 * Multi-tab presence ledger so closing/refreshing one tab does not mark the
 * shared Twilio worker Offline while another tab for the same user is still open.
 */

const STORAGE_KEY = 'wsh-operator-tab-presence-v1';
const CHANNEL_NAME = 'wsh-operator-tab-presence';
/** Keep heartbeats modest; background tabs may be heavily throttled. */
const HEARTBEAT_MS = 5_000;
/** Must exceed Chrome's typical background timer clamp (~60s). */
const STALE_MS = 90_000;

type TabPresenceRecord = {
  tabId: string;
  userId: number;
  at: number;
};

function createTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readRecords(): TabPresenceRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TabPresenceRecord[]) : [];
  } catch {
    return [];
  }
}

function writeRecords(records: TabPresenceRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Quota / private mode — presence guard degrades gracefully.
  }
}

function pruneRecords(records: TabPresenceRecord[], now = Date.now()): TabPresenceRecord[] {
  return records.filter((record) => now - record.at < STALE_MS);
}

function upsertRecord(records: TabPresenceRecord[], next: TabPresenceRecord): TabPresenceRecord[] {
  const pruned = pruneRecords(records, next.at).filter((record) => record.tabId !== next.tabId);
  pruned.push(next);
  return pruned;
}

export type TabPresenceHandle = {
  tabId: string;
  /** Remove this tab and return whether any other live tabs remain for the user. */
  markClosed: () => { otherTabsRemain: boolean };
  stop: () => void;
};

/**
 * Start heartbeating this browser tab as an active operator session.
 */
export function startTabPresence(userId: number): TabPresenceHandle {
  const tabId = createTabId();
  let stopped = false;
  let channel: BroadcastChannel | null = null;

  const beat = () => {
    if (stopped || typeof window === 'undefined') return;
    const record: TabPresenceRecord = { tabId, userId, at: Date.now() };
    writeRecords(upsertRecord(readRecords(), record));
    try {
      channel?.postMessage({ type: 'heartbeat', record });
    } catch {
      // BroadcastChannel can throw if closed.
    }
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    // Another tab wrote heartbeats; nothing to do locally beyond future reads.
  };

  if (typeof window !== 'undefined') {
    try {
      channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;
    } catch {
      channel = null;
    }

    if (channel) {
      channel.onmessage = (event: MessageEvent) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'ping' && Number(data.userId) === userId && data.tabId !== tabId) {
          try {
            channel?.postMessage({ type: 'pong', tabId, userId });
          } catch {
            // ignore
          }
        }
        if (data.type === 'heartbeat' && data.record?.userId === userId) {
          writeRecords(upsertRecord(readRecords(), data.record as TabPresenceRecord));
        }
      };
    }

    beat();
    const intervalId = window.setInterval(beat, HEARTBEAT_MS);
    window.addEventListener('storage', onStorage);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') beat();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const stop = () => {
      if (stopped) return;
      stopped = true;
      window.clearInterval(intervalId);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
      try {
        channel?.close();
      } catch {
        // ignore
      }
      channel = null;
    };

    const markClosed = () => {
      const now = Date.now();
      const remaining = pruneRecords(readRecords(), now).filter(
        (record) => record.tabId !== tabId && record.userId === userId
      );
      const others = pruneRecords(readRecords(), now).filter((record) => record.tabId !== tabId);
      writeRecords(others);

      try {
        channel?.postMessage({ type: 'closed', tabId, userId });
      } catch {
        // ignore
      }

      stop();
      return { otherTabsRemain: remaining.length > 0 };
    };

    return { tabId, markClosed, stop };
  }

  return {
    tabId,
    markClosed: () => ({ otherTabsRemain: false }),
    stop: () => {},
  };
}

/**
 * True when at least one other tab for this user has a fresh heartbeat.
 * Useful for last-chance checks without mutating the ledger.
 */
export function hasOtherActiveTabs(userId: number, excludeTabId?: string): boolean {
  const now = Date.now();
  return pruneRecords(readRecords(), now).some(
    (record) =>
      record.userId === userId &&
      record.tabId !== excludeTabId &&
      now - record.at < STALE_MS
  );
}
