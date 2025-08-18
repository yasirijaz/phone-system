
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { PhoneOff, Mic, MicOff, UserPlus, Pause, Play, Grip, PhoneForwarded, Circle, Users, Trash2, Delete } from "lucide-react";
import type { Call } from '@twilio/voice-sdk';
import type { User } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { getUsersByCompany } from '@/services/userService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTwilio } from '@/context/TwilioContext';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from './ui/dialog';
import { allParticipant, removeParticipant, addParticipant } from '@/services/twilioService';
import { getCallLogsBySid } from '@/services/callLogService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';

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


export default function ActiveCallBar({ isOpen, contactName, onHangUp, connection, conferenceSid }: ActiveCallBarProps) {
  const { user: authUser } = useAuth();
  const { fromNumber } = useTwilio();
  const [duration, setDuration] = useState(0);
  const [selectedParticipant, setSelectedParticipant] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(contactName);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isAddParticipantModalOpen, setIsAddParticipantModalOpen] = useState(false);
  const [isKeypadModalOpen, setIsKeypadModalOpen] = useState(false);
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  const [currentParticipants, setCurrentParticipants] = useState<any[]>([]);
  const [dialerNumber, setDialerNumber] = useState('');
  
  const dialpadKeys = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    '*', '0', '#'
  ];

   useEffect(() => {
    if (isOpen && contactName.startsWith('client:')) {
      console.log("Fetching user name for active call:", contactName);
      const fetchUserName = async () => {
        try {
          const currentCallSid = connection?.parameters?.CallSid || '';
          const matchingCall = await getCallLogsBySid(currentCallSid);
          console.log("Matching call:", matchingCall);
          if (matchingCall?.user?.name) {
            setDisplayName(matchingCall.user.name);
          } else {
            setDisplayName(contactName);
          }
        } catch (error) {
          console.error("Could not fetch user name for active call", error);
          setDisplayName(contactName); // Fallback to original name
        }
      };
      fetchUserName();
    } else {
        setDisplayName(contactName);
    }
  }, [isOpen, contactName, connection]);
  
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
  
  const fetchParticipants = async () => {
      if (!conferenceSid) return;
      try {
        const response = await allParticipant(conferenceSid);
        const participantList = Array.isArray(response?.data) ? response.data : [];
        setCurrentParticipants(participantList);
      } catch (error) {
        toast({ title: "Error", description: "Could not fetch participants.", variant: 'destructive' });
      }
    };


  useEffect(() => {
      if (isParticipantsModalOpen) {
          fetchParticipants();
      }
  }, [isParticipantsModalOpen, conferenceSid]);

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
    setIsOnHold(hold);
    toast({ title: hold ? "Call on Hold" : "Call Resumed"});
  };

  const handleAddParticipant = async () => {
    if (!selectedParticipant && !dialerNumber) {
      toast({ title: "Error", description: "Please select a user or enter a number.", variant: 'destructive' });
      return;
    }
    
    if (!connection || !conferenceSid) {
        toast({ title: "Error", description: "Cannot add participant. Active call session not found.", variant: 'destructive' });
        return;
    }

    const direction = connection.direction;
    const twilioNumber = direction === 'INCOMING' ? connection.parameters.To : connection.parameters.From;

    if (!twilioNumber) {
      toast({ title: "Error", description: "Could not determine a valid Twilio number for this call.", variant: 'destructive' });
      return;
    }

    setIsAdding(true);
    try {
        const phoneNumber = dialerNumber ? `+1${dialerNumber.replace(/\D/g, '')}` : undefined;
        const userId = selectedParticipant || undefined;
        await addParticipant(conferenceSid, twilioNumber, userId, phoneNumber);
        toast({ title: "Success", description: "Participant added to the conference." });
        setIsAddParticipantModalOpen(false);
        setDialerNumber('');
        setSelectedParticipant('');
    } catch (err) {
       toast({ title: "Error", description: "Failed to add participant.", variant: 'destructive' });
    } finally {
        setIsAdding(false);
    }
  }
  
   const handleRemoveParticipant = async (callSid: string) => {
    if (!conferenceSid) return;
    try {
      await removeParticipant(conferenceSid, callSid);
      toast({ title: "Success", description: "Participant removed." });
      fetchParticipants(); // Refresh list
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove participant.", variant: 'destructive' });
    }
  };


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

   const contactInitial = displayName ? displayName.charAt(0).toUpperCase() : '?';

   const handleDigitClick = (digit: string) => {
    setDialerNumber((prev) => prev + digit);
   };

   const handleSendDigits = (digit: string) => {
    if (connection) {
        connection.sendDigits(digit);
        toast({ title: `Sent digit: ${digit}` });
    }
   };

    const handleBackspace = () => {
        setDialerNumber((prev) => prev.slice(0, -1));
    };


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
                    <p className="font-semibold text-lg truncate max-w-[200px]">{displayName}</p>
                    <p className="text-sm text-muted-foreground">{contactName} &bull; {formatTime(duration)}</p>
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
                <Dialog open={isKeypadModalOpen} onOpenChange={setIsKeypadModalOpen}>
                    <DialogTrigger asChild>
                         <ActionButton icon={Grip} label="Keypad" />
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Keypad</DialogTitle>
                            <DialogDescription>Send DTMF tones to the call.</DialogDescription>
                        </DialogHeader>
                        <div className="grid grid-cols-3 gap-2 pt-4">
                            {dialpadKeys.map(key => (
                                <Button key={key} variant="outline" className="h-14 text-xl" onClick={() => handleSendDigits(key)}>
                                    {key}
                                </Button>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>
                <Dialog open={isAddParticipantModalOpen} onOpenChange={setIsAddParticipantModalOpen}>
                    <DialogTrigger asChild>
                         <ActionButton icon={UserPlus} label="Add" />
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Participant</DialogTitle>
                        </DialogHeader>
                        <Tabs defaultValue="internal">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="internal">Internal User</TabsTrigger>
                                <TabsTrigger value="external">Dial Number</TabsTrigger>
                            </TabsList>
                            <TabsContent value="internal" className="py-4">
                               <Select onValueChange={setSelectedParticipant} disabled={loadingUsers}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={loadingUsers ? 'Loading...' : 'Select a user'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {companyUsers.map(user => (
                                            authUser && user.id !== authUser.id && (
                                            <SelectItem key={user.id} value={String(user.id)}>
                                                {user.name}
                                            </SelectItem>
                                            )
                                        ))}
                                    </SelectContent>
                                </Select>
                            </TabsContent>
                            <TabsContent value="external" className="py-4 space-y-4">
                               <div className="relative">
                                    <Input 
                                        value={dialerNumber} 
                                        readOnly
                                        placeholder="Enter number"
                                        className="text-center text-lg pr-8"
                                    />
                                    {dialerNumber.length > 0 && (
                                        <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={handleBackspace}>
                                            <Delete className="h-4 w-4"/>
                                        </Button>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {dialpadKeys.map(key => (
                                        <Button key={key} variant="outline" className="h-14 text-xl" onClick={() => handleDigitClick(key)}>
                                            {key}
                                        </Button>
                                    ))}
                                </div>
                            </TabsContent>
                        </Tabs>
                         <Button onClick={handleAddParticipant} disabled={isAdding || (!selectedParticipant && !dialerNumber)}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Add Participant
                        </Button>
                    </DialogContent>
                </Dialog>
                <Dialog open={isParticipantsModalOpen} onOpenChange={setIsParticipantsModalOpen}>
                    <DialogTrigger asChild>
                        <ActionButton icon={Users} label="View" />
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Conference Participants</DialogTitle>
                            <DialogDescription>
                                {currentParticipants.length > 0 ? `${currentParticipants.length} participant(s) in the call.` : 'Just you for now.'}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-2">
                            {currentParticipants.map((p) => (
                                <div key={p.call_sid} className="flex items-center justify-between p-2 rounded-md border">
                                    <span>{p.label}</span>
                                    <Button variant="ghost" size="icon" onClick={() => handleRemoveParticipant(p.call_sid)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            ))}
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
