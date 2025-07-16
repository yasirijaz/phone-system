
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Device, Connection } from '@twilio/voice-sdk';

import axios from '@/lib/axios';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';

interface TwilioContextType {
  device: Device | null;
  connection: Connection | null;
  isDeviceReady: boolean;
  isConnecting: boolean;
  error: string | null;
  connectTwilio: () => void;
  incomingCall: Connection | null;
  acceptCall: () => void;
  rejectCall: () => void;
  clearIncomingCall: () => void;
}

const TwilioContext = createContext<TwilioContextType | undefined>(undefined);

export function TwilioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [device, setDevice] = useState<Device | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [isDeviceReady, setIsDeviceReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [twilio, setTwilio] = useState<any>(null);
  const [incomingCall, setIncomingCall] = useState<Connection | null>(null);

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
        setDevice(null);
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
      });

      newDevice.on('disconnect', () => {
        console.log('Call disconnected.');
        setConnection(null);
      });

      newDevice.register();

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

  const clearIncomingCall = () => {
    setIncomingCall(null);
  };

  useEffect(() => {
    return () => {
      device?.disconnectAll();
      device?.destroy();
    };
  }, [device]);

  const value = {
    device,
    connection,
    isDeviceReady,
    isConnecting,
    error,
    connectTwilio,
    incomingCall,
    acceptCall,
    rejectCall,
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
