
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { PhoneOff, Mic, MicOff, UserPlus, Pause, Play, Grip, PhoneForwarded, Circle } from "lucide-react";
import type { Call } from '@twilio/voice-sdk';
import type { User } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { getUsersByCompany } from '@/services/userService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTwilio } from '@/context/TwilioContext';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';

interface ActiveCallBarProps {
  isOpen: boolean;
  contactName: string;
  onHangUp: () => void;
  connection: Call | null;
  conferenceSid: string | null;
}

const ActionButton = ({ icon: Icon, label, onClick, isActive, className }: { icon: React.ElementType, label: string, onClick?: () => void, isActive?: boolean, className?: string }) => (
    <div className="flex flex-col items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onClick} className={cn("rounded-full h-12 w-12", isActive ? 'bg-muted' : '', className)}>
            <Icon className="h-6 w-6" />
        </Button>
        <span className="text-xs text-muted-foreground">{label}</span>
    </div>
);


export default function ActiveCallBar({ isOpen, contactName, onHangUp, connection }: ActiveCallBarProps) {
  const { user: authUser } = useAuth();
  const { fromNumber, addParticipant } = useTwilio();
  const [duration, setDuration] = useState(0);
  const [selectedParticipant, setSelectedParticipant] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const { toast } = useToast();

  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isAddParticipantModalOpen, setIsAddParticipantModalOpen] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;

    const handleMute = (muted: boolean) => setIsMuted(muted);
    
    if (isOpen && connection) {
      setDuration(0); 
      timer = setInterval(() => setDuration(prev => prev + 1), 1000);
      setIsMuted(connection.isMuted());
      connection.on('mute', handleMute);

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
       setCompanyUsers([]);
       setSelectedParticipant('');
    }
    
    return () => {
      clearInterval(timer);
      connection?.removeListener('mute', handleMute);
    };
  }, [isOpen, connection, authUser, toast]);

  const toggleMute = () => {
    if (connection) {
      const mute = !isMuted;
      connection.mute(mute);
      setIsMuted(mute);
    }
  };
  
  const toggleHold = async () => {
    if (!connection) return;
    const hold = !isOnHold;
    // Note: Twilio Voice JS SDK v2 does not have a direct `call.hold()` method.
    // This requires backend logic via the Conference API, which is not fully implemented here.
    // This is a placeholder for the visual state change.
    setIsOnHold(hold);
    toast({ title: hold ? "Call on Hold" : "Call Resumed"});
  };

  const handleAddParticipant = async () => {
    if (!selectedParticipant) {
      toast({ title: "Error", description: "Please select a user to add.", variant: 'destructive' });
      return;
    }
    if (!connection || !conferenceSid || !fromNumber) {
        toast({ title: "Error", description: "Cannot add participant. Active call session not found.", variant: 'destructive' });
        return;
    }

    setIsAdding(true);
    try {
        const to = `client:${selectedParticipant}`;
        await addParticipant(conferenceSid, fromNumber, to);
        toast({ title: "Success", description: "Participant added to the conference." });
        setIsAddParticipantModalOpen(false);
    } catch (err) {
        toast({ title: "Error", description: "Failed to add participant.", variant: 'destructive' });
    } finally {
        setIsAdding(false);
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const contactInitial = contactName ? contactName.charAt(0).toUpperCase() : '?';

  if (!isOpen) {
    return null;
  }
  
  const isAdmin = authUser?.role_id === 1 || authUser?.role_id === 2;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] max-w-5xl z-50">
        <div className="bg-background rounded-2xl shadow-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                 <Avatar className="h-12 w-12">
                    <AvatarFallback>{contactInitial}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold text-lg">{contactName}</p>
                    <p className="text-sm text-muted-foreground">{fromNumber} &bull; {formatTime(duration)}</p>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <ActionButton icon={isMuted ? MicOff : Mic} label="Mute" onClick={toggleMute} isActive={isMuted} />
                <ActionButton icon={isOnHold ? Play : Pause} label="Hold" onClick={toggleHold} isActive={isOnHold} />
                <ActionButton icon={PhoneForwarded} label="Transfer" />
                <div className="relative">
                    {isAdmin && <span className="absolute -top-2 right-1/2 translate-x-1/2 text-white bg-red-500 text-[10px] px-2 py-0.5 rounded-full">Admin</span>}
                    <ActionButton icon={Circle} label="Record" />
                </div>
                <ActionButton icon={Grip} label="Keypad" />
                <Dialog open={isAddParticipantModalOpen} onOpenChange={setIsAddParticipantModalOpen}>
                    <DialogTrigger asChild>
                         <ActionButton icon={UserPlus} label="Add" />
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Participant</DialogTitle>
                        </DialogHeader>
                        <div className="grid grid-cols-[1fr,auto] items-center gap-2 py-4">
                           <Select onValueChange={setSelectedParticipant} disabled={loadingUsers}>
                                <SelectTrigger>
                                    <SelectValue placeholder={loadingUsers ? 'Loading...' : 'Select a user'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {companyUsers.map(user => (
                                        <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button size="icon" onClick={handleAddParticipant} disabled={isAdding || !selectedParticipant}>
                                <UserPlus className="h-4 w-4" />
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Button size="lg" variant="destructive" className="rounded-full h-12" onClick={onHangUp}>
                <PhoneOff className="mr-2" />
                End
            </Button>
        </div>
    </div>
  );
}
