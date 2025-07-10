
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Device } from '@twilio/voice-sdk';
import type { Worker } from 'twilio-taskrouter';
import axios from '@/lib/axios';
import { useAuth } from './AuthContext';

interface TwilioContextType {
  device: Device | null;
  worker: Worker | null;
  isDeviceReady: boolean;
  isWorkerReady: boolean;
  error: string | null;
  setupDevice: () => void;
  setupWorker: () => void;
}

const TwilioContext = createContext<TwilioContextType | undefined>(undefined);

export function TwilioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [device, setDevice] = useState<Device | null>(null);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [isDeviceReady, setIsDeviceReady] = useState(false);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [twilio, setTwilio] = useState<any>(null);


  useEffect(() => {
    const loadTwilio = async () => {
      try {
        const { Device } = await import('@twilio/voice-sdk');
        const { Worker } = await import('twilio-taskrouter');
        setTwilio({ Device, Worker });
      } catch (e) {
        console.error("Failed to load twilio modules", e)
      }
    };
    loadTwilio();
  }, []);

  const cleanupDevice = useCallback(() => {
    device?.disconnectAll();
    device?.destroy();
    setDevice(null);
    setIsDeviceReady(false);
  }, [device]);

  const cleanupWorker = useCallback(() => {
    if (worker) {
        (worker as any).disconnect();
    }
    setWorker(null);
    setIsWorkerReady(false);
  }, [worker]);

  const setupDevice = useCallback(async () => {
    if (!twilio || !user) return;
    cleanupDevice();
    try {
        const deviceTokenRes = await axios.post('/api/twilio/token');
        const deviceToken = deviceTokenRes.data.data.token;
        if (typeof deviceToken !== 'string') {
            throw new Error('Invalid device token format received from server.');
        }

        const newDevice = new twilio.Device(deviceToken, {
          closeExistingSessions: true
        });
        
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
        
        setDevice(newDevice);
    } catch (err: any) {
        console.error('Twilio device setup failed:', err);
        setError('Failed to initialize Twilio device. Please try again later.');
    }
  }, [twilio, user, cleanupDevice]);

  const setupWorker = useCallback(async () => {
    if (!twilio || !user) return;
    cleanupWorker();
    try {
        const workerTokenRes = await axios.post('/api/twilio/worker-token');
        const workerToken = workerTokenRes.data.data.token;

        if (typeof workerToken !== 'string') {
            throw new Error('Invalid worker token format received from server.');
        }

        if (!user) return;
        const newWorker = new twilio.Worker(workerToken, {
            closeExistingSessions: true,
            websocket_uri: 'wss://event-bridge.us1.twilio.com/v1/wschannels/' + user.id + '/' + user.email
        });

        newWorker.on('ready', (readyWorker: any) => {
            console.log('Twilio Worker ready:', readyWorker.sid);
            setWorker(readyWorker);
            setIsWorkerReady(true);
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
    } catch (err: any) {
        console.error('Twilio worker setup failed:', err);
        setError('Failed to initialize Twilio worker. Please try again later.');
    }
  }, [twilio, user, cleanupWorker]);

  useEffect(() => {
    if (user && twilio) {
      setError(null);
      setupDevice();
      setupWorker();
    }

    return () => {
      cleanupDevice();
      cleanupWorker();
    };
  }, [user, twilio, setupDevice, setupWorker, cleanupDevice, cleanupWorker]);

  const value = { device, worker, isDeviceReady, isWorkerReady, error, setupDevice, setupWorker };

  return <TwilioContext.Provider value={value}>{children}</TwilioContext.Provider>;
}

export function useTwilio() {
  const context = useContext(TwilioContext);
  if (context === undefined) {
    throw new Error('useTwilio must be used within a TwilioProvider');
  }
  return context;
}
