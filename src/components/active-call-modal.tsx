
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneOff, Mic, UserPlus, Trash2, Users } from "lucide-react";
import { addParticipant, removeParticipant } from '@/services/twilioService';
import { useToast } from '@/hooks/use-toast';
import type { Call } from '@twilio/voice-sdk';

interface ActiveCallModalProps {
  isOpen: boolean;
  contactName: string;
  onHangUp: () => void;
  connection: Call | null;
}

export default function ActiveCallModal({ isOpen, contactName, onHangUp, connection }: ActiveCallModalProps) {
  const [duration, setDuration] = useState(0);
  const [participantNumber, setParticipantNumber] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const { toast } = useToast();

  const conferenceSid = connection?.customParameters.get('conferenceSid');
  const fromNumber = connection?.customParameters.get('From');


  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen) {
      setDuration(0); // Reset timer on new call
      timer = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
      // Periodically fetch participants if in a conference
      // This is a mock-up. In a real app, you'd likely get this from a WebSocket event.
      if (conferenceSid) {
        // Mock participants for demonstration
        setParticipants([
            { call_sid: 'CA123456789012345678901234567890ab', muted: false, on_hold: false, status: 'connected' },
            { call_sid: 'CAabcdef12345678901234567890123456', muted: true, on_hold: false, status: 'connected' },
        ]);
      }

    } else {
       setParticipants([]);
    }
    
    return () => {
      clearInterval(timer);
    };
  }, [isOpen, conferenceSid]);

  const handleAddParticipant = async () => {
    if (!participantNumber || !conferenceSid || !fromNumber) {
        toast({ title: "Error", description: "Missing required information to add participant.", variant: 'destructive'});
        return;
    }
    setIsAdding(true);
    try {
        await addParticipant(conferenceSid, String(fromNumber), participantNumber);
        toast({ title: "Success", description: "Participant added to the conference."});
        setParticipantNumber('');
        // Here you would refresh the participant list in a real app, e.g., via websockets
    } catch(error) {
        toast({ title: "Error", description: "Failed to add participant.", variant: 'destructive' });
    } finally {
        setIsAdding(false);
    }
  }

  const handleRemoveParticipant = async (callSid: string) => {
    if (!conferenceSid) return;
    try {
        await removeParticipant(conferenceSid, callSid);
        toast({ title: "Success", description: "Participant removed."});
        // Here you would refresh the participant list
        setParticipants(prev => prev.filter(p => p.call_sid !== callSid));
    } catch (error) {
        toast({ title: "Error", description: "Failed to remove participant.", variant: 'destructive' });
    }
  }

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
            <p className="text-xl font-medium">{contactName}</p>
            <p className="text-muted-foreground">{connection?.parameters.From || ''}</p>
            <p className="text-muted-foreground text-lg">{formatTime(duration)}</p>
          </div>
        </div>
        
        {conferenceSid && (
            <div className="px-6 space-y-4">
                <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2"><Users className="h-4 w-4"/>Conference Participants</h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                        {participants.map(p => (
                            <div key={p.call_sid} className="flex items-center justify-between text-sm p-2 bg-muted rounded-md">
                                <span>{p.call_sid}</span>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveParticipant(p.call_sid)}>
                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                </Button>
                            </div>
                        ))}
                        {participants.length === 0 && <p className="text-xs text-muted-foreground">Just you for now.</p>}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Input 
                        placeholder="Enter phone number" 
                        value={participantNumber}
                        onChange={(e) => setParticipantNumber(e.target.value)}
                    />
                    <Button onClick={handleAddParticipant} disabled={isAdding || !participantNumber}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        {isAdding ? "Adding..." : "Add"}
                    </Button>
                </div>
            </div>
        )}

        <DialogFooter className="p-6">
          <Button variant="destructive" size="lg" onClick={onHangUp} className="w-full">
            <PhoneOff className="mr-2 h-5 w-5" />
            Hang Up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
