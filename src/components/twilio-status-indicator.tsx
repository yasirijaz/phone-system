
"use client";

import { useTwilio } from '@/context/TwilioContext';
import { Button } from '@/components/ui/button';
import { Phone, UserCheck, Zap } from 'lucide-react';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export default function TwilioStatusIndicator() {
  const { isDeviceReady, isWorkerReady, isConnecting, connectTwilio } = useTwilio();

  if (isDeviceReady && isWorkerReady) {
    return (
        <TooltipProvider>
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger className="cursor-default">
                  <div className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-green-500" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center"><p>Device: Ready</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger className="cursor-default">
                   <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-green-500" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" align="center"><p>Worker: Ready</p></TooltipContent>
              </Tooltip>
            </div>
        </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger className="cursor-default">
              <div className="flex items-center gap-2">
                <Phone className={`h-5 w-5 ${isDeviceReady ? 'text-green-500' : 'text-destructive'}`} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center"><p>Device: {isDeviceReady ? 'Ready' : 'Not Ready'}</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger className="cursor-default">
               <div className="flex items-center gap-2">
                <UserCheck className={`h-5 w-5 ${isWorkerReady ? 'text-green-500' : 'text-destructive'}`} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center"><p>Worker: {isWorkerReady ? 'Ready' : 'Not Ready'}</p></TooltipContent>
          </Tooltip>
          <Button onClick={connectTwilio} disabled={isConnecting} size="sm" variant="outline">
            <Zap className="mr-2 h-4 w-4" />
            {isConnecting ? 'Connecting...' : 'Connect'}
          </Button>
        </div>
      </TooltipProvider>
  );
}
