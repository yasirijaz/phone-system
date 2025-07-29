
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PhoneOff, Mic, MicOff, UserPlus, Trash2, Users, PauseCircle, PlayCircle } from "lucide-react";
import { addParticipant, removeParticipant, allParticipant } from '@/services/twilioService';
import { useToast } from '@/hooks/use-toast';
import type { Call } from '@twilio/voice-sdk';
import type { User } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { getUsersByCompany } from '@/services/userService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useTwilio } from '@/context/TwilioContext';

interface ActiveCallModalProps {
  isOpen: boolean;
  contactName: string;
  onHangUp: () => void;
  connection: Call | null;
  conferenceSid: string | null;
}

export default function ActiveCallModal({ isOpen, contactName, onHangUp, connection, conferenceSid }: ActiveCallModalProps) {
  const { user: authUser } = useAuth();
  const { fromNumber } = useTwilio();
  const [duration, setDuration] = useState(0);
  const [selectedParticipant, setSelectedParticipant] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const { toast } = useToast();

  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    let participantsInterval: NodeJS.Timeout | undefined;

    const fetchParticipants = async () => {
      if (!conferenceSid) return;
      try {
        const result = await allParticipant(conferenceSid);
        setParticipants(Array.isArray(result?.data) ? result.data : []);
      } catch (error) {
        console.error('Failed to fetch participants:', error);
      }
    };

    const handleMute = (muted: boolean) => setIsMuted(muted);
    
    if (isOpen && connection) {
      setDuration(0); 
      timer = setInterval(() => setDuration(prev => prev + 1), 1000);
      setIsMuted(connection.isMuted());
      connection.on('mute', handleMute);

      if (conferenceSid) {
        fetchParticipants();
        participantsInterval = setInterval(fetchParticipants, 5000);
      }
      
      const fetchUsers = async () => {
        if (authUser?.company_id) {
          setLoadingUsers(true);
          try {
            const usersResponse = await getUsersByCompany(authUser.company_id);
            setCompanyUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
          } catch (err) {
            toast({ title: "Error", description: "Failed to load company users.", variant: 'destructive' });
          } finally {
            setLoadingUsers(false);
          }
        }
      }
      fetchUsers();

    } else {
       setParticipants([]);
       setCompanyUsers([]);
       setSelectedParticipant('');
    }
    
    return () => {
      clearInterval(timer);
      clearInterval(participantsInterval);
      connection?.removeListener('mute', handleMute);
    };
  }, [isOpen, connection, conferenceSid, authUser, toast]);

  const toggleMute = () => {
    if (connection) {
      const mute = !isMuted;
      connection.mute(mute);
      setIsMuted(mute);
    }
  };

  const toggleHold = async () => {
    if (!conferenceSid || !connection?.parameters?.CallSid) return;
    const hold = !isOnHold;
    try {
        // This is a simplified approach. A robust solution would involve your backend API
        // to manage the hold state of a conference participant.
        console.log(`Setting hold to ${hold} for ${connection.parameters.CallSid} in ${conferenceSid}`);
        toast({ title: hold ? "Call on Hold" : "Call Resumed"});
        setIsOnHold(hold);
    } catch (error) {
        console.error("Failed to toggle hold state", error);
        toast({ title: "Error", description: "Could not change hold state.", variant: "destructive"});
    }
  };

  const handleAddParticipant = async () => {
    if (!selectedParticipant || !conferenceSid || !fromNumber) {
        toast({ title: "Error", description: "Missing required information to add participant.", variant: 'destructive'});
        return;
    }
    setIsAdding(true);
    try {
        await addParticipant(conferenceSid, fromNumber, selectedParticipant);
        toast({ title: "Success", description: "Participant added to the conference."});
        setSelectedParticipant('');
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

  const activeParticipantIds = participants.map(p => p.label);

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
            <p className="text-xl font-medium">
              {contactName.length > 20 ? `${contactName.slice(0, 20)}...` : contactName}</p>
            <p className="text-muted-foreground">{fromNumber || connection?.parameters.From || ''}</p>
            <p className="text-muted-foreground text-lg">{formatTime(duration)}</p>
          </div>
        </div>
        
        <div className="flex justify-center gap-4 px-6">
            <Button variant="outline" size="icon" onClick={toggleMute}>
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            <Button variant="outline" size="icon" onClick={toggleHold}>
                {isOnHold ? <PlayCircle className="h-5 w-5" /> : <PauseCircle className="h-5 w-5" />}
            </Button>
        </div>

        {conferenceSid && (
            <div className="px-6 space-y-4">
                <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2"><Users className="h-4 w-4"/>Conference Participants</h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                        {participants.map(p => (
                            <div key={p.call_sid} className="flex items-center justify-between text-sm p-2 bg-muted rounded-md">
                                <span>{p.label}</span>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveParticipant(p.call_sid)}>
                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                </Button>
                            </div>
                        ))}
                        {participants.length === 0 && <p className="text-xs text-muted-foreground">Just you for now.</p>}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Select value={selectedParticipant} onValueChange={setSelectedParticipant} disabled={loadingUsers}>
                        <SelectTrigger>
                            <SelectValue placeholder={loadingUsers ? "Loading users..." : "Select a user to add"} />
                        </SelectTrigger>
                        <SelectContent>
                            {companyUsers.map(user => (
                                <SelectItem key={user.id} value={String(user.id)} disabled={activeParticipantIds.includes(`client:${user.id}`)}>
                                    {user.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={handleAddParticipant} disabled={isAdding || !selectedParticipant}>
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
