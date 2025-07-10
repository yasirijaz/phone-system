
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { Device } from '@twilio/voice-sdk';
import { Worker } from 'twilio-taskrouter';
import axios from '@/lib/axios';
import { useAuth } from './AuthContext';

interface TwilioContextType {
  device: Device | null;
  worker: Worker | null;
  isReady: boolean;
  error: string | null;
}

const TwilioContext = createContext<TwilioContextType | undefined>(undefined);

export function TwilioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [device, setDevice] = useState<Device | null>(null);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    device?.disconnectAll();
    device?.destroy();
    setDevice(null);
    worker?.disconnect();
    setWorker(null);
    setIsReady(false);
  }, [device, worker]);

  const setupTwilio = useCallback(async () => {
    if (!user) return;
    cleanup();
    setError(null);

    try {
      const [deviceTokenRes, workerTokenRes] = await Promise.all([
        axios.post<{ token: string }>('/api/twilio/token'),
        axios.post<{ token: string }>('/api/twilio/worker-token')
      ]);

      const deviceToken = deviceTokenRes.data.token;
      const workerToken = workerTokenRes.data.token;
      
      if (typeof deviceToken !== 'string' || typeof workerToken !== 'string') {
        throw new Error('Invalid token format received from server.');
      }

      const newDevice = new Device(deviceToken, {
        logLevel: process.env.NODE_ENV === 'development' ? 1 : 0,
        codecPreferences: ['opus', 'pcmu'],
      });

      newDevice.on('error', (err) => {
        console.error('Twilio Device Error:', err);
        setError(`Device Error: ${err.message}`);
      });
      newDevice.on('registered', () => {
        console.log('Twilio Device registered');
        setDevice(newDevice);
      });
      
      await newDevice.register();

      const newWorker = new Worker(workerToken);

      newWorker.on('ready', (readyWorker) => {
        console.log('Twilio Worker ready:', readyWorker.sid);
        setWorker(readyWorker);
        setIsReady(true);
      });

      newWorker.on('error', (err) => {
        console.error('Twilio Worker Error:', err);
        setError(`Worker Error: ${err.message}`);
      });

    } catch (err: any) {
      console.error('Twilio setup failed:', err);
      setError('Failed to initialize Twilio. Please try again later.');
    }
  }, [user, cleanup]);

  useEffect(() => {
    if (user) {
      setupTwilio();
    } else {
      cleanup();
    }
    
    return () => {
      cleanup();
    };
  }, [user, setupTwilio, cleanup]);

  const value = { device, worker, isReady, error };

  return <TwilioContext.Provider value={value}>{children}</TwilioContext.Provider>;
}

export function useTwilio() {
  const context = useContext(TwilioContext);
  if (context === undefined) {
    throw new Error('useTwilio must be used within a TwilioProvider');
  }
  return context;
}
