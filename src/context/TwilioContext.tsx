
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
  connectTwilio: () => void;
  syncActiveCallState: () => Promise<void>;
  registerOutboundConnection: (conn: Call, meta?: Partial<ActiveCallSession>) => void;
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
  const ringAudioRef = useRef<HTMLAudioElement | null>(null);
  const syncInFlightRef = useRef(false);
  const lastClearedAtRef = useRef<number>(0);
  const connectionRef = useRef<Call | null>(null);
  const userInCallRef = useRef(false);
  const incomingReservationRef = useRef<Reservation | null>(null);
  const activeReservationRef = useRef<Reservation | null>(null);
  const connectionSourceRef = useRef<'device' | 'reservation' | null>(null);
  const expectingReservationDeviceLegRef = useRef(false);
  const reservationLifecycleAttachedRef = useRef<WeakSet<Reservation>>(new WeakSet());
  const availableActivitySidRef = useRef<string | null>(null);
  /** User explicitly chose Unavailable/Offline — do not auto-restore Available after calls. */
  const suppressAutoAvailableRef = useRef(false);
  const conferenceSidRef = useRef<string | null>(null);
  const hangUpFromOverlayRef = useRef<() => void>(() => {});
  const pendingMergeConferenceSidRef = useRef<string | null>(null);
  const pendingConferenceInviteRef = useRef<{
    transfer?: boolean;
    autoAccept: boolean;
    expires: number;
  } | null>(null);
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

  useEffect(() => {
    activeReservationRef.current = activeReservation;
  }, [activeReservation]);

  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  useEffect(() => {
    if (!conferenceSid) return;
    const merged = mergeActiveCallSession({ conferenceSid });
    setActiveCallMeta(merged);
  }, [conferenceSid]);

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

  const clearActiveCallState = useCallback(() => {
    lastClearedAtRef.current = Date.now();
    userInCallRef.current = false;
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

  const syncActiveCallState = useCallback(async () => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;

    try {
      const liveDeviceCall = findLiveCallOnDevice(deviceRef.current);
      const currentConnection = connectionRef.current;
      const currentStatus = currentConnection?.status?.() ?? null;

      if (liveDeviceCall && (!currentConnection || !isLiveCallStatus(currentStatus))) {
        connectionSourceRef.current = 'device';
        setConnection(liveDeviceCall);
      }

      const connectionAfterSync = liveDeviceCall ?? connectionRef.current;
      const reservation = activeReservationRef.current;

      if (connectionAfterSync && isLiveCallStatus(connectionAfterSync.status?.())) {
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
        clearActiveCallSession();
        setActiveCallMeta(null);
        userInCallRef.current = false;
      }
    } finally {
      syncInFlightRef.current = false;
    }
  }, [persistActiveCallMeta, user?.id]);

  const registerOutboundConnection = useCallback((conn: Call, meta?: Partial<ActiveCallSession>) => {
    connectionSourceRef.current = 'device';
    setConnection(conn);
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
  }, [persistActiveCallMeta]);

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
    async (status: string, event: OperatorPresenceEvent = 'status_change') => {
      if (!user?.id || !status) return;
      events.emit('refreshWorkerStatus', { user_id: user.id, worker_status: status });
      try {
        await broadcastOperatorPresence({ event, worker_status: status });
      } catch (error) {
        console.warn('Failed to broadcast operator presence:', error);
      }
    },
    [user?.id]
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
   * Task queues move workers to Offline/Unavailable on assignment. Conference legs do not
   * always restore Available (especially when the JS SDK fails ReservationDescriptor updates),
   * so force Available after wrap-up/completion.
   */
  const restoreWorkerToAvailable = useCallback(
    async (reason: string) => {
      if (suppressAutoAvailableRef.current) {
        logReservationState('Skipping Available restore (user chose Unavailable/Offline)', null, {
          reason,
        });
        return;
      }

      const worker = workerRef.current;
      if (!worker) return;

      const available = Array.from(worker.activities.values()).find(
        (activity) => normalizeWorkerActivityName(activity.name) === 'Available'
      );

      if (!available) {
        console.warn('Available activity not found on worker', { reason });
        try {
          await broadcastOperatorPresence({ event: 'status_change', worker_status: 'Available' });
          setActivityName('Available');
          if (user?.id) {
            events.emit('refreshWorkerStatus', { user_id: user.id, worker_status: 'Available' });
          }
        } catch (error) {
          console.warn('Failed to restore Available via presence broadcast:', error);
        }
        return;
      }

      if (available.isCurrent) {
        setActivityName('Available');
        void broadcastWorkerStatus('Available');
        return;
      }

      try {
        logReservationState('Restoring worker to Available', activeReservationRef.current, {
          reason,
          activitySid: available.sid,
        });
        await available.setAsCurrent();
        setActivityName('Available');
        void broadcastWorkerStatus('Available');
      } catch (error) {
        console.warn('Failed to set Available via TaskRouter SDK, falling back to API:', error);
        try {
          await broadcastOperatorPresence({ event: 'status_change', worker_status: 'Available' });
          setActivityName('Available');
          if (user?.id) {
            events.emit('refreshWorkerStatus', { user_id: user.id, worker_status: 'Available' });
          }
        } catch (broadcastError) {
          console.warn('Failed to restore Available via presence broadcast:', broadcastError);
        }
      }
    },
    [broadcastWorkerStatus, logReservationState, user?.id]
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
        clearActiveCallState();
      }
      void restoreWorkerToAvailable('reservation.completed');
    });
  }, [clearActiveCallState, restoreWorkerToAvailable, safeCompleteReservation, logReservationState]);

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

    const handlePageHide = () => {
      broadcastOperatorPresenceKeepalive({ event: 'offline', worker_status: 'Offline' });
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
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

        const reservationAttrs = activeReservationRef.current?.task?.attributes;
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
            const liveCall = findLiveCallOnDevice(deviceRef.current);
            if (liveCall) {
              setConnection(liveCall);
              return;
            }
            if (activeReservationRef.current) {
              clearDeviceConnectionState();
            } else {
              clearActiveCallState();
            }
          }
        });

        conn.on('reject', () => {
          console.log('Call rejected.');
          clearPendingConferenceInvite();
          expectingReservationDeviceLegRef.current = false;
          if (connectionSourceRef.current === 'device') {
            if (activeReservationRef.current) {
              clearDeviceConnectionState();
            } else {
              clearActiveCallState();
            }
          }
        });
      };

      newDevice.on('incoming', handleIncomingCall);

      newDevice.on('connect', (conn: Call) => {
        console.log('Successfully established call!', conn);
        connectionSourceRef.current = 'device';
        setConnection(conn);
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
        const liveCall = findLiveCallOnDevice(newDevice);
        if (liveCall) {
          setConnection(liveCall);
          return;
        }
        if (connectionSourceRef.current === 'device') {
          if (activeReservationRef.current) {
            clearDeviceConnectionState();
          } else {
            clearActiveCallState();
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
        if (status) void broadcastWorkerStatus(status, 'online');
      });

      newWorker.on('activityUpdated', (worker: TwilioWorker) => {
        const rawStatus = worker.activity?.name || null;
        const status = normalizeWorkerActivityName(rawStatus) || rawStatus;
        setActivityName(status);

        if (!status) return;

        // Task queues force Offline/Unavailable while reserved/assigned. Echoing that through
        // /operators/presence after hangup was marking everyone offline and undoing Available.
        if (isUnavailableLikeActivity(status)) {
          const onCall =
            Boolean(activeReservationRef.current) ||
            expectingReservationDeviceLegRef.current ||
            userInCallRef.current ||
            Boolean(findLiveCallOnDevice(deviceRef.current));

          if (onCall) {
            // Keep peers in sync while on-call (busy/unavailable state).
            void broadcastWorkerStatus(status, 'status_change');
            return;
          }

          if (suppressAutoAvailableRef.current) {
            void broadcastWorkerStatus(status, 'status_change');
            return;
          }

          console.log('TaskRouter left worker Offline/Unavailable after call; restoring Available', {
            rawStatus,
            status,
          });
          void restoreWorkerToAvailable(`activityUpdated-${status}`);
          return;
        }

        if (status === 'Available') {
          suppressAutoAvailableRef.current = false;
        }
        void broadcastWorkerStatus(status, 'status_change');
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
                statusCallbackUrl: process.env.NEXT_PUBLIC_API_URL + '/api/twilio/call-status',
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
            const fromNum = attributes.contact_name || attributes?.from;
            console.log('Extracted conference SID:', confSid);
            console.log('Extracted from number:', fromNum);

            if (confSid) setConferenceSid(confSid);
            if (fromNum) setFromNumber(fromNum);

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

        const clearReservation = () => {
          logReservationState('Clearing reservation UI state', reservation);
          stopIncomingRingSound();
          setIncomingReservation(null);
          setShowReservationModal(false);
          incomingReservationRef.current = null;
          if (!isAgentOnCall()) {
            clearActiveCallState();
          }
          try {
            if (isElectron() && window.electronAPI) {
              window.electronAPI.send('dismiss-incoming-overlay');
            }
          } catch {}
        };

        reservation.on('rescinded', () => { console.log('Reservation rescinded'); clearReservation(); });
        reservation.on('timeout', () => { console.log('Reservation timed out.'); clearReservation(); });
        reservation.on('rejected', () => { console.log('Reservation rejected.'); clearReservation();  
          if (typeof window !== 'undefined' && window.electronAPI) {
            window.electronAPI.send('successfully-rejected-call');
          }

        });
        reservation.on('canceled', () => { console.log('Reservation canceled.'); clearReservation(); });
        reservation.on('completed', () => { console.log('Reservation completed.'); clearReservation(); });
      });

    } catch (err: any) {
      console.error('Twilio setup failed:', err);
      setError('Failed to initialize Twilio. Please try again later.');
    } finally {
      setIsConnecting(false);
    }
  }, [twilio, user, isConnecting, toast, broadcastWorkerStatus, restoreWorkerToAvailable, clearActiveCallState, clearDeviceConnectionState, attachReservationLifecycleHandlers, startIncomingRing, stopIncomingRingSound, persistActiveCallMeta, isAgentOnCall, logReservationState]);

  useEffect(() => {
    if (!user?.id) return;

    const handleInCallStatus = (data: { user_id?: number | string; in_call?: number | string | boolean }) => {
      if (Number(data.user_id) !== Number(user.id) || data.in_call == null) return;

      userInCallRef.current = Boolean(Number(data.in_call));
      if (userInCallRef.current) {
        void syncActiveCallState();
      } else if (!findLiveCallOnDevice(deviceRef.current) && !activeReservationRef.current) {
        clearActiveCallState();
      }
    };

    events.on('refreshInCallStatus', handleInCallStatus);
    return () => {
      events.off('refreshInCallStatus', handleInCallStatus);
    };
  }, [user?.id, syncActiveCallState, clearActiveCallState]);

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

    return () => {
      try { offAccepted && offAccepted(); } catch {}
      try { offAcceptedHold && offAcceptedHold(); } catch {}
      try { offAcceptedEndCurrent && offAcceptedEndCurrent(); } catch {}
      try { offAcceptedMerge && offAcceptedMerge(); } catch {}
      try { offRejected && offRejected(); } catch {}
      try { offEndCall && offEndCall(); } catch {}
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

    for (const delayMs of [500, 2000, 5000]) {
      window.setTimeout(() => {
        void (async () => {
          await safeCompleteReservation(target);
          await restoreWorkerToAvailable(`finalize-${delayMs}ms`);
        })();
      }, delayMs);
    }
  }, [restoreWorkerToAvailable, safeCompleteReservation]);

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

    if (conferenceSid) {
      try {
        await endConferenceApi(conferenceSid);
      } catch (error) {
        console.warn('Failed to end conference via API:', error);
      }
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

  useEffect(() => {
    hangUpFromOverlayRef.current = () => {
      const sid =
        conferenceSidRef.current ??
        readActiveCallSession()?.conferenceSid ??
        null;
      void endCallForAll(sid);
    };
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
    setActivityName('Unavailable');
    void broadcastWorkerStatus('Unavailable', 'status_change');

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
          statusCallbackUrl: process.env.NEXT_PUBLIC_API_URL + '/api/twilio/call-status',
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
    clearActiveCallState();
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
      setActivityName(normalizedName);
      broadcastWorkerStatus(normalizedName);
    } else {
      console.error(`Activity '${newActivityName}' not found in worker.activities`);
    }
  };

  useEffect(() => {
    const currentDevice = deviceRef.current;
    const currentWorker = workerRef.current;
    return () => {
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
    connectTwilio,
    syncActiveCallState,
    registerOutboundConnection,
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
