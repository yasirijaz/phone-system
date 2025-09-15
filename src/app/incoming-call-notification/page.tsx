'use client';

import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

declare global {
  interface Window {
    electronAPI?: {
      send: (channel: string, data?: any) => void;
      on: (channel: string, func: (...args: any[]) => void) => (() => void) | undefined;
    };
  }
}

export default function IncomingCallNotificationPage() {
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  const callerName = searchParams.get('callerName');

  const handleAccept = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.send('accept-call');
    }
  };

  const handleReject = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.send('reject-call');
    }
  };

  return (
    <div className="bg-gray-800 text-white p-4 flex flex-col items-center justify-center h-screen">
      <h1 className="text-lg font-bold mb-2">Incoming Call</h1>
      <p className="mb-1">From: {callerName || from}</p>
      <div className="flex gap-2 mt-4">
        <Button onClick={handleAccept} variant="secondary">Accept</Button>
        <Button onClick={handleReject} variant="destructive">Reject</Button>
      </div>
    </div>
  );
}

