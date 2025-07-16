
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode, useRef } from 'react';
import type { Device, Connection } from '@twilio/voice-sdk';
import type { Worker as TwilioWorker } from 'twilio-taskrouter';

import axios from '@/lib/axios';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';

interface TwilioContextType {
  device: Device | null;
  connection: Connection | null;
  worker: TwilioWorker | null;
  isDeviceReady: boolean;
  isWorkerReady: boolean;
  isConnecting: boolean;
  error: string | null;
  connectTwilio: () => void;
  incomingCall: Connection | null;
  acceptCall: () => void;
  rejectCall: () => void;
  clearIncomingCall: () => void;
  incomingReservation: any | null;
  acceptReservation: () => void;
  rejectReservation: () => void;
}

const TwilioContext = createContext<TwilioContextType | undefined>(undefined);

export function TwilioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const deviceRef = useRef<Device | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [worker, setWorker] = useState<TwilioWorker | null>(null);
  const [isDeviceReady, setIsDeviceReady] = useState(false);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [twilio, setTwilio] = useState<any>(null);

  const [incomingCall, setIncomingCall] = useState<Connection | null>(null);
  const [incomingReservation, setIncomingReservation] = useState<any | null>(null);

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
    if (!twilio || !user || isConnecting) return;

    setIsConnecting(true);
    setError(null);

    try {
      const [deviceTokenRes, workerTokenRes] = await Promise.all([
          axios.post('/api/twilio/token'),
          axios.post('/api/twilio/worker-token')
      ]);
      const deviceToken = deviceTokenRes.data.data.token;
      const workerToken = workerTokenRes.data.token;

      if (typeof deviceToken !== 'string') throw new Error('Invalid device token format received from server.');
      if (typeof workerToken !== 'string') throw new Error('Invalid worker token format received from server.');
      
      const newDevice = new twilio.Device(deviceToken, {
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

      newDevice.on('incoming', (conn: Connection) => {
        console.log('Incoming connection from ' + conn.parameters.From);
        setIncomingCall(conn);
      });
      
      newDevice.on('connect', (conn: Connection) => {
        console.log('Successfully established call!');
        setConnection(conn);
        setIncomingCall(null);
        setIncomingReservation(null);
      });

      newDevice.on('disconnect', () => {
        console.log('Call disconnected.');
        setConnection(null);
      });

      newDevice.register();

      const newWorker = new twilio.Worker(workerToken);

      newWorker.on('ready', (worker: TwilioWorker) => {
          console.log(`Worker ${worker.sid} is ready`);
          setWorker(worker);
          setIsWorkerReady(true);
      });

      newWorker.on('reservation.created', (reservation: any) => {
          console.log(`Reservation ${reservation.sid} created`);
          setIncomingReservation(reservation);
      });

    } catch (err: any) {
      console.error('Twilio setup failed:', err);
      setError('Failed to initialize Twilio. Please try again later.');
    } finally {
      setIsConnecting(false);
    }
  }, [twilio, user, isConnecting]);
  
  const acceptCall = () => {
    if (!incomingCall) return;
    console.log(`Accepting incoming call`);
    incomingCall.accept();
    toast({ title: "Call Accepted" });
    setConnection(incomingCall);
    setIncomingCall(null);
  }

  const rejectCall = () => {
    if (!incomingCall) return;
    console.log(`Rejecting incoming call`);
    incomingCall.reject();
    toast({ title: "Call Rejected" });
    setIncomingCall(null);
  };
  
  const acceptReservation = () => {
      if (!incomingReservation) return;
      console.log(`Accepting reservation ${incomingReservation.sid}`);
      // This is a simplified accept. A real-world scenario might involve TwiML to connect the call.
      // For now, we'll just dequeue, which accepts the task.
      incomingReservation.dequeue();
      toast({ title: "Reservation Accepted" });
      setIncomingReservation(null);
  };
  
  const rejectReservation = () => {
      if (!incomingReservation) return;
      console.log(`Rejecting reservation ${incomingReservation.sid}`);
      incomingReservation.reject();
      toast({ title: "Reservation Rejected" });
      setIncomingReservation(null);
  };

  const clearIncomingCall = () => {
    setIncomingCall(null);
  };

  useEffect(() => {
    const currentDevice = deviceRef.current;
    return () => {
      currentDevice?.disconnectAll();
      currentDevice?.destroy();
      worker?.disconnect();
    };
  }, [worker]);

  const value = {
    device: deviceRef.current,
    connection,
    worker,
    isDeviceReady,
    isWorkerReady,
    isConnecting,
    error,
    connectTwilio,
    incomingCall,
    acceptCall,
    rejectCall,
    clearIncomingCall,
    incomingReservation,
    acceptReservation,
    rejectReservation
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
