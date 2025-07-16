
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import * as TaskRouter from 'twilio-taskrouter';
import type { Device } from '@twilio/voice-sdk';

import axios from '@/lib/axios';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';

interface TwilioContextType {
  device: Device | null;
  worker: Worker | null;
  isDeviceReady: boolean;
  isWorkerReady: boolean;
  isConnecting: boolean;
  error: string | null;
  connectTwilio: () => void;
  incomingReservation: TaskRouter.Reservation | null;
  acceptReservation: () => void;
  rejectReservation: () => void;
  clearIncomingReservation: () => void;
}

const TwilioContext = createContext<TwilioContextType | undefined>(undefined);

export function TwilioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [device, setDevice] = useState<Device | null>(null);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [isDeviceReady, setIsDeviceReady] = useState(false);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [twilio, setTwilio] = useState<any>(null);
  const [incomingReservation, setIncomingReservation] = useState<TaskRouter.Reservation | null>(null);



  useEffect(() => {
    const loadTwilio = async () => {
      try {
        const { Device } = await import('@twilio/voice-sdk');
        setTwilio({ Device });
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
      // Fetch tokens
      // const formData = new FormData();
      // formData.append('user_id', '7');
      // formData.append('identity', 'Tech');
      // const deviceTokenRes = await axios.post('/api/phone/getToken', formData);
      const deviceTokenRes = await axios.post('/api/twilio/token');
      const deviceToken = deviceTokenRes.data.data.token;

      if (typeof deviceToken !== 'string') {
        throw new Error('Invalid token format received from server.');
      }

      // Cleanup existing connections before starting new ones
      if (device) {
        device.disconnectAll();
        device.destroy();
        setDevice(null);
        setIsDeviceReady(false);
      }
      if (worker) {
        (worker as any).disconnect();
        setWorker(null);
        setIsWorkerReady(false);
      }

      const newWorker = new TaskRouter.Worker(deviceToken, {
        closeExistingSessions: true,
        // debug: true, // Uncomment for debugging
      });
      console.log('Twilio Worker created:', newWorker);
      newWorker.on('ready', (readyWorker: any) => {
        console.log('Twilio Worker ready:', readyWorker.sid);
        setIsWorkerReady(true);
        setWorker(readyWorker);
      });
      newWorker.on('disconnected', () => {
        console.log('Twilio Worker disconnected');
        setIsWorkerReady(false);
      });
      newWorker.on('error', (err: any) => {
        console.error('Twilio Worker Error:', err);
        setError(`Worker Error: ${err.message}`);
        setIsWorkerReady(false);
      });
      newWorker.on('activityUpdated', (activity: any) => {
        console.log('Worker activity updated:', activity);
      });
      newWorker.on('reservationCreated', (reservation: TaskRouter.Reservation) => {
        console.log('New reservation created:', reservation.sid, reservation.task.attributes);
        setIncomingReservation(reservation);
      });
      newWorker.on("reservation.accepted", function(reservation: TaskRouter.Reservation) {
          console.log(reservation.task.attributes)      // {foo: 'bar', baz: 'bang' }
          console.log(reservation.task.priority)        // 1
          console.log(reservation.task.age)             // 300
          console.log(reservation.task.sid)             // WTxxx
          console.log(reservation.sid)                  // WRxxx
      });
      newWorker.on("reservationAccepted", function(reservation: TaskRouter.Reservation) {
          console.log(reservation.task.attributes)      // {foo: 'bar', baz: 'bang' }
          console.log(reservation.task.priority)        // 1
          console.log(reservation.task.age)             // 300
          console.log(reservation.task.sid)             // WTxxx
          console.log(reservation.sid)                  // WRxxx
      });

      // Setup Device
      const newDevice = new twilio.Device(deviceToken, {
        closeExistingSessions: true,
        codecPreferences: ['opus', 'pcmu'],
        debug: true,
      });
      newDevice.register();
      newDevice.on('registered', () => {
          console.log('Twilio Device registered');
          setIsDeviceReady(true);
      });
      newDevice.on('unregistered', () => {
        console.log('Twilio Device unregistered');
        setIsDeviceReady(false);
      });
      newDevice.on('error', (err: any) => {
        console.error('Twilio Device Error:', err);
        setError(`Device Error: ${err.message}`);
        setIsDeviceReady(false);
      });

    } catch (err: any) {
      console.error('Twilio setup failed:', err);
      setError('Failed to initialize Twilio. Please try again later.');
    } finally {
      setIsConnecting(false);
    }
  }, [twilio, user, isConnecting, device, worker]);
  const acceptReservation = () => {
    if (!incomingReservation) return;
    console.log(`Accepting reservation: ${incomingReservation.sid}`);
    incomingReservation.accept();
  }
  const rejectReservation = () => {
    if (!incomingReservation) return;
    console.log(`Rejecting reservation: ${incomingReservation.sid}`);
    incomingReservation.reject();
    toast({ title: "Call Rejected" });
    setIncomingReservation(null);
  };

  const clearIncomingReservation = () => {
    setIncomingReservation(null);
  };

  useEffect(() => {
    // Cleanup on unmount or user change
    return () => {
      if (device) {
        device.disconnectAll();
        device.destroy();
      }
      if (worker) {
        (worker as any).disconnect();
      }
    };
  }, [device, worker]);

  const value = {
    device,
    worker,
    isDeviceReady,
    isWorkerReady,
    isConnecting,
    error,
    connectTwilio,
    incomingReservation,
    acceptReservation,
    rejectReservation,
    clearIncomingReservation,
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
