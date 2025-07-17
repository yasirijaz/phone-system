
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PhoneOff, Mic } from "lucide-react";

interface ActiveCallModalProps {
  isOpen: boolean;
  contactName: string;
  onHangUp: () => void;
}

export default function ActiveCallModal({ isOpen, contactName, onHangUp }: ActiveCallModalProps) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen) {
      setDuration(0); // Reset timer on new call
      timer = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      clearInterval(timer);
    };
  }, [isOpen]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">Call in Progress</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center p-6 space-y-4">
          <div className="relative">
             <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-primary/30 flex items-center justify-center">
                    <Mic className="h-10 w-10 text-primary" />
                </div>
            </div>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{contactName}</p>
            <p className="text-muted-foreground text-lg">{formatTime(duration)}</p>
          </div>
        </div>
        <DialogFooter className="grid grid-cols-1 gap-4">
          <Button variant="destructive" size="lg" onClick={onHangUp}>
            <PhoneOff className="mr-2 h-5 w-5" />
            Hang Up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
