
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
  acceptCall: () => void;
  rejectCall: () => void;
  hangUp: () => void;
}

const TwilioContext = createContext<TwilioContextType | undefined>(undefined);

export function TwilioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const deviceRef = useRef<Device | null>(null);
  const workerRef = useRef<TwilioWorker | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [isDeviceReady, setIsDeviceReady] = useState(false);
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [twilio, setTwilio] = useState<any>(null);

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
    if (!twilio || !user || isConnecting || deviceRef.current) return;

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
      
      const handleIncomingCall = (conn: Connection) => {
        console.log('Incoming call received:', conn);
        setConnection(conn);

        conn.on('disconnect', () => {
          console.log('Call disconnected.');
          setConnection(null);
        });

        conn.on('reject', () => {
          console.log('Call rejected.');
          setConnection(null);
        });
      };
      
      newDevice.on('incoming', handleIncomingCall);

      newDevice.on('connect', (conn: Connection) => {
        console.log('Successfully established call!', conn);
        setConnection(conn);
      });

      newDevice.on('disconnect', () => {
        console.log('Call disconnected (device event).');
        setConnection(null);
      });
      
      await newDevice.register();

      const newWorker = new twilio.Worker(token);
      workerRef.current = newWorker;

      newWorker.on('ready', (worker: TwilioWorker) => {
          console.log(`Worker ${worker.sid} is ready`);
          setIsWorkerReady(true);
      });

    } catch (err: any) {
      console.error('Twilio setup failed:', err);
      setError('Failed to initialize Twilio. Please try again later.');
    } finally {
      setIsConnecting(false);
    }
  }, [twilio, user, isConnecting]);
  
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
        setConnection(null);
    }
  };

  const hangUp = () => {
    if (connection) {
      connection.disconnect();
      setConnection(null); // Close modal immediately for better UX
      toast({ title: "Call Ended" });
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
    isDeviceReady,
    isWorkerReady,
    isConnecting,
    error,
    connectTwilio,
    acceptCall,
    rejectCall,
    hangUp
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
