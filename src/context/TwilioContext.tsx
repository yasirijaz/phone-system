
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode, useRef } from 'react';
import type { Device, Call } from '@twilio/voice-sdk';
import type { ConferenceOptions, Worker as TwilioWorker, Reservation } from 'twilio-taskrouter';

import axios from '@/lib/axios';
import {
  leaveConference as leaveConferenceApi,
  endConference as endConferenceApi,
  allParticipant,
  holdParticipant,
  consultMerge,
  type ConferenceParticipant,
} from '@/services/twilioService';
import {
  broadcastOperatorPresence,
  broadcastOperatorPresenceKeepalive,
  type OperatorPresenceEvent,
} from '@/services/operatorPresenceService';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';
import { isElectron } from '@/lib/is-electron';
import { events } from '@/lib/events';
import {
  createIncomingRingAudio,
  isAgentOnCallState,
  playIncomingRing,
  stopIncomingRing,
} from '@/lib/incoming-call-audio';
import {
  clearActiveCallSession,
  isSameCallSession,
  mergeActiveCallSession,
  readActiveCallSession,
  replaceActiveCallSession,
  type ActiveCallSession,
} from '@/lib/active-call-session';
import { findLiveCallOnDevice, isLiveCallStatus } from '@/lib/twilio-call-utils';
import {
  isUnavailableLikeActivity,
  normalizeWorkerActivityName,
} from '@/lib/worker-status';
import { startTabPresence, type TabPresenceHandle } from '@/lib/tab-presence';
import { getActiveCall, dismissActiveCall } from '@/services/callLogService';

interface TwilioContextType {
  device: Device | null;
  connection: Call | null;
  worker: TwilioWorker | null;
  incomingReservation: Reservation | null;
  activeReservation: Reservation | null;
  showReservationModal: boolean | null;
  isDeviceReady: boolean;
  isWorkerReady: boolean;
  isConnecting: boolean;
  error: string | null;
  conferenceSid: string | null;
  fromNumber: string | null;
  activeCallMeta: ActiveCallSession | null;
  /** True when Twilio Device still has live media (survives React state clears). */
  isOnLiveCall: boolean;
  connectTwilio: () => void;
  syncActiveCallState: () => Promise<void>;
  registerOutboundConnection: (conn: Call, meta?: Partial<ActiveCallSession>) => void;
  /** Rehydrate React connection from Device media and ensure ActiveCallBar can open. */
  rehydrateActiveCallUi: () => boolean;
  /** Hold/unhold external conference participants from Electron progress overlay. */
  toggleHoldFromProgress: () => Promise<boolean>;
  acceptCall: () => void;
  rejectCall: () => void;
  hangUp: () => void;
  leaveCall: (conferenceSid: string, callSid: string) => Promise<void>;
  endCallForAll: (conferenceSid?: string | null) => Promise<void>;
  acceptReservation: (reservation: Reservation) => void;
  acceptReservationAndEndCurrent: (reservation: Reservation) => Promise<void>;
  acceptReservationWithHold: (reservation: Reservation) => Promise<void>;
  acceptReservationAndMerge: (reservation: Reservation) => Promise<void>;
  rejectReservation: (reservation: Reservation) => void;
  completeReservation: (reservation: Reservation) => void;
  activityName: string | null;
  toggleActivity: (selectedActivityName: string) => void;
  setFromNumber: (from: string | null) => void;
  setConferenceSid: (sid: string | null) => void;
}

declare global {
  interface Window {
    electronAPI?: {
      send: (channel: string, data?: any) => void;
      on: (channel: string, func: (...args: any[]) => void) => (() => void) | undefined;
    };
  }
}

const TwilioContext = createContext<TwilioContextType | undefined>(undefined);

export function TwilioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const deviceRef = useRef<Device | null>(null);
  const workerRef = useRef<TwilioWorker | null>(null);
  const [connection, setConnection] = useState<Call | null>(null);
  const [incomingReservation, setIncomingReservation] = useState<Reservation | null>(null);
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);
  const [showReservationModal, setShowReservationModal] = useState<boolean | null>(null);
  const [isDeviceReady, setIsDeviceReady] = useState(false);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [conferenceSid, setConferenceSid] = useState<string | null>(null);
  const [fromNumber, setFromNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [twilio, setTwilio] = useState<any>(null);
  const [activityName, setActivityName] = useState<string | null>(null);
  const [activeCallMeta, setActiveCallMeta] = useState<ActiveCallSession | null>(() => readActiveCallSession());
  const [isOnLiveCall, setIsOnLiveCall] = useState(false);
  const ringAudioRef = useRef<HTMLAudioElement | null>(null);
  const syncInFlightRef = useRef(false);
  const lastClearedAtRef = useRef<number>(0);
  const connectionRef = useRef<Call | null>(null);
  /** Tracks accepted Call after SDK moves it to Device._activeCall. */
  const liveCallRef = useRef<Call | null>(null);
  const customerHoldRef = useRef(false);
  const userInCallRef = useRef(false);
  const incomingReservationRef = useRef<Reservation | null>(null);
  const activeReservationRef = useRef<Reservation | null>(null);
  const connectionSourceRef = useRef<'device' | 'reservation' | null>(null);
  const expectingReservationDeviceLegRef = useRef(false);
  const reservationLifecycleAttachedRef = useRef<WeakSet<Reservation>>(new WeakSet());
  const availableActivitySidRef = useRef<string | null>(null);
  /** User explicitly chose Unavailable/Offline — do not auto-restore Available after calls. */
  const suppressAutoAvailableRef = useRef(false);
  const tabPresenceRef = useRef<TabPresenceHandle | null>(null);
  const restoreRetryTimerRef = useRef<number | null>(null);
  const lastPresenceBroadcastRef = useRef<{ status: string; at: number } | null>(null);
  const restoreInFlightRef = useRef(false);
  const conferenceSidRef = useRef<string | null>(null);
  const hangUpFromOverlayRef = useRef<() => void>(() => {});
  const restoreActiveCallUiRef = useRef<() => boolean>(() => false);
  const toggleHoldFromProgressRef = useRef<() => Promise<boolean>>(async () => false);
  const pendingMergeConferenceSidRef = useRef<string | null>(null);
  const pendingConferenceInviteRef = useRef<{
    transfer?: boolean;
    autoAccept: boolean;
    expires: number;
  } | null>(null);
  // Timer ref to debounce clearing the active call session when transiently not detected
  const clearCallTimerRef = useRef<number | null>(null);
  const reservationActionHandlersRef = useRef<{
    acceptReservation: (reservation: Reservation) => void;
    acceptReservationWithHold: (reservation: Reservation) => Promise<void>;
    acceptReservationAndEndCurrent: (reservation: Reservation) => Promise<void>;
    acceptReservationAndMerge: (reservation: Reservation) => Promise<void>;
    isAgentOnCall: () => boolean;
  }>({
    acceptReservation: () => {},
    acceptReservationWithHold: async () => {},
    acceptReservationAndEndCurrent: async () => {},
    acceptReservationAndMerge: async () => {},
    isAgentOnCall: () => false,
  });
  /** Completes a held reservation + restores Available after media disconnect (customer hangup). */
  const finalizeAfterDisconnectRef = useRef<(reservation: Reservation | null) => void>(() => {});

  const logReservationState = useCallback((message: string, reservation?: Reservation | null, extra: Record<string, unknown> = {}) => {
    const worker = workerRef.current;

    console.log(message, {
      workerSid: worker?.sid ?? null,
      workerActivity: worker?.activity?.name ?? null,
      workerActivitySid: worker?.activity?.sid ?? null,
      reservationSid: reservation?.sid ?? null,
      reservationStatus: reservation?.status ?? null,
      taskSid: reservation?.task?.sid ?? null,
      ...extra,
    });
  }, []);

  useEffect(() => {
    conferenceSidRef.current = conferenceSid;
  }, [conferenceSid]);

  // Cleanup any pending clear timer on unmount
  useEffect(() => {
    return () => {
      if (clearCallTimerRef.current) {
        clearTimeout(clearCallTimerRef.current as any);
        clearCallTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    activeReservationRef.current = activeReservation;
  }, [activeReservation]);

  useEffect(() => {
    connectionRef.current = connection;
    if (connection && isLiveCallStatus(connection.status?.())) {
      liveCallRef.current = connection;
      setIsOnLiveCall(true);
    }
  }, [connection]);

  useEffect(() => {
    if (!conferenceSid) return;
    const merged = mergeActiveCallSession({ conferenceSid });
    setActiveCallMeta(merged);
  }, [conferenceSid]);

  const getLiveCall = useCallback(() => {
    const live = findLiveCallOnDevice(deviceRef.current, liveCallRef.current);
    if (live) {
      liveCallRef.current = live;
      return live;
    }
    return null;
  }, []);

  const adoptLiveConnection = useCallback((call: Call) => {
    liveCallRef.current = call;
    connectionSourceRef.current = 'device';
    setConnection(call);
    setIsOnLiveCall(true);
  }, []);

  const clearActiveCallState = useCallback(() => {
    lastClearedAtRef.current = Date.now();
    userInCallRef.current = false;
    liveCallRef.current = null;
    customerHoldRef.current = false;
    setIsOnLiveCall(false);
    setConnection(null);
    setActiveReservation(null);
    activeReservationRef.current = null;
    expectingReservationDeviceLegRef.current = false;
    setConferenceSid(null);
    setFromNumber(null);
    connectionSourceRef.current = null;
    clearActiveCallSession();
    setActiveCallMeta(null);
  }, []);

  /**
   * Clear UI only when Twilio media is truly gone. If media is still live, rehydrate
   * React connection so ActiveCallBar / Electron progress stay available.
   */
  const clearActiveCallStateIfIdle = useCallback(
    (reason: string): boolean => {
      const live = getLiveCall();
      if (live) {
        logReservationState('Keeping active call UI — live media still present', activeReservationRef.current, {
          reason,
          callSid: live.parameters?.CallSid ?? null,
        });
        adoptLiveConnection(live);
        return false;
      }
      clearActiveCallState();
      return true;
    },
    [adoptLiveConnection, clearActiveCallState, getLiveCall, logReservationState]
  );

  useEffect(() => {
    const justCleared =
      lastClearedAtRef.current > 0 && Date.now() - lastClearedAtRef.current < 15_000;
    if (justCleared) {
      return;
    }
    userInCallRef.current = Boolean(user?.in_call);
  }, [user?.in_call]);

  useEffect(() => {
    const handleConferenceInvite = (data: Record<string, unknown>) => {
      pendingConferenceInviteRef.current = {
        transfer: Boolean(data.transfer),
        autoAccept: data.auto_accept === true,
        expires: Date.now() + 120_000,
      };
    };

    events.on('conferenceInvite', handleConferenceInvite);
    return () => events.off('conferenceInvite', handleConferenceInvite);
  }, []);

  useEffect(() => {
    ringAudioRef.current = createIncomingRingAudio();
    return () => {
      stopIncomingRing(ringAudioRef.current);
      ringAudioRef.current = null;
    };
  }, []);

  const isAgentOnCall = useCallback(() => {
    return isAgentOnCallState({
      hasActiveReservation: Boolean(activeReservationRef.current),
      userInCall: userInCallRef.current,
      connectionStatus: connectionRef.current?.status?.() ?? null,
    });
  }, []);

  const startIncomingRing = useCallback(() => {
    const audio = ringAudioRef.current;
    if (!audio) return;
    void playIncomingRing(audio, isAgentOnCall());
  }, [isAgentOnCall]);

  const stopIncomingRingSound = useCallback(() => {
    stopIncomingRing(ringAudioRef.current);
  }, []);

  const persistActiveCallMeta = useCallback(
    (patch: Partial<ActiveCallSession>, options?: { replace?: boolean }) => {
      const merged = options?.replace
        ? replaceActiveCallSession({ ...patch, startedAt: patch.startedAt ?? Date.now() })
        : mergeActiveCallSession(patch);
      setActiveCallMeta(merged);
      if (merged.conferenceSid) {
        setConferenceSid(merged.conferenceSid);
      }
      return merged;
    },
    []
  );

  const syncActiveCallState = useCallback(async () => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;

    try {
      const liveDeviceCall = getLiveCall();
      const currentConnection = connectionRef.current;
      const currentStatus = currentConnection?.status?.() ?? null;

      if (liveDeviceCall && (!currentConnection || !isLiveCallStatus(currentStatus))) {
        adoptLiveConnection(liveDeviceCall);
      }

      setIsOnLiveCall(Boolean(liveDeviceCall) || isLiveCallStatus(connectionRef.current?.status?.()));

      const connectionAfterSync = liveDeviceCall ?? connectionRef.current;
      const reservation = activeReservationRef.current;

      if (connectionAfterSync && isLiveCallStatus(connectionAfterSync.status?.())) {
        // Cancel any pending clear timer — call detected again
        if (clearCallTimerRef.current) {
          clearTimeout(clearCallTimerRef.current as any);
          clearCallTimerRef.current = null;
        }

        const callSid = connectionAfterSync.parameters?.CallSid ?? null;
        const attrs = reservation?.task?.attributes;
        persistActiveCallMeta({
          callSid,
          callerName:
            attrs?.contact_name ||
            connectionAfterSync.parameters?.FriendlyName ||
            'Unknown Caller',
          callerNumber:
            attrs?.from ||
            connectionAfterSync.parameters?.From ||
            connectionAfterSync.parameters?.To ||
            '',
          departmentName: attrs?.department_name || null,
          conferenceSid:
            attrs?.conference?.sid ||
            connectionAfterSync.customParameters?.get?.('conferenceSid') ||
            readActiveCallSession()?.conferenceSid ||
            null,
        });
        return;
      }

      if (reservation) {
        // Cancel any pending clear timer — reservation present
        if (clearCallTimerRef.current) {
          clearTimeout(clearCallTimerRef.current as any);
          clearCallTimerRef.current = null;
        }

        const attrs = reservation.task?.attributes;
        persistActiveCallMeta({
          callerName: attrs?.contact_name || attrs?.from || 'Unknown Caller',
          callerNumber: attrs?.from || '',
          departmentName: attrs?.department_name || null,
          conferenceSid: attrs?.conference?.sid || null,
        });
        return;
      }

      // Guard: if the call was explicitly ended recently, don't restore from the API even
      // if the backend webhook hasn't arrived yet (userInCallRef may still be true for a
      // few seconds after clearActiveCallState() runs).
      const recentlyClearedMs = lastClearedAtRef.current > 0
        ? Date.now() - lastClearedAtRef.current
        : Infinity;
      const justCleared = recentlyClearedMs < 15_000;

      if (!justCleared && (userInCallRef.current || readActiveCallSession()) && user?.id) {
        const activeCallLog = await getActiveCall();

        const clearedDuringFetch = lastClearedAtRef.current > 0
          && Date.now() - lastClearedAtRef.current < 15_000;

        const hasLiveCallLeg = Boolean(liveDeviceCall) || Boolean(activeReservationRef.current);

        if (
          !clearedDuringFetch &&
          activeCallLog?.call_status === 'in_progress' &&
          hasLiveCallLeg
        ) {
          const restored = persistActiveCallMeta(
            {
              callSid: activeCallLog.worker_sid || activeCallLog.call_sid || null,
              conferenceSid: activeCallLog.conference_sid || null,
              callerName:
                activeCallLog.contact_name ||
                activeCallLog.client_name ||
                activeCallLog.from ||
                activeCallLog.to ||
                'Unknown Caller',
              callerNumber: activeCallLog.from || activeCallLog.to || '',
              departmentName: activeCallLog.department?.name || null,
            },
            { replace: true }
          );
          setActiveCallMeta(restored);
          return;
        }

        if (!hasLiveCallLeg && activeCallLog?.call_status === 'in_progress') {
          await dismissActiveCall();
        }
      }

      if (!liveDeviceCall && !activeReservationRef.current) {
        // Debounce clearing to avoid transient false negatives from the device/reservation checks.
        if (!clearCallTimerRef.current) {
          clearCallTimerRef.current = window.setTimeout(() => {
            if (getLiveCall()) {
              clearCallTimerRef.current = null;
              return;
            }
            clearActiveCallSession();
            setActiveCallMeta(null);
            userInCallRef.current = false;
            setIsOnLiveCall(false);
            liveCallRef.current = null;
            clearCallTimerRef.current = null;
          }, 2500);
        }
      } else {
        // If we detect the call again, cancel any pending clear
        if (clearCallTimerRef.current) {
          clearTimeout(clearCallTimerRef.current as any);
          clearCallTimerRef.current = null;
        }
      }
    } finally {
      syncInFlightRef.current = false;
    }
  }, [adoptLiveConnection, getLiveCall, persistActiveCallMeta, user?.id]);

  const registerOutboundConnection = useCallback((conn: Call, meta?: Partial<ActiveCallSession>) => {
    adoptLiveConnection(conn);
    persistActiveCallMeta(
      {
        callSid: conn.parameters?.CallSid ?? null,
        callerName: meta?.callerName ?? meta?.callerNumber ?? 'Unknown Caller',
        callerNumber: meta?.callerNumber ?? '',
        departmentName: meta?.departmentName ?? null,
        conferenceSid: null,
        startedAt: Date.now(),
      },
      { replace: true }
    );
  }, [adoptLiveConnection, persistActiveCallMeta]);

  const isIgnorableReservationError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes('Invalid state transition') ||
      message.includes('ReservationDescriptor') ||
      message.includes('does not contain all properties of a Reservation')
    );
  };

  const safeCompleteReservation = useCallback(async (reservation?: Reservation | null) => {
    const target = reservation ?? activeReservationRef.current;
    if (!target) return;

    let current = target;
    try {
      current = await target.fetchLatestVersion();
    } catch {
      // Fall back to the cached reservation snapshot.
    }

    const status = current.status;
    logReservationState('Checking reservation before completion', current, { status });
    if (
      status === 'completed' ||
      status === 'rejected' ||
      status === 'canceled' ||
      status === 'timeout' ||
      status === 'rescinded' ||
      status === 'pending' ||
      status === 'accepted'
    ) {
      return;
    }

    if (status !== 'wrapping') {
      return;
    }

    try {
      await current.complete();
      logReservationState('Completed reservation', current);
    } catch (error: unknown) {
      if (!isIgnorableReservationError(error)) {
        console.warn('Failed to complete reservation:', error);
      }
    }
  }, [logReservationState]);

  const safeRejectReservation = useCallback(async (reservation?: Reservation | null) => {
    const target = reservation ?? activeReservationRef.current;
    if (!target) return;

    let current = target;
    try {
      current = await target.fetchLatestVersion();
    } catch {
      // Fall back to the cached reservation snapshot.
    }

    if (current.status !== 'pending') {
      logReservationState('Skipping reservation reject because it is no longer pending', current, {
        status: current.status,
      });
      return;
    }

    try {
      await current.reject();
      logReservationState('Rejected pending reservation', current);
    } catch (error: unknown) {
      if (!isIgnorableReservationError(error)) {
        console.warn('Failed to reject reservation:', error);
      }
    }
  }, [logReservationState]);

  const broadcastWorkerStatus = useCallback(
    async (
      status: string,
      event: OperatorPresenceEvent = 'status_change',
      options?: { force?: boolean; localOnly?: boolean; syncTwilio?: boolean }
    ) => {
      if (!user?.id || !status) return;

      const normalized = normalizeWorkerActivityName(status) || status;
      setActivityName(normalized);
      events.emit('refreshWorkerStatus', { user_id: user.id, worker_status: normalized });

      if (options?.localOnly) return;

      // TaskRouter activity can oscillate while reserved/on-call; only explicit transitions
      // (accept, hangup restore, manual toggle, worker ready) should hit the presence API.
      if (!options?.force && isAgentOnCall()) return;

      const last = lastPresenceBroadcastRef.current;
      if (!options?.force && last?.status === normalized && Date.now() - last.at < 5_000) {
        return;
      }

      lastPresenceBroadcastRef.current = { status: normalized, at: Date.now() };
      try {
        await broadcastOperatorPresence({
          event,
          worker_status: normalized,
          sync_twilio: options?.syncTwilio ?? false,
        });
      } catch (error) {
        console.warn('Failed to broadcast operator presence:', error);
      }
    },
    [user?.id, isAgentOnCall]
  );

  const resolveAvailableActivitySid = useCallback(() => {
    if (availableActivitySidRef.current) {
      return availableActivitySidRef.current;
    }

    const worker = workerRef.current;
    const fromWorker = worker
      ? Array.from(worker.activities.values()).find(
          (activity) => normalizeWorkerActivityName(activity.name) === 'Available'
        )?.sid
      : null;

    if (fromWorker) {
      availableActivitySidRef.current = fromWorker;
    }

    return fromWorker ?? null;
  }, []);

  /**
   * True only when media is live or we are mid-accept. Do NOT use stale `user.in_call` /
   * a leftover reservation alone — those are the main reasons agents get stuck Unavailable.
   */
  const hasLiveCallMedia = useCallback(() => {
    if (expectingReservationDeviceLegRef.current) {
      return true;
    }
    if (getLiveCall()) {
      return true;
    }
    const status = String(connectionRef.current?.status?.() ?? '').toLowerCase();
    return Boolean(status) && !['pending', 'ringing', 'closed', ''].includes(status);
  }, [getLiveCall]);

  /**
   * Task queues move workers to Offline/Unavailable on assignment. Conference legs do not
   * always restore Available (especially when the JS SDK fails ReservationDescriptor updates),
   * so force Available after wrap-up/completion.
   */
  const restoreWorkerToAvailable = useCallback(
    async (reason: string) => {
      if (hasLiveCallMedia()) {
        logReservationState('Skipping Available restore (live media)', activeReservationRef.current, {
          reason,
        });
        return;
      }

      // Stale DB/WS in_call often survives customer hangup and used to block restore forever.
      if (userInCallRef.current && !activeReservationRef.current) {
        userInCallRef.current = false;
      }

      if (suppressAutoAvailableRef.current) {
        logReservationState('Skipping Available restore (user chose Unavailable/Offline)', null, {
          reason,
        });
        return;
      }

      const now = Date.now();
      if (restoreInFlightRef.current || now - (lastPresenceBroadcastRef.current?.at ?? 0) < 1_500) {
        // Debounced/in-flight — retry once so a raced Offline from another tab cannot stick.
        if (restoreRetryTimerRef.current == null && !reason.endsWith(':retry')) {
          restoreRetryTimerRef.current = window.setTimeout(() => {
            restoreRetryTimerRef.current = null;
            void restoreWorkerToAvailable(`${reason}:retry`);
          }, 1_600);
        }
        return;
      }

      const worker = workerRef.current;
      if (!worker) return;

      const available = Array.from(worker.activities.values()).find(
        (activity) => normalizeWorkerActivityName(activity.name) === 'Available'
      );

      if (!available) {
        console.warn('Available activity not found on worker', { reason });
        restoreInFlightRef.current = true;
        try {
          await broadcastWorkerStatus('Available', 'status_change', { force: true, syncTwilio: true });
        } finally {
          restoreInFlightRef.current = false;
        }
        return;
      }

      if (available.isCurrent) {
        void broadcastWorkerStatus('Available', 'status_change', { localOnly: true });
        return;
      }

      restoreInFlightRef.current = true;
      try {
        logReservationState('Restoring worker to Available', activeReservationRef.current, {
          reason,
          activitySid: available.sid,
        });
        await available.setAsCurrent();
        await broadcastWorkerStatus('Available', 'status_change', { force: true });
      } catch (error) {
        console.warn('Failed to set Available via TaskRouter SDK, falling back to API:', error);
        try {
          await broadcastWorkerStatus('Available', 'status_change', { force: true, syncTwilio: true });
        } catch (broadcastError) {
          console.warn('Failed to restore Available via presence broadcast:', broadcastError);
        }
      } finally {
        restoreInFlightRef.current = false;
      }
    },
    [broadcastWorkerStatus, hasLiveCallMedia, logReservationState]
  );

  /**
   * Accepting is optimistic: the call bar, the reservation ref and the Unavailable
   * broadcast all happen before TaskRouter confirms. When two dispatchers answer the same
   * call, the loser's accept is rejected and that optimistic state would otherwise stick
   * around as a dead call bar with no audio (and a worker parked on Unavailable).
   */
  const abandonLostReservation = useCallback(
    async (reservation: Reservation, reason: string) => {
      if (activeReservationRef.current !== reservation) return;

      let status = reservation.status;
      try {
        status = (await reservation.fetchLatestVersion()).status;
      } catch {
        // Fall back to the cached reservation snapshot.
      }

      // We won after all — leave the live call alone.
      if (status === 'accepted' || status === 'wrapping') return;
      if (getLiveCall()) return;
      if (activeReservationRef.current !== reservation) return;

      logReservationState('Releasing reservation the agent did not win', reservation, {
        reason,
        status,
      });

      expectingReservationDeviceLegRef.current = false;
      clearActiveCallState();
      void dismissActiveCall();
      await restoreWorkerToAvailable(reason);
      toast({
        title: 'Call already answered',
        description: 'Another agent picked up this call.',
      });
    },
    [clearActiveCallState, getLiveCall, logReservationState, restoreWorkerToAvailable, toast]
  );

  const attachReservationLifecycleHandlers = useCallback((reservation: Reservation) => {
    if (reservationLifecycleAttachedRef.current.has(reservation)) {
      return;
    }
    reservationLifecycleAttachedRef.current.add(reservation);

    reservation.on('wrapup', () => {
      logReservationState('Reservation entered wrapup', reservation);
      void (async () => {
        await safeCompleteReservation(reservation);
        await restoreWorkerToAvailable('reservation.wrapup');
      })();
    });

    reservation.on('completed', () => {
      logReservationState('Reservation completed by TaskRouter', reservation);
      if (activeReservationRef.current === reservation) {
        activeReservationRef.current = null;
        setActiveReservation(null);
      }
      // TaskRouter can complete while conference media is still live — keep the call bar.
      clearActiveCallStateIfIdle('reservation.completed');
      void restoreWorkerToAvailable('reservation.completed');
    });
  }, [clearActiveCallStateIfIdle, restoreWorkerToAvailable, safeCompleteReservation, logReservationState]);

  const clearDeviceConnectionState = useCallback(() => {
    setConnection(null);
    if (!activeReservationRef.current) {
      setConferenceSid(null);
      setFromNumber(null);
      connectionSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!user?.id || user.role_id === 1) return;

    const presence = startTabPresence(user.id);
    tabPresenceRef.current = presence;

    const handlePageHide = () => {
      const { otherTabsRemain } = presence.markClosed();
      tabPresenceRef.current = null;

      // Closing/refreshing one of several tabs must not force the shared worker Offline.
      if (otherTabsRemain) {
        console.info('Skipping offline presence broadcast — other tabs still active');
        return;
      }

      broadcastOperatorPresenceKeepalive({ event: 'offline', worker_status: 'Offline' });
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      // Soft unmount (Strict Mode / HMR): remove this tab from the ledger only.
      // Do not broadcast Offline — pagehide handles real tab closes.
      if (tabPresenceRef.current === presence) {
        presence.markClosed();
        tabPresenceRef.current = null;
      }
    };
  }, [user?.id, user?.role_id]);

  useEffect(() => {
    const loadTwilio = async () => {
      try {
        const voice = await import('@twilio/voice-sdk');
        const taskrouter = await import('twilio-taskrouter');
        setTwilio({ Device: voice.Device, Worker: taskrouter.Worker });
      } catch (e) {
        console.error("Failed to load twilio modules", e)
      }
    };
    if (typeof window !== 'undefined') {
      loadTwilio();
    }
  }, []);

  const connectTwilio = useCallback(async () => {
    if (!twilio || !user || isConnecting || deviceRef.current || user.role_id === 1) return;

    setIsConnecting(true);
    setError(null);

    try {
      const tokenRes = await axios.post('/api/twilio/token');
      const token = tokenRes.data.data.token;
      availableActivitySidRef.current =
        typeof tokenRes.data?.data?.available_activity_sid === 'string'
          ? tokenRes.data.data.available_activity_sid
          : null;

      if (typeof token !== 'string') throw new Error('Invalid token format received from server.');

      const newDevice = new twilio.Device(token, {
        closeExistingSessions: true,
        codecPreferences: ['opus', 'pcmu'],
        debug: true,
        sounds: { incoming: '' },
      });

      deviceRef.current = newDevice;

      newDevice.on('registered', () => {
        console.log('Twilio Device registered');
        setIsDeviceReady(true);
      });

      newDevice.on('unregistered', () => {
        console.log('Twilio Device unregistered');
        setIsDeviceReady(false);
        deviceRef.current = null;
      });

      newDevice.on('error', (err: any) => {
        console.error('Twilio Device Error:', err);
        setError(`Device Error: ${err.message}`);
        setIsDeviceReady(false);
      });

      const handleIncomingCall = (conn: Call) => {
        console.log('Incoming call received:', conn);

        const incomingConferenceSid = conn.customParameters.get('conferenceSid');
        if (incomingConferenceSid) {
          console.log('Found conferenceSid in incoming call parameters:', incomingConferenceSid);
          setConferenceSid(incomingConferenceSid);
        }

        connectionSourceRef.current = 'device';
        setConnection(conn);
        liveCallRef.current = conn;
        const reservationAttrs =
          activeReservationRef.current?.task?.attributes ||
          incomingReservationRef.current?.task?.attributes ||
          null;
        const incomingCallerName =
          reservationAttrs?.contact_name ||
          conn.parameters?.FriendlyName ||
          conn.parameters?.From ||
          'Unknown Caller';
        const incomingCallerNumber =
          reservationAttrs?.from || conn.parameters?.From || conn.parameters?.To || '';

        const autoAccept = conn.customParameters.get('autoAccept');
        const pendingInvite = pendingConferenceInviteRef.current;
        const hasPendingInvite =
          Boolean(pendingInvite) && (pendingInvite?.expires ?? 0) > Date.now();
        const isTransferLeg =
          conn.customParameters.get('transfer') === '1' ||
          (hasPendingInvite && pendingInvite?.transfer === true);
        const isReservationLeg =
          expectingReservationDeviceLegRef.current || activeReservationRef.current !== null;
        const isConferenceInvite =
          Boolean(incomingConferenceSid) || hasPendingInvite || isTransferLeg;
        const shouldAutoAccept =
          isReservationLeg ||
          expectingReservationDeviceLegRef.current ||
          (!isConferenceInvite && (autoAccept === '1' || autoAccept === 'true'));

        const clearPendingConferenceInvite = () => {
          pendingConferenceInviteRef.current = null;
        };

        const persistIncomingCallMeta = () => {
          persistActiveCallMeta(
            {
              callSid: conn.parameters?.CallSid ?? null,
              conferenceSid: incomingConferenceSid || reservationAttrs?.conference?.sid || null,
              callerName: incomingCallerName,
              callerNumber: incomingCallerNumber,
              departmentName: reservationAttrs?.department_name || null,
              startedAt: Date.now(),
            },
            {
              replace:
                Boolean(reservationAttrs) ||
                !isSameCallSession(readActiveCallSession(), {
                  callSid: conn.parameters?.CallSid ?? null,
                }),
            }
          );
        };

        if (shouldAutoAccept) {
          clearPendingConferenceInvite();
          persistIncomingCallMeta();
          conn.accept();
          expectingReservationDeviceLegRef.current = false;
          if (!isReservationLeg) {
            toast({ title: "Incoming Call Accepted" });
          }
        } else {
          startIncomingRing();
          try {
            if (isElectron() && window.electronAPI) {
              window.electronAPI.send('incoming-call', {
                from: incomingCallerNumber,
                callerName: incomingCallerName,
              });
            }
          } catch (e) {
            console.warn('Failed to send incoming-call IPC:', e);
          }
        }

        const stopRingOnEnd = () => stopIncomingRingSound();
        conn.on('accept', stopRingOnEnd);
        conn.on('cancel', stopRingOnEnd);
        conn.on('disconnect', stopRingOnEnd);
        conn.on('reject', stopRingOnEnd);

        conn.on('accept', () => {
          clearPendingConferenceInvite();
          expectingReservationDeviceLegRef.current = false;
          adoptLiveConnection(conn);
          if (!shouldAutoAccept) {
            persistIncomingCallMeta();
          }
          try {
            if (isElectron() && window.electronAPI) {
              window.electronAPI.send('successfully-accepted-call');
            }
          } catch {}
        });

        conn.on('disconnect', () => {
          console.log('Call disconnected.');
          clearPendingConferenceInvite();
          expectingReservationDeviceLegRef.current = false;
          if (connectionSourceRef.current === 'device') {
            const liveCall = getLiveCall();
            if (liveCall) {
              adoptLiveConnection(liveCall);
              return;
            }
            const reservation = activeReservationRef.current;
            if (reservation) {
              finalizeAfterDisconnectRef.current(reservation);
            } else {
              clearActiveCallState();
              void restoreWorkerToAvailable('conn.disconnect');
            }
          }
        });

        conn.on('reject', () => {
          console.log('Call rejected.');
          clearPendingConferenceInvite();
          expectingReservationDeviceLegRef.current = false;
          if (connectionSourceRef.current === 'device') {
            const reservation = activeReservationRef.current;
            if (reservation) {
              finalizeAfterDisconnectRef.current(reservation);
            } else {
              clearActiveCallState();
              void restoreWorkerToAvailable('conn.reject');
            }
          }
        });
      };

      newDevice.on('incoming', handleIncomingCall);

      newDevice.on('connect', (conn: Call) => {
        console.log('Successfully established call!', conn);
        adoptLiveConnection(conn);
        persistActiveCallMeta(
          {
            callSid: conn.parameters?.CallSid ?? null,
            callerName: conn.parameters?.FriendlyName || conn.parameters?.To || 'Unknown Caller',
            callerNumber: conn.parameters?.From || conn.parameters?.To || '',
            conferenceSid: null,
            startedAt: Date.now(),
          },
          { replace: true }
        );
      });

      newDevice.on('disconnect', () => {
        console.log('Call disconnected (device event).');
        const liveCall = findLiveCallOnDevice(newDevice, liveCallRef.current);
        if (liveCall) {
          adoptLiveConnection(liveCall);
          return;
        }
        if (connectionSourceRef.current === 'device') {
          const reservation = activeReservationRef.current;
          if (reservation) {
            finalizeAfterDisconnectRef.current(reservation);
          } else {
            clearActiveCallState();
            void restoreWorkerToAvailable('device.disconnect');
          }
        }
      });


      // --- AUDIO HARDWARE INITIALIZATION ---
      try {
        // 1. Request microphone access so device names and IDs can map properly
        await navigator.mediaDevices.getUserMedia({ audio: true });

        // 2. Fetch saved keys from local storage
        const savedMicrophoneId = localStorage.getItem('hardware_selected_microphone');
        const savedSpeakerId = localStorage.getItem('hardware_selected_speaker');

        // 3. Bind saved mic hardware selection
        if (savedMicrophoneId && newDevice.audio) {
          await newDevice.audio.setInputDevice(savedMicrophoneId);
          console.log('Applied saved mic:', savedMicrophoneId);
        }

        // 4. Bind saved speaker hardware selections
        if (savedSpeakerId && newDevice.audio) {
          await newDevice.audio.speakerDevices.set([savedSpeakerId]);
          await newDevice.audio.ringtoneDevices.set([savedSpeakerId]);
          newDevice.audio.incoming(false);
          console.log('Applied saved speaker output routes:', savedSpeakerId);
        } else if (newDevice.audio) {
          newDevice.audio.incoming(false);
        }
      } catch (audioErr) {
        console.warn('Could not initialize custom local storage audio routing:', audioErr);
      }
      // --- END AUDIO HARDWARE INITIALIZATION ---

      await newDevice.register();

      const newWorker = new twilio.Worker(token);
      workerRef.current = newWorker;

      newWorker.on('ready', (worker: TwilioWorker) => {
        console.log(`Worker ${worker.sid} is ready`);
        setIsWorkerReady(true);
        const status = normalizeWorkerActivityName(worker.activity?.name) || worker.activity?.name || null;
        setActivityName(status);
        const availableSid = Array.from(worker.activities.values()).find(
          (activity) => normalizeWorkerActivityName(activity.name) === 'Available'
        )?.sid;
        if (availableSid) {
          availableActivitySidRef.current = availableSid;
        }

        // Multi-tab / reconnect often leaves the shared worker Offline/Unavailable.
        // Restore Available unless the user explicitly chose an unavailable-like status.
        if (isUnavailableLikeActivity(status) && !suppressAutoAvailableRef.current) {
          void restoreWorkerToAvailable('worker.ready');
          return;
        }

        if (status) void broadcastWorkerStatus(status, 'online', { force: true });
      });

      newWorker.on('activityUpdated', (worker: TwilioWorker) => {
        const rawStatus = worker.activity?.name || null;
        const status = normalizeWorkerActivityName(rawStatus) || rawStatus;
        if (!status) return;

        const onCall = hasLiveCallMedia() || Boolean(activeReservationRef.current);
        const isRingingIncoming = Boolean(incomingReservationRef.current);

        // While on a call, TaskRouter may bounce between Offline/Unavailable/Available.
        // Update local UI only — do not hit /operators/presence on every bounce.
        if (onCall) {
          if (status === 'Available') {
            void broadcastWorkerStatus('Unavailable', 'status_change', { localOnly: true });
            return;
          }
          if (isUnavailableLikeActivity(status)) {
            void broadcastWorkerStatus(status, 'status_change', { localOnly: true });
          }
          return;
        }

        // While ringing, TaskRouter correctly parks the worker on reservationActivitySid
        // (Unavailable). Do not force Available here — that races the pending reservation.
        if (isRingingIncoming && isUnavailableLikeActivity(status)) {
          void broadcastWorkerStatus(status, 'status_change', { localOnly: true });
          return;
        }

        if (isUnavailableLikeActivity(status)) {
          if (suppressAutoAvailableRef.current) {
            void broadcastWorkerStatus(status, 'status_change', { localOnly: true });
            return;
          }

          void restoreWorkerToAvailable(`activityUpdated-${status}`);
          return;
        }

        if (status === 'Available') {
          suppressAutoAvailableRef.current = false;
          void broadcastWorkerStatus(status, 'status_change', { force: true });
        }
      });

      newWorker.on('reservationCreated', (reservation: Reservation) => {
        console.log('Reservation created:', reservation);
        if (!isAgentOnCall()) {
          clearActiveCallSession();
          setActiveCallMeta(null);
          setConferenceSid(null);
        }
        setIncomingReservation(reservation);
        setShowReservationModal(true);
        incomingReservationRef.current = reservation;
        startIncomingRing();
        // Inform Electron main to show native/mini window notification
        try {
          if (isElectron() && window.electronAPI) {
            const attrs: any = reservation.task?.attributes || {};
            const from = attrs.contact_name || attrs.callerName || attrs.from || '';
            const callerName = attrs.callerName || attrs.contact_name || '';
            const session = readActiveCallSession();
            const onCall = isAgentOnCall();
            window.electronAPI.send('incoming-call', {
              from,
              callerName,
              activeCall: onCall
                ? {
                    callerName: session?.callerName || 'On Call',
                    callerNumber: session?.callerNumber || '',
                    startedAt: session?.startedAt || Date.now(),
                  }
                : null,
            });
          }
        } catch (e) {
          console.warn('Failed to send incoming-call IPC:', e);
        }

        const attributes = reservation.task?.attributes;
        if (attributes.do_nothing) {
          console.log('Reservation is set to do nothing.');
          if (attributes.do_nothing) {
            console.log('Reservation is set to do nothing.');
            const outgoing = process.env.NEXT_PUBLIC_API_URL + '/api/twilio/outgoing-callback';

            reservation.call(
              attributes.from,
              outgoing,
              {
                accept: true,
                statusCallbackUrl: process.env.NEXT_PUBLIC_API_URL + '/api/twilio/statusEventCallback',
                to: attributes.to,
              }
            )
          }
          return;
        }
        reservation.on('accepted', () => {
          console.log('Reservation accepted.');
          attachReservationLifecycleHandlers(reservation);
          setIncomingReservation(null);
          setShowReservationModal(false);
          stopIncomingRingSound();
          setTimeout(() => {
            const attributes = reservation.task?.attributes;
            const confSid = attributes?.conference?.sid;
            // Company DID (task.to) is the Twilio From for later consult/add dials.
            // Never store contact_name or customer from as caller ID.
            const companyDid = attributes?.to || null;
            console.log('Extracted conference SID:', confSid);
            console.log('Extracted company DID (caller ID):', companyDid);

            if (confSid) setConferenceSid(confSid);
            if (companyDid) {
              setFromNumber(companyDid);
              try {
                localStorage.setItem('twilioFromNumber', companyDid);
              } catch {
                // ignore storage errors
              }
            }

            persistActiveCallMeta({
              conferenceSid: confSid || null,
              callerName: attributes?.contact_name || attributes?.from || 'Unknown Caller',
              callerNumber: attributes?.from || '',
              departmentName: attributes?.department_name || null,
            });

            if (typeof window !== 'undefined' && window.electronAPI) {
              window.electronAPI.send('successfully-accepted-call');
            }

          }, 500);
        });

        const clearReservation = (reason: string) => {
          logReservationState('Clearing reservation UI state', reservation, { reason });
          stopIncomingRingSound();
          setIncomingReservation(null);
          setShowReservationModal(false);
          incomingReservationRef.current = null;
          // isAgentOnCall() counts this reservation itself, so when the reservation we
          // optimistically accepted is the one being cancelled (another agent won the
          // race) it would block its own cleanup. Only a *different* live call may.
          const isOptimisticallyActive = activeReservationRef.current === reservation;
          const busyWithAnotherCall = isAgentOnCall() && !isOptimisticallyActive;
          if (!busyWithAnotherCall && !getLiveCall()) {
            clearActiveCallState();
            void restoreWorkerToAvailable(reason);
          } else if (getLiveCall()) {
            adoptLiveConnection(getLiveCall()!);
            if (activeReservationRef.current === reservation) {
              activeReservationRef.current = null;
              setActiveReservation(null);
            }
          }
          try {
            if (isElectron() && window.electronAPI) {
              window.electronAPI.send('dismiss-incoming-overlay');
            }
          } catch {}
        };

        reservation.on('rescinded', () => { console.log('Reservation rescinded'); clearReservation('reservation.rescinded'); });
        reservation.on('timeout', () => { console.log('Reservation timed out.'); clearReservation('reservation.timeout'); });
        reservation.on('rejected', () => { console.log('Reservation rejected.'); clearReservation('reservation.rejected');  
          if (typeof window !== 'undefined' && window.electronAPI) {
            window.electronAPI.send('successfully-rejected-call');
          }

        });
        reservation.on('canceled', () => { console.log('Reservation canceled.'); clearReservation('reservation.canceled'); });
        reservation.on('completed', () => { console.log('Reservation completed.'); clearReservation('reservation.completed.ui'); });
      });

    } catch (err: any) {
      console.error('Twilio setup failed:', err);
      setError('Failed to initialize Twilio. Please try again later.');
    } finally {
      setIsConnecting(false);
    }
  }, [twilio, user, isConnecting, toast, broadcastWorkerStatus, restoreWorkerToAvailable, clearActiveCallState, clearDeviceConnectionState, attachReservationLifecycleHandlers, startIncomingRing, stopIncomingRingSound, persistActiveCallMeta, isAgentOnCall, hasLiveCallMedia, getLiveCall, adoptLiveConnection, logReservationState]);

  useEffect(() => {
    if (!user?.id) return;

    const handleInCallStatus = (data: { user_id?: number | string; in_call?: number | string | boolean }) => {
      if (Number(data.user_id) !== Number(user.id) || data.in_call == null) return;

      userInCallRef.current = Boolean(Number(data.in_call));
      if (userInCallRef.current) {
        void syncActiveCallState();
      } else {
        const live = getLiveCall();
        if (live) {
          // Backend in_call=0 can race ahead of hangup — keep controls while media lives.
          adoptLiveConnection(live);
          void syncActiveCallState();
          return;
        }
        if (!activeReservationRef.current) {
          clearActiveCallState();
          void restoreWorkerToAvailable('in_call_cleared');
        }
      }
    };

    events.on('refreshInCallStatus', handleInCallStatus);
    return () => {
      events.off('refreshInCallStatus', handleInCallStatus);
    };
  }, [user?.id, syncActiveCallState, clearActiveCallState, restoreWorkerToAvailable, getLiveCall, adoptLiveConnection]);

  useEffect(() => {
    void syncActiveCallState();
    const interval = window.setInterval(() => {
      void syncActiveCallState();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [syncActiveCallState]);

  // Listen for accept/reject actions coming back from Electron main
  useEffect(() => {
    if (!isElectron() || !window.electronAPI) return;

    const offAccepted = window.electronAPI.on('call-accepted', () => {
      const res = incomingReservationRef.current;
      if (res) {
        try {
          const handlers = reservationActionHandlersRef.current;
          if (handlers.isAgentOnCall()) {
            void handlers.acceptReservationWithHold(res);
          } else {
            handlers.acceptReservation(res);
          }
        } catch (e) {
          console.error('Failed to accept reservation from IPC:', e);
        }
        return;
      }

      const pendingConnection = connectionRef.current;
      const pendingStatus = pendingConnection?.status?.();
      if (
        pendingConnection &&
        (pendingStatus === 'pending' || pendingStatus === 'ringing')
      ) {
        try {
          stopIncomingRingSound();
          pendingConnection.accept();
        } catch (e) {
          console.error('Failed to accept device call from IPC:', e);
        }
      }
    });

    const offAcceptedHold = window.electronAPI.on('accept-call-hold', () => {
      const res = incomingReservationRef.current;
      if (res) {
        try {
          void reservationActionHandlersRef.current.acceptReservationWithHold(res);
        } catch (e) {
          console.error('Failed to hold and accept reservation from IPC:', e);
        }
      }
    });

    const offAcceptedEndCurrent = window.electronAPI.on('accept-call-end-current', () => {
      const res = incomingReservationRef.current;
      if (res) {
        try {
          void reservationActionHandlersRef.current.acceptReservationAndEndCurrent(res);
        } catch (e) {
          console.error('Failed to end current call and accept reservation from IPC:', e);
        }
      }
    });

    const offAcceptedMerge = window.electronAPI.on('accept-call-merge', () => {
      const res = incomingReservationRef.current;
      if (res) {
        try {
          void reservationActionHandlersRef.current.acceptReservationAndMerge(res);
        } catch (e) {
          console.error('Failed to merge and accept reservation from IPC:', e);
        }
      }
    });

    const offRejected = window.electronAPI.on('call-rejected', () => {
      const res = incomingReservationRef.current;
      if (res) {
        try {
          rejectReservation(res);
        } catch (e) {
          console.error('Failed to reject reservation from IPC:', e);
        }
        return;
      }

      const pendingConnection = connectionRef.current;
      const pendingStatus = pendingConnection?.status?.();
      if (
        pendingConnection &&
        (pendingStatus === 'pending' || pendingStatus === 'ringing')
      ) {
        try {
          stopIncomingRingSound();
          pendingConnection.reject();
          clearActiveCallState();
        } catch (e) {
          console.error('Failed to reject device call from IPC:', e);
        }
      }
    });

    const offEndCall = window.electronAPI.on('end-call-from-progress', () => {
      try {
        hangUpFromOverlayRef.current();
      } catch (e) {
        console.error('Failed to end call from progress overlay:', e);
      }
    });

    const offRestoreUi = window.electronAPI.on('restore-active-call-ui', () => {
      try {
        restoreActiveCallUiRef.current();
      } catch (e) {
        console.error('Failed to restore active call UI from progress overlay:', e);
      }
    });

    const offHoldCall = window.electronAPI.on('hold-call-from-progress', () => {
      void (async () => {
        try {
          await toggleHoldFromProgressRef.current();
        } catch (e) {
          console.error('Failed to toggle hold from progress overlay:', e);
        }
      })();
    });

    return () => {
      try { offAccepted && offAccepted(); } catch {}
      try { offAcceptedHold && offAcceptedHold(); } catch {}
      try { offAcceptedEndCurrent && offAcceptedEndCurrent(); } catch {}
      try { offAcceptedMerge && offAcceptedMerge(); } catch {}
      try { offRejected && offRejected(); } catch {}
      try { offEndCall && offEndCall(); } catch {}
      try { offRestoreUi && offRestoreUi(); } catch {}
      try { offHoldCall && offHoldCall(); } catch {}
    };
  }, []);

  const acceptCall = () => {
    if (connection) {
      console.log(`Accepting call`);
      stopIncomingRingSound();
      connection.accept();
      toast({ title: "Call Accepted" });
    }
  }

  const rejectCall = () => {
    if (connection) {
      console.log(`Rejecting call`);
      stopIncomingRingSound();
      connection.reject();
      toast({ title: "Call Rejected" });
      clearActiveCallState();
    }
  };

  const scheduleReservationFinalize = useCallback((reservation?: Reservation | null) => {
    const target = reservation ?? activeReservationRef.current;
    if (!target) {
      void restoreWorkerToAvailable('no-reservation-finalize');
      return;
    }

    for (const delayMs of [1500]) {
      window.setTimeout(() => {
        void (async () => {
          await safeCompleteReservation(target);
          await restoreWorkerToAvailable('finalize');
        })();
      }, delayMs);
    }
  }, [restoreWorkerToAvailable, safeCompleteReservation]);

  useEffect(() => {
    finalizeAfterDisconnectRef.current = (reservation) => {
      scheduleReservationFinalize(reservation);
      // Only tear down UI when media is actually gone.
      if (!clearActiveCallStateIfIdle('finalizeAfterDisconnect')) {
        return;
      }
      void dismissActiveCall().then(() => {
        if (user?.id) {
          events.emit('refreshInCallStatus', { user_id: user.id, in_call: 0 });
        }
      });
    };
  }, [scheduleReservationFinalize, clearActiveCallStateIfIdle, user?.id]);

  const leaveCall = async (conferenceSid: string, callSid: string) => {
    const reservationToFinalize = activeReservationRef.current;

    try {
      await leaveConferenceApi(conferenceSid, callSid);
    } catch (error) {
      console.warn('Failed to leave conference via API:', error);
      if (connection) {
        try {
          connection.disconnect();
        } catch (disconnectError) {
          console.warn('Failed to disconnect call leg:', disconnectError);
        }
      }
    }

    scheduleReservationFinalize(reservationToFinalize);
    clearActiveCallState();
    void dismissActiveCall().then(() => {
      if (user?.id) {
        events.emit('refreshInCallStatus', { user_id: user.id, in_call: 0 });
      }
    });
    toast({ title: 'Left call' });
  };

  const endCallForAll = async (conferenceSid?: string | null) => {
    const reservationToFinalize = activeReservationRef.current;
    const ownCallSid =
      connectionRef.current?.parameters?.CallSid ??
      findLiveCallOnDevice(deviceRef.current, liveCallRef.current)?.parameters?.CallSid ??
      readActiveCallSession()?.callSid ??
      null;

    if (conferenceSid && ownCallSid) {
      try {
        await endConferenceApi(conferenceSid);
      } catch (error) {
        console.warn('Failed to end conference via API:', error);
      }
    } else if (conferenceSid) {
      // We hold no leg in this conference (typically because another agent answered
      // first). Ending it here would hang up the customer and the agent who did answer,
      // so only our own stale UI is torn down.
      console.warn('Skipping end-conference: no local call leg', { conferenceSid });
    }

    if (connection) {
      try {
        connection.disconnect();
      } catch (error) {
        console.warn('Failed to disconnect call leg:', error);
      }
    }

    scheduleReservationFinalize(reservationToFinalize);
    clearActiveCallState();
    void dismissActiveCall().then(() => {
      if (user?.id) {
        events.emit('refreshInCallStatus', { user_id: user.id, in_call: 0 });
      }
    });
    toast({ title: 'Call Ended' });
  };

  const rehydrateActiveCallUi = useCallback((): boolean => {
    const live = getLiveCall();
    if (!live) {
      void syncActiveCallState();
      return Boolean(getLiveCall() || connectionRef.current || activeReservationRef.current);
    }
    adoptLiveConnection(live);
    const session = readActiveCallSession();
    if (session) {
      setActiveCallMeta(session);
      if (session.conferenceSid) {
        setConferenceSid(session.conferenceSid);
      }
    }
    userInCallRef.current = true;
    setIsOnLiveCall(true);
    try {
      events.emit('expandActiveCallBar');
    } catch {
      // ignore
    }
    return true;
  }, [adoptLiveConnection, getLiveCall, syncActiveCallState]);

  const toggleHoldFromProgress = useCallback(async (): Promise<boolean> => {
    const sid =
      conferenceSidRef.current ??
      readActiveCallSession()?.conferenceSid ??
      null;
    if (!sid) {
      toast({
        title: 'Hold unavailable',
        description: 'No active conference found for this call.',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const response = await allParticipant(sid);
      const participants: ConferenceParticipant[] = response?.data ?? response?.participants ?? [];
      const agentSid =
        connectionRef.current?.parameters?.CallSid ??
        getLiveCall()?.parameters?.CallSid ??
        null;
      const externals = participants.filter(
        (participant) => !participant.is_agent && participant.call_sid !== agentSid
      );
      if (externals.length === 0) {
        toast({
          title: 'Hold unavailable',
          description: 'Could not find the customer leg to hold.',
          variant: 'destructive',
        });
        return false;
      }

      const hold = !customerHoldRef.current;
      await Promise.all(
        externals.map((participant) => holdParticipant(sid, participant.call_sid, hold))
      );
      customerHoldRef.current = hold;
      try {
        events.emit('customerHoldChanged', hold);
        if (isElectron() && window.electronAPI) {
          window.electronAPI.send('show-call-progress', {
            isOnHold: hold,
            startedAt: readActiveCallSession()?.startedAt,
            callerName: readActiveCallSession()?.callerName,
            callerNumber: readActiveCallSession()?.callerNumber,
          });
        }
      } catch {
        // ignore
      }
      toast({ title: hold ? 'Caller on Hold' : 'Caller Resumed' });
      return true;
    } catch (error) {
      console.warn('toggleHoldFromProgress failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to toggle hold status.',
        variant: 'destructive',
      });
      return false;
    }
  }, [getLiveCall, toast]);

  useEffect(() => {
    const onHoldChanged = (hold: boolean) => {
      customerHoldRef.current = Boolean(hold);
    };
    events.on('customerHoldChanged', onHoldChanged);
    return () => {
      events.off('customerHoldChanged', onHoldChanged);
    };
  }, []);

  useEffect(() => {
    hangUpFromOverlayRef.current = () => {
      const sid =
        conferenceSidRef.current ??
        readActiveCallSession()?.conferenceSid ??
        null;
      void endCallForAll(sid);
    };
    restoreActiveCallUiRef.current = () => rehydrateActiveCallUi();
    toggleHoldFromProgressRef.current = () => toggleHoldFromProgress();
  });

  const hangUp = () => {
    void endCallForAll(conferenceSid);
  };

  const holdCurrentConferenceParticipants = useCallback(async (): Promise<boolean> => {
    const sid = conferenceSidRef.current ?? readActiveCallSession()?.conferenceSid ?? null;
    if (!sid) return false;

    try {
      const response = await allParticipant(sid);
      const participants: ConferenceParticipant[] = response?.data ?? response?.participants ?? [];
      const agentSid = connectionRef.current?.parameters?.CallSid ?? null;

      await Promise.all(
        participants
          .filter((participant) => !participant.is_agent && participant.call_sid !== agentSid)
          .map((participant) => holdParticipant(sid, participant.call_sid, true))
      );
      return true;
    } catch (error) {
      console.warn('Failed to hold current conference participants:', error);
      return false;
    }
  }, []);

  const scheduleConsultMerge = useCallback((conferenceSidToMerge: string | null) => {
    if (!conferenceSidToMerge) return;

    pendingMergeConferenceSidRef.current = conferenceSidToMerge;
    for (const delayMs of [1500, 4000, 8000]) {
      window.setTimeout(async () => {
        if (pendingMergeConferenceSidRef.current !== conferenceSidToMerge) return;
        try {
          const result = await consultMerge(conferenceSidToMerge);
          if (result?.status) {
            pendingMergeConferenceSidRef.current = null;
            toast({ title: 'Calls merged', description: 'All callers are now connected.' });
          }
        } catch (error) {
          console.warn('Deferred consult merge failed:', error);
        }
      }, delayMs);
    }
  }, [toast]);

  const acceptReservation = (reservation: Reservation) => {
    stopIncomingRingSound();
    console.log('accepting reservation', reservation);

    connectionSourceRef.current = 'reservation';
    expectingReservationDeviceLegRef.current = true;
    setActiveReservation(reservation);
    activeReservationRef.current = reservation;
    attachReservationLifecycleHandlers(reservation);
    setShowReservationModal(false);
    setIncomingReservation(null);
    incomingReservationRef.current = null;
    void broadcastWorkerStatus('Unavailable', 'status_change', { force: true });

    const attributes = reservation.task?.attributes;
    setConferenceSid(null);
    persistActiveCallMeta(
      {
        callSid: null,
        conferenceSid: attributes?.conference?.sid || null,
        callerName: attributes?.contact_name || attributes?.from || 'Unknown Caller',
        callerNumber: attributes?.from || '',
        departmentName: attributes?.department_name || null,
        startedAt: Date.now(),
      },
      { replace: true }
    );
    if (attributes.do_nothing) {
      console.log('Reservation is set to do nothing.');
      const outgoing = process.env.NEXT_PUBLIC_API_URL + '/api/twilio/outgoing-callback';

      reservation.call(
        attributes.from,
        outgoing,
        {
          accept: true,
          statusCallbackUrl: process.env.NEXT_PUBLIC_API_URL + '/api/twilio/statusEventCallback',
          to: attributes.to,
        }
      )
      return;
    }
    const conferenceCallback = process.env.NEXT_PUBLIC_API_URL + '/api/twilio/conference-callback';
    const recordingCallback = process.env.NEXT_PUBLIC_API_URL + '/api/twilio/recording-callback';
    const conferenceEventCallback = process.env.NEXT_PUBLIC_API_URL + '/api/twilio/conference-eventCallback';

    logReservationState('Accepting reservation into conference', reservation);

    const postWorkActivitySid = resolveAvailableActivitySid();
    const conferenceOptions: ConferenceOptions & { postWorkActivitySid?: string } = {
      conferenceStatusCallback: conferenceCallback,
      conferenceStatusCallbackMethod: 'POST',
      conferenceStatusCallbackEvent: 'start,end,join,leave',
      statusCallback: conferenceCallback,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: 'start,end,join,leave',
      endConferenceOnExit: false,
      startConferenceOnEnter: true,
      transcribe: false,
      recordingStatusCallback: recordingCallback,
      conferenceRecordingStatusCallback: conferenceEventCallback,
      conferenceRecord: 'record-from-start', //[true, false, 'record-from-start', 'do-not-record']
      ...(postWorkActivitySid ? { postWorkActivitySid } : {}),
    };

    reservation.conference(conferenceOptions).catch((error: unknown) => {
      if (!isIgnorableReservationError(error)) {
        console.warn('Failed to accept reservation conference:', error);
      }
      void abandonLostReservation(reservation, 'reservation.accept_failed');
    });
  };

  const rejectReservation = (reservation: Reservation) => {
    console.log('rejecting reservation', reservation)
    stopIncomingRingSound();
    expectingReservationDeviceLegRef.current = false;
    setIncomingReservation(null);
    setShowReservationModal(false);
    incomingReservationRef.current = null;
    void safeRejectReservation(reservation);
    if (!isAgentOnCall()) {
      clearActiveCallState();
    }
  };

  const acceptReservationAndEndCurrent = async (reservation: Reservation) => {
    stopIncomingRingSound();
    setShowReservationModal(false);
    setIncomingReservation(null);
    incomingReservationRef.current = null;

    const sid = conferenceSidRef.current ?? readActiveCallSession()?.conferenceSid ?? null;
    await endCallForAll(sid);
    acceptReservation(reservation);
  };

  const acceptReservationWithHold = async (reservation: Reservation) => {
    stopIncomingRingSound();
    await holdCurrentConferenceParticipants();
    acceptReservation(reservation);
  };

  const acceptReservationAndMerge = async (reservation: Reservation) => {
    stopIncomingRingSound();
    const sid = conferenceSidRef.current ?? readActiveCallSession()?.conferenceSid ?? null;
    await holdCurrentConferenceParticipants();
    scheduleConsultMerge(sid);
    acceptReservation(reservation);
  };

  useEffect(() => {
    reservationActionHandlersRef.current = {
      acceptReservation,
      acceptReservationWithHold,
      acceptReservationAndEndCurrent,
      acceptReservationAndMerge,
      isAgentOnCall,
    };
  });

  const completeReservation = (reservation: Reservation) => {
    console.log('completing reservation', reservation)
    void (async () => {
      await safeCompleteReservation(reservation);
      await restoreWorkerToAvailable('completeReservation');
    })();
    clearActiveCallStateIfIdle('completeReservation');
  };

  const toggleActivity = async (selectedActivityName?: string) => {
    if (!workerRef.current) return;

    const currentActivity = normalizeWorkerActivityName(workerRef.current.activity?.name) ||
      workerRef.current.activity?.name;
    const newActivityName = selectedActivityName || (currentActivity === 'Available' ? 'Unavailable' : 'Available');

    const newActivity = Array.from(workerRef.current.activities.values()).find(
      (activity) => normalizeWorkerActivityName(activity.name) === newActivityName || activity.name === newActivityName
    );

    if (newActivity) {
      const normalizedName = normalizeWorkerActivityName(newActivity.name) || newActivity.name;
      suppressAutoAvailableRef.current = isUnavailableLikeActivity(normalizedName);
      logReservationState('Manually updating worker activity', activeReservationRef.current, {
        activity: normalizedName,
        activitySid: newActivity.sid ?? null,
      });
      await newActivity.setAsCurrent();
      void broadcastWorkerStatus(normalizedName, 'status_change', { force: true });
    } else {
      console.error(`Activity '${newActivityName}' not found in worker.activities`);
    }
  };

  useEffect(() => {
    const currentDevice = deviceRef.current;
    const currentWorker = workerRef.current;
    return () => {
      if (restoreRetryTimerRef.current != null) {
        window.clearTimeout(restoreRetryTimerRef.current);
        restoreRetryTimerRef.current = null;
      }
      currentDevice?.disconnectAll();
      currentDevice?.destroy();
      currentWorker?.disconnect();
    };
  }, []);

  const value = {
    device: deviceRef.current,
    connection,
    worker: workerRef.current,
    incomingReservation,
    activeReservation,
    showReservationModal,
    isDeviceReady,
    isWorkerReady,
    isConnecting,
    error,
    conferenceSid,
    fromNumber,
    activeCallMeta,
    isOnLiveCall,
    connectTwilio,
    syncActiveCallState,
    registerOutboundConnection,
    rehydrateActiveCallUi,
    toggleHoldFromProgress,
    acceptCall,
    rejectCall,
    hangUp,
    leaveCall,
    endCallForAll,
    acceptReservation,
    acceptReservationAndEndCurrent,
    acceptReservationWithHold,
    acceptReservationAndMerge,
    rejectReservation,
    completeReservation,
    activityName,
    toggleActivity,
    setFromNumber,
    setConferenceSid,
  };

  return <TwilioContext.Provider value={value}>{children}</TwilioContext.Provider>;
}

export function useTwilio() {
  const context = useContext(TwilioContext);
  if (context === undefined) {
    throw new Error('useTwilio must be used within a TwilioProvider');
  }
  return context;
}
