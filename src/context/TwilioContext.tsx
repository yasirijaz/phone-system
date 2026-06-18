
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode, useRef } from 'react';
import type { Device, Call } from '@twilio/voice-sdk';
import type { Worker as TwilioWorker, Reservation } from 'twilio-taskrouter';

import axios from '@/lib/axios';
import { leaveConference as leaveConferenceApi, endConference as endConferenceApi } from '@/services/twilioService';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';
import { isElectron } from '@/lib/is-electron';
import { events } from '@/lib/events';

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
  const audio = new Audio('/sounds/reservation.mp3');
  const incomingReservationRef = useRef<Reservation | null>(null);
  const activeReservationRef = useRef<Reservation | null>(null);
  const connectionSourceRef = useRef<'device' | 'reservation' | null>(null);
  const expectingReservationDeviceLegRef = useRef(false);

  useEffect(() => {
    activeReservationRef.current = activeReservation;
  }, [activeReservation]);

  const clearActiveCallState = useCallback(() => {
    setConnection(null);
    setActiveReservation(null);
    activeReservationRef.current = null;
    expectingReservationDeviceLegRef.current = false;
    setConferenceSid(null);
    setFromNumber(null);
    connectionSourceRef.current = null;
  }, []);

  const clearDeviceConnectionState = useCallback(() => {
    setConnection(null);
    if (!activeReservationRef.current) {
      setConferenceSid(null);
      setFromNumber(null);
      connectionSourceRef.current = null;
    }
  }, []);

  const broadcastWorkerStatus = useCallback(
    (status: string) => {
      if (!user?.id || !status) return;
      events.emit('refreshWorkerStatus', { user_id: user.id, worker_status: status });
    },
    [user?.id]
  );

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
        }

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
          console.log('Applied saved speaker output routes:', savedSpeakerId);
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
        if (status) broadcastWorkerStatus(status);
      });

      newWorker.on('activityUpdated', (worker: TwilioWorker) => {
        const status = worker.activity?.name || null;
        setActivityName(status);
        if (status) broadcastWorkerStatus(status);
      });

      newWorker.on('reservationCreated', (reservation: Reservation) => {
        console.log('Reservation created:', reservation);
        setIncomingReservation(reservation);
        setShowReservationModal(true);
        incomingReservationRef.current = reservation;
        // play ringtone or notification sound here
        // play in loop until accepted or rejected
        audio.loop = true;
        audio.play();
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
          setIncomingReservation(null);
          setShowReservationModal(false);
          audio.pause();
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
           audio.pause();
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
  }, [twilio, user, isConnecting, toast, broadcastWorkerStatus, clearActiveCallState, clearDeviceConnectionState]);

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
      connection.accept();
      toast({ title: "Call Accepted" });
    }
  }

  const rejectCall = () => {
    if (connection) {
      console.log(`Rejecting call`);
      connection.reject();
      toast({ title: "Call Rejected" });
      clearActiveCallState();
    }
  };

  const completeActiveReservation = () => {
    const reservation = activeReservationRef.current;
    if (reservation) {
      try {
        reservation.complete();
      } catch (error) {
        console.warn('Failed to complete reservation:', error);
      }
    }
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
    audio.pause();
    console.log('accepting reservation', reservation);

    connectionSourceRef.current = 'reservation';
    expectingReservationDeviceLegRef.current = true;
    setActiveReservation(reservation);
    activeReservationRef.current = reservation;
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
    expectingReservationDeviceLegRef.current = false;
    reservation.reject();
    clearActiveCallState();
  };

  const completeReservation = (reservation: Reservation) => {
    console.log('completing reservation', reservation)
    reservation.complete();
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
