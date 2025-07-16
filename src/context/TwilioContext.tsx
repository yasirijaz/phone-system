
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import * as TaskRouter from 'twilio-taskrouter';
import type { Device } from '@twilio/voice-sdk';

import axios from '@/lib/axios';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';

interface TwilioContextType {
  device: Device | null;
  worker: TaskRouter.Worker | null;
  isDeviceReady: boolean;
  isWorkerReady: boolean;
  isConnecting: boolean;
  error: string | null;
  connectTwilio: () => void;
  incomingReservation: TaskRouter.Reservation | null;
  acceptReservation: () => void;
  rejectReservation: () => void;
  clearIncomingCall: () => void;
}

const TwilioContext = createContext<TwilioContextType | undefined>(undefined);

export function TwilioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [device, setDevice] = useState<Device | null>(null);
  const [worker, setWorker] = useState<TaskRouter.Worker | null>(null);
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
      const deviceTokenRes = await axios.post('/api/twilio/token');
      const deviceToken = deviceTokenRes.data.data.token;

      if (typeof deviceToken !== 'string') {
        throw new Error('Invalid token format received from server.');
      }

      if (device) {
        device.disconnectAll();
        device.destroy();
        setDevice(null);
        setIsDeviceReady(false);
      }
      if (worker) {
        worker.disconnect();
        setWorker(null);
        setIsWorkerReady(false);
      }

      const newWorker = new TaskRouter.Worker(deviceToken, {
        closeExistingSessions: true,
      });
      console.log('Twilio Worker created:', newWorker);
      newWorker.on('ready', (readyWorker: TaskRouter.Worker) => {
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
      newWorker.on('reservation.created', (reservation: TaskRouter.Reservation) => {
        console.log('New reservation created:', reservation.sid, reservation.task.attributes);
        setIncomingReservation(reservation);
      });
      
      const newDevice = new twilio.Device(deviceToken, {
        closeExistingSessions: true,
        codecPreferences: ['opus', 'pcmu'],
        debug: true,
      });

      newDevice.on('registered', () => {
          console.log('Twilio Device registered');
          setDevice(newDevice);
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

      newDevice.register();
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
    toast({ title: "Call Accepted" });
    setIncomingReservation(null);
  }
  const rejectReservation = () => {
    if (!incomingReservation) return;
    console.log(`Rejecting reservation: ${incomingReservation.sid}`);
    incomingReservation.reject();
    toast({ title: "Call Rejected" });
    setIncomingReservation(null);
  };

  const clearIncomingCall = () => {
    setIncomingReservation(null);
  };

  useEffect(() => {
    return () => {
      if (device) {
        device.disconnectAll();
        device.destroy();
      }
      if (worker) {
        worker.disconnect();
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
    clearIncomingCall,
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
