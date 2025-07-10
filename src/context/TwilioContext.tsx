
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Device } from '@twilio/voice-sdk';
import type { Worker } from 'twilio-taskrouter';
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
  const [twilio, setTwilio] = useState<any>(null);


  useEffect(() => {
    // Dynamically import Twilio libraries only on the client-side
    const loadTwilio = async () => {
      const { Device } = await import('@twilio/voice-sdk');
      const { Worker } = await import('twilio-taskrouter');
      setTwilio({ Device, Worker });
    };
    loadTwilio();
  }, []);


  const cleanup = useCallback(() => {
    device?.disconnectAll();
    device?.destroy();
    setDevice(null);
    if(worker) {
        (worker as any).disconnect();
    }
    setWorker(null);
    setIsReady(false);
  }, [device, worker]);
  

  useEffect(() => {
    if (user && twilio) {
      const setupTwilio = async () => {
        cleanup();
        setError(null);

        try {
           const [deviceTokenRes, workerTokenRes] = await Promise.all([
            axios.post('/api/twilio/token'),
            axios.post('/api/twilio/worker-token')
          ]);
          console.log(deviceTokenRes,workerTokenRes);
          const deviceToken = deviceTokenRes.data.data.token;
          const workerToken = workerTokenRes.data.data.token;
          
          if (typeof deviceToken !== 'string' || typeof workerToken !== 'string') {
            throw new Error('Invalid token format received from server.');
          }

          const newDevice = new twilio.Device(deviceToken);
          
          newDevice.on('ready', () => {
            console.log('Twilio Device ready');
            setDevice(newDevice);
          });
          newDevice.on('error', (err: any) => {
            console.error('Twilio Device Error:', err);
            setError(`Device Error: ${err.message}`);
          });
          newDevice.on('registered', () => {
            console.log('Twilio Device registered');
          });
          
          await newDevice.register();

          const newWorker = new twilio.Worker(workerToken);

          newWorker.on('ready', (readyWorker: any) => {
            console.log('Twilio Worker ready:', readyWorker.sid);
            setWorker(readyWorker);
            setIsReady(true);
          });

          newWorker.on('error', (err: any) => {
            console.error('Twilio Worker Error:', err);
            setError(`Worker Error: ${err.message}`);
          });

        } catch (err: any) {
          console.error('Twilio setup failed:', err);
          setError('Failed to initialize Twilio. Please try again later.');
        }
      };
      
      setupTwilio();
    }

    return () => {
      cleanup();
    };
  }, [user, twilio, cleanup]);

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
