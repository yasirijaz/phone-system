
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode, useRef } from 'react';
import type { Device, Call } from '@twilio/voice-sdk';
import type { Worker as TwilioWorker, Reservation } from 'twilio-taskrouter';

import axios from '@/lib/axios';
import { leaveConference as leaveConferenceApi, endConference as endConferenceApi } from '@/services/twilioService';
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
  connectTwilio: () => void;
  acceptCall: () => void;
  rejectCall: () => void;
  hangUp: () => void;
  leaveCall: (conferenceSid: string, callSid: string) => Promise<void>;
  endCallForAll: (conferenceSid?: string | null) => Promise<void>;
  acceptReservation: (reservation: Reservation) => void;
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
  const ringAudioRef = useRef<HTMLAudioElement | null>(null);
  const connectionRef = useRef<Call | null>(null);
  const userInCallRef = useRef(false);
  const incomingReservationRef = useRef<Reservation | null>(null);
  const activeReservationRef = useRef<Reservation | null>(null);
  const connectionSourceRef = useRef<'device' | 'reservation' | null>(null);
  const expectingReservationDeviceLegRef = useRef(false);
  const reservationLifecycleAttachedRef = useRef<WeakSet<Reservation>>(new WeakSet());

  useEffect(() => {
    activeReservationRef.current = activeReservation;
  }, [activeReservation]);

  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  useEffect(() => {
    userInCallRef.current = Boolean(user?.in_call);
  }, [user?.in_call]);

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

  const clearActiveCallState = useCallback(() => {
    setConnection(null);
    setActiveReservation(null);
    activeReservationRef.current = null;
    expectingReservationDeviceLegRef.current = false;
    setConferenceSid(null);
    setFromNumber(null);
    connectionSourceRef.current = null;
  }, []);

  const safeCompleteReservation = useCallback((reservation?: Reservation | null) => {
    const target = reservation ?? activeReservationRef.current;
    if (!target) return;

    const status = target.status;
    if (status === 'completed' || status === 'rejected' || status === 'canceled' || status === 'timeout' || status === 'rescinded') {
      return;
    }

    if (status === 'pending') {
      return;
    }

    if (status === 'wrapping') {
      try {
        target.complete();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('Invalid state transition')) {
          console.warn('Failed to complete reservation:', error);
        }
      }
      return;
    }

    if (status === 'accepted') {
      // Wait for TaskRouter to move the worker into wrap-up after the call leg ends.
      return;
    }
  }, []);

  const safeRejectReservation = useCallback((reservation?: Reservation | null) => {
    const target = reservation ?? activeReservationRef.current;
    if (!target) return;

    if (target.status !== 'pending') {
      return;
    }

    try {
      target.reject();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('Invalid state transition')) {
        console.warn('Failed to reject reservation:', error);
      }
    }
  }, []);

  const attachReservationLifecycleHandlers = useCallback((reservation: Reservation) => {
    if (reservationLifecycleAttachedRef.current.has(reservation)) {
      return;
    }
    reservationLifecycleAttachedRef.current.add(reservation);

    reservation.on('wrapup', () => {
      safeCompleteReservation(reservation);
    });

    reservation.on('completed', () => {
      if (activeReservationRef.current === reservation) {
        clearActiveCallState();
      }
    });
  }, [clearActiveCallState, safeCompleteReservation]);

  const clearDeviceConnectionState = useCallback(() => {
    setConnection(null);
    if (!activeReservationRef.current) {
      setConferenceSid(null);
      setFromNumber(null);
      connectionSourceRef.current = null;
    }
  }, []);

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

        const autoAccept = conn.customParameters.get('autoAccept');
        const isTransferLeg = conn.customParameters.get('transfer') === '1';
        const isReservationLeg =
          expectingReservationDeviceLegRef.current || activeReservationRef.current !== null;
        const shouldAutoAccept = isReservationLeg || isTransferLeg || autoAccept !== '0';

        if (shouldAutoAccept) {
          conn.accept();
          expectingReservationDeviceLegRef.current = false;
          if (!isReservationLeg) {
            toast({ title: "Incoming Call Accepted" });
          }
        } else {
          startIncomingRing();
        }

        const stopRingOnEnd = () => stopIncomingRingSound();
        conn.on('accept', stopRingOnEnd);
        conn.on('cancel', stopRingOnEnd);
        conn.on('disconnect', stopRingOnEnd);
        conn.on('reject', stopRingOnEnd);

        conn.on('accept', () => {
          expectingReservationDeviceLegRef.current = false;
        });

        conn.on('disconnect', () => {
          console.log('Call disconnected.');
          expectingReservationDeviceLegRef.current = false;
          if (connectionSourceRef.current === 'device') {
            clearDeviceConnectionState();
            if (!activeReservationRef.current) {
              setActiveReservation(null);
            }
          }
        });

        conn.on('reject', () => {
          console.log('Call rejected.');
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
      });

      newDevice.on('disconnect', () => {
        console.log('Call disconnected (device event).');
        if (connectionSourceRef.current === 'device') {
          clearDeviceConnectionState();
          if (!activeReservationRef.current) {
            setActiveReservation(null);
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
        const status = worker.activity?.name || null;
        setActivityName(status);
        if (status) void broadcastWorkerStatus(status, 'online');
      });

      newWorker.on('activityUpdated', (worker: TwilioWorker) => {
        const status = worker.activity?.name || null;
        setActivityName(status);
        if (status) void broadcastWorkerStatus(status, 'status_change');
      });

      newWorker.on('reservationCreated', (reservation: Reservation) => {
        console.log('Reservation created:', reservation);
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
            window.electronAPI.send('incoming-call', { from, callerName });
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

            if (typeof window !== 'undefined' && window.electronAPI) {
              window.electronAPI.send('successfully-accepted-call');
            }

          }, 500);
        });

        const clearReservation = () => {
          stopIncomingRingSound();
          setIncomingReservation(null);
          setShowReservationModal(false);
          incomingReservationRef.current = null;
          clearActiveCallState();
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
  }, [twilio, user, isConnecting, toast, broadcastWorkerStatus, clearActiveCallState, clearDeviceConnectionState, attachReservationLifecycleHandlers, startIncomingRing, stopIncomingRingSound]);

  // Listen for accept/reject actions coming back from Electron main
  useEffect(() => {
    if (!isElectron() || !window.electronAPI) return;

    const offAccepted = window.electronAPI.on('call-accepted', () => {
      const res = incomingReservationRef.current;
      if (res) {
        try {
          acceptReservation(res);
          
        } catch (e) {
          console.error('Failed to accept reservation from IPC:', e);
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
      }
    });

    return () => {
      try { offAccepted && offAccepted(); } catch {}
      try { offRejected && offRejected(); } catch {}
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
    if (!target) return;

    window.setTimeout(() => {
      if (activeReservationRef.current === target) {
        safeCompleteReservation(target);
      }
    }, 2000);
  }, [safeCompleteReservation]);

  const completeActiveReservation = () => {
    scheduleReservationFinalize();
  };

  const leaveCall = async (conferenceSid: string, callSid: string) => {
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

    completeActiveReservation();
    clearActiveCallState();
    toast({ title: 'Left call' });
  };

  const endCallForAll = async (conferenceSid?: string | null) => {
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

    completeActiveReservation();
    clearActiveCallState();
    toast({ title: 'Call Ended' });
  };

  const hangUp = () => {
    void endCallForAll(conferenceSid);
  };

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

    const attributes = reservation.task?.attributes;
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

    reservation.conference({
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
    });
  };

  const rejectReservation = (reservation: Reservation) => {
    console.log('rejecting reservation', reservation)
    stopIncomingRingSound();
    expectingReservationDeviceLegRef.current = false;
    safeRejectReservation(reservation);
    clearActiveCallState();
  };

  const completeReservation = (reservation: Reservation) => {
    console.log('completing reservation', reservation)
    safeCompleteReservation(reservation);
    clearActiveCallState();
  };

  const toggleActivity = async (selectedActivityName?: string) => {
    if (!workerRef.current) return;

    const currentActivity = workerRef.current.activity?.name;
    const newActivityName = selectedActivityName || (currentActivity === 'Available' ? 'Unavailable' : 'Available');

    const newActivity = Array.from(workerRef.current.activities.values()).find(
      (activity) => activity.name === newActivityName
    );

    if (newActivity) {
      await newActivity.setAsCurrent();
      setActivityName(newActivity.name);
      broadcastWorkerStatus(newActivity.name);
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
    connectTwilio,
    acceptCall,
    rejectCall,
    hangUp,
    leaveCall,
    endCallForAll,
    acceptReservation,
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
