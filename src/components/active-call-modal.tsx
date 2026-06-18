
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { PhoneOff, Mic, MicOff, UserPlus, Pause, Play, Grip, PhoneForwarded, Users, Trash2, Delete, ChevronDown, ChevronUp, Phone, ArrowLeftRight, GitMerge, PhoneCall } from "lucide-react";
import type { Call } from '@twilio/voice-sdk';
import type { User, Contact, DepartmentSettings, CompanySettings } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { getUsersByCompany } from '@/services/userService';
import { getContacts } from '@/services/contactService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTwilio } from '@/context/TwilioContext';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn, formatPhoneNumber } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from './ui/dialog';
import { allParticipant, removeParticipant, addParticipant, holdParticipant, initiateConsultCall, consultSwap, consultMerge, consultSwitch, consultEnsureAgent, type ConferenceParticipant } from '@/services/twilioService';
import { getDepartmentSettings } from '@/services/departmentSettingsService';
import { getCompanySettings } from '@/services/companySettingsService';
import { getCallLogsBySid } from '@/services/callLogService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { getconferenceSid } from '@/services/phoneNumberService';

interface ActiveCallBarProps {
  isOpen: boolean;
  contactNumber: string;
  callerName: string;
  departmentName?: string | null;
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


export default function ActiveCallBar({ isOpen, contactNumber, callerName, departmentName, onHangUp, connection, conferenceSid }: ActiveCallBarProps) {
  const { user: authUser } = useAuth();
  const { fromNumber, setConferenceSid } = useTwilio();
  const [duration, setDuration] = useState(0);
  const [selectedParticipant, setSelectedParticipant] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [companyContacts, setCompanyContacts] = useState<Contact[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const { toast } = useToast();
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isAddParticipantModalOpen, setIsAddParticipantModalOpen] = useState(false);
  const [isKeypadModalOpen, setIsKeypadModalOpen] = useState(false);
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  const [currentParticipants, setCurrentParticipants] = useState<any[]>([]);
  const [dialerNumber, setDialerNumber] = useState('');
  const [departmentSettings, setDepartmentSettings] = useState<DepartmentSettings | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isConsultActionLoading, setIsConsultActionLoading] = useState(false);
  const [customerCallSid, setCustomerCallSid] = useState<string | null>(null);
  const [consultCallSid, setConsultCallSid] = useState<string | null>(null);
  const [activeExternalCallSid, setActiveExternalCallSid] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [resolvedDepartmentName, setResolvedDepartmentName] = useState<string | null>(departmentName || null);
  const [verifiedConferenceSid, setVerifiedConferenceSid] = useState<string | null>(null);
  const effectiveConferenceSid = conferenceSid || verifiedConferenceSid;
  const agentCallSid = connection?.parameters?.CallSid ?? null;
  const externalParticipants = (currentParticipants as ConferenceParticipant[]).filter(
    (participant) => !participant.is_agent && participant.call_sid !== agentCallSid
  );
  const hasConsultCall = externalParticipants.length >= 2;
  const activeExternalParticipant = externalParticipants.find((p) => p.call_sid === activeExternalCallSid)
    ?? externalParticipants.find((p) => !p.hold)
    ?? externalParticipants[0];
  
  const dialpadKeys = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    '*', '0', '#'
  ];

   useEffect(() => {
    if (isOpen && connection?.parameters?.CallSid) {
      const fetchUserName = async () => {
        try {
          const currentCallSid = connection?.parameters?.CallSid || '';
          const matchingCall = await getCallLogsBySid(currentCallSid);
          
          

          if (currentCallSid) {
            if (matchingCall?.conference_sid) {
                setVerifiedConferenceSid(matchingCall.conference_sid);
                setConferenceSid(matchingCall.conference_sid);
            }

            if (matchingCall?.customer_sid) {
              setCustomerCallSid(matchingCall.customer_sid);
            }

            if (matchingCall?.department_id) {
              const deptSettings = await getDepartmentSettings(matchingCall.department_id);
              setDepartmentSettings(deptSettings);
            }

            if (matchingCall?.department?.name) {
              setResolvedDepartmentName(matchingCall.department.name);
            } else if (departmentName) {
              setResolvedDepartmentName(departmentName);
            }

            if (matchingCall?.company_id) {
              const comSettings = await getCompanySettings(matchingCall.company_id);
              setCompanySettings(comSettings);
            }
          }
        } catch (error) {
          console.error("Could not fetch user name for active call", error);
        }
      };

      fetchUserName();
    } else {
    }

    if (!isOpen) {
      setDepartmentSettings(null);
      setCompanySettings(null);
      setResolvedDepartmentName(null);
      setCustomerCallSid(null);
      setConsultCallSid(null);
      setActiveExternalCallSid(null);
      setCurrentParticipants([]);
      setIsOnHold(false);
      setVerifiedConferenceSid(null);
    }
  }, [isOpen, contactNumber, connection, departmentName]);

  useEffect(() => {
    if (departmentName) {
      setResolvedDepartmentName(departmentName);
    }
  }, [departmentName]);
  
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;

    const handleMute = (muted: boolean) => setIsMuted(muted);
    
    if (isOpen && connection) {
      setDuration(0); 
      timer = setInterval(() => setDuration(prev => prev + 1), 1000);
      setIsMuted(connection.isMuted());
      connection.on('mute', handleMute);

      const fetchRelatedData = async () => {
        if (authUser?.company_id) {
          setLoadingUsers(true);
          try {
            const [usersResponse, contactsResponse] = await Promise.all([
              getUsersByCompany(authUser.company_id),
              getContacts(authUser.company_id)
            ]);
            setCompanyUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
            setCompanyContacts(contactsResponse || []);
          } catch (err) {
            toast({ title: "Error", description: "Failed to load company users or contacts.", variant: 'destructive' });
          } finally {
            setLoadingUsers(false);
          }
        }
      }
      fetchRelatedData();

    } else {
       setCompanyUsers([]);
       setCompanyContacts([]);
       setSelectedParticipant('');
    }
    
    return () => {
      clearInterval(timer);
      connection?.removeListener('mute', handleMute);
    };
  }, [isOpen, connection, authUser, toast]);

  useEffect(() => {
    if (!isOpen) {
      setIsCollapsed(false);
    }
  }, [isOpen]);
  
  const syncParticipantState = (participantList: ConferenceParticipant[]) => {
    setCurrentParticipants(participantList);

    const externals = participantList.filter(
      (participant) => !participant.is_agent && participant.call_sid !== agentCallSid
    );

    if (externals.length === 0) {
      return;
    }

    const primary = externals.find((participant) => participant.call_sid === customerCallSid) ?? externals[0];
    const consult = externals.find((participant) => participant.call_sid === consultCallSid)
      ?? externals.find((participant) => participant.call_sid !== primary.call_sid);

    if (primary?.call_sid) {
      setCustomerCallSid(primary.call_sid);
    }
    if (consult?.call_sid && consult.call_sid !== primary?.call_sid) {
      setConsultCallSid(consult.call_sid);
    }

    const liveActive = externals.find((participant) => !participant.hold);
    if (liveActive?.call_sid) {
      setActiveExternalCallSid(liveActive.call_sid);
      setIsOnHold(false);
    } else if (primary?.hold) {
      setActiveExternalCallSid(consult?.call_sid ?? null);
      setIsOnHold(true);
    }
  };

  const fetchParticipants = async (options: { silent?: boolean } = {}) => {
      if (!effectiveConferenceSid) return;
      try {
        const response = await allParticipant(effectiveConferenceSid);
        const participantList = Array.isArray(response?.data) ? response.data as ConferenceParticipant[] : [];
        syncParticipantState(participantList);
      } catch (error) {
        if (!options.silent) {
          toast({ title: "Error", description: "Could not fetch participants.", variant: 'destructive' });
        }
      }
    };


  useEffect(() => {
    if (!isOpen || !effectiveConferenceSid) return;
    fetchParticipants({ silent: true });
    const interval = setInterval(() => fetchParticipants({ silent: true }), 3000);
    return () => clearInterval(interval);
  }, [isOpen, effectiveConferenceSid, agentCallSid]);

  useEffect(() => {
      if (isParticipantsModalOpen) {
          fetchParticipants({ silent: true });
      }
  }, [isParticipantsModalOpen, effectiveConferenceSid]);

  useEffect(() => {
    setVerifiedConferenceSid(conferenceSid || null);
  }, [conferenceSid, agentCallSid]);

  const ensureConferenceSid = async () => {
    if (effectiveConferenceSid) {
      return effectiveConferenceSid;
    }
    const callSid = connection?.parameters?.CallSid;
    if (!callSid) {
      return null;
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await getconferenceSid(callSid);
        if (response?.conferenceSid) {
          setVerifiedConferenceSid(response.conferenceSid);
          setConferenceSid(response.conferenceSid);
          return response.conferenceSid;
        }
      } catch (error) {
        // retry a few times because conference SID may not be persisted yet
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    return null;
  };

  const toggleMute = () => {
    if (!connection?.mute) return;
    const mute = !isMuted;
    connection.mute(mute);
    setIsMuted(mute);
  };
  
  const toggleHold = async () => {
    if (!connection) return;

    const sid = await ensureConferenceSid();
    if (!sid) {
      toast({ title: "Error", description: "Cannot update hold. Active conference session not found.", variant: 'destructive' });
      return;
    }

    const targetSid = activeExternalParticipant?.call_sid || customerCallSid || connection.parameters.CallSid;
    const hold = !activeExternalParticipant?.hold;

    try {
        await holdParticipant(sid, targetSid, hold);
        await consultEnsureAgent(sid);
        setIsOnHold(hold);
        if (hold) {
          setActiveExternalCallSid(consultCallSid);
        } else {
          setActiveExternalCallSid(targetSid);
        }
        await fetchParticipants({ silent: true });
        toast({ title: hold ? "Caller on Hold" : "Caller Resumed"});
    } catch (err) {
        toast({ title: "Error", description: "Failed to toggle hold status.", variant: 'destructive' });
    }
  };

  const handleConsultSwap = async () => {
    const sid = await ensureConferenceSid();
    if (!sid) return;
    setIsConsultActionLoading(true);
    try {
      const result = await consultSwap(sid);
      if (!result?.status) {
        throw new Error(result?.msg || 'Failed to swap calls.');
      }
      await consultEnsureAgent(sid);
      await fetchParticipants({ silent: true });
      toast({ title: "Calls swapped", description: "You are now talking to the other caller." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to swap calls.';
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsConsultActionLoading(false);
    }
  };

  const handleConsultMerge = async () => {
    const sid = await ensureConferenceSid();
    if (!sid) return;
    setIsConsultActionLoading(true);
    try {
      const result = await consultMerge(sid);
      if (!result?.status) {
        throw new Error(result?.msg || 'Failed to merge calls.');
      }
      setIsOnHold(false);
      setConsultCallSid(null);
      await fetchParticipants({ silent: true });
      toast({ title: "Calls merged", description: "All callers are now connected." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to merge calls.';
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsConsultActionLoading(false);
    }
  };

  const handleSwitchToCall = async (targetCallSid: string) => {
    const sid = await ensureConferenceSid();
    if (!sid) return;
    setIsConsultActionLoading(true);
    try {
      const result = await consultSwitch(sid, targetCallSid);
      if (!result?.status) {
        throw new Error(result?.msg || 'Failed to switch calls.');
      }
      await consultEnsureAgent(sid);
      setActiveExternalCallSid(targetCallSid);
      setIsOnHold(false);
      await fetchParticipants({ silent: true });
      toast({ title: "Switched call", description: "The other caller is now on hold." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to switch calls.';
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsConsultActionLoading(false);
    }
  };

  const handleParticipantHoldToggle = async (participant: ConferenceParticipant) => {
    const sid = await ensureConferenceSid();
    if (!sid) return;
    try {
      if (!participant.hold) {
        await consultSwitch(sid, participant.call_sid);
      } else {
        await holdParticipant(sid, participant.call_sid, false);
        await consultEnsureAgent(sid);
      }
      await fetchParticipants({ silent: true });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update hold status.", variant: "destructive" });
    }
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitForTransferAnswer = async (conferenceSid: string, targetCallSid: string, maxWaitMs = 45000) => {
    const started = Date.now();
    while (Date.now() - started < maxWaitMs) {
      try {
        const response = await allParticipant(conferenceSid);
        const participants = Array.isArray(response?.data) ? response.data as ConferenceParticipant[] : [];
        const target = participants.find((participant) => participant.call_sid === targetCallSid);
        if (target?.call_status === 'in-progress') {
          return true;
        }
      } catch {
        // Keep polling until timeout.
      }
      await sleep(2000);
    }
    return false;
  };

  const completeWarmTransfer = async (conferenceSid: string, targetCallSid: string) => {
    const myCallSid = connection?.parameters?.CallSid;
    if (!myCallSid) {
      throw new Error('Active call session not found.');
    }

    toast({
      title: 'Transferring',
      description: 'Waiting for your colleague to join the call...',
    });

    const answered = await waitForTransferAnswer(conferenceSid, targetCallSid);

    if (answered) {
      await removeParticipant(conferenceSid, myCallSid);
      toast({
        title: 'Transfer complete',
        description: 'Your colleague is now connected with the customer.',
      });
      onHangUp();
      return;
    }

    try {
      await removeParticipant(conferenceSid, targetCallSid);
    } catch {
      // Target leg may have already ended.
    }

    await holdParticipant(conferenceSid, myCallSid, false);
    toast({
      title: 'Transfer failed',
      description: 'Your colleague did not answer. You are still on the call with the customer.',
      variant: 'destructive',
    });
  };

  const handleAddParticipant = async () => {
    if (!selectedParticipant && !dialerNumber) {
      toast({ title: "Error", description: "Please select a user or enter a number.", variant: 'destructive' });
      return;
    }

    if (isTransferring && !selectedParticipant) {
      toast({
        title: "Transfer unavailable",
        description: "Please select an internal colleague to transfer this call.",
        variant: 'destructive',
      });
      return;
    }
    
    if (!connection) {
        toast({ title: "Error", description: "Cannot add participant. Active call session not found.", variant: 'destructive' });
        return;
    }

    const sid = await ensureConferenceSid();
    if (!sid) {
      toast({ title: "Error", description: "Cannot add participant. Conference session not ready yet.", variant: 'destructive' });
      return;
    }

    const savedFromNumber = localStorage.getItem("twilioFromNumber");

    const twilioNumber = connection.direction === 'INCOMING' ? connection.parameters.To : savedFromNumber;

    if (!twilioNumber) {
      toast({ title: "Error", description: "Could not determine a valid Twilio number for this call.", variant: 'destructive' });
      return;
    }

    setIsAdding(true);
    try {
        const phoneNumber = dialerNumber ? `+1${dialerNumber.replace(/\D/g, '')}` : undefined;
        const userId = selectedParticipant || undefined;

        if (isTransferring && userId) {
          await holdParticipant(sid, connection.parameters.CallSid, true);
          setIsOnHold(true);

          const response = await addParticipant(sid, twilioNumber, userId, undefined, { transfer: true });
          const targetCallSid = response?.data?.call_sid;

          if (!response?.status || !targetCallSid) {
            await holdParticipant(sid, connection.parameters.CallSid, false);
            setIsOnHold(false);
            throw new Error(response?.msg || 'Failed to reach your colleague.');
          }

          setIsAddParticipantModalOpen(false);
          setDialerNumber('');
          setSelectedParticipant('');
          setIsTransferring(false);

          await completeWarmTransfer(sid, targetCallSid);
          return;
        }
        
        const response = phoneNumber
          ? await initiateConsultCall(sid, twilioNumber, phoneNumber)
          : await addParticipant(sid, twilioNumber, userId, phoneNumber);

        if (response?.data?.conference_sid) {
          setVerifiedConferenceSid(response.data.conference_sid);
          setConferenceSid(response.data.conference_sid);
        }

        if (phoneNumber && response?.consult) {
          if (response.consult.primary_call_sid) {
            setCustomerCallSid(response.consult.primary_call_sid);
          }
          if (response.consult.consult_call_sid) {
            setConsultCallSid(response.consult.consult_call_sid);
          }
          await consultEnsureAgent(sid);
          await fetchParticipants({ silent: true });
          toast({
            title: "Second call started",
            description: "The first caller is on hold. Use Swap or Switch when the new caller answers.",
          });
        }

        setIsAddParticipantModalOpen(false);
        setDialerNumber('');
        setSelectedParticipant('');
        setIsTransferring(false);
    } catch (err: any) {
       toast({
         title: isTransferring ? "Transfer failed" : "Error",
         description: err?.response?.data?.msg || err?.message || "Failed to add participant.",
         variant: 'destructive',
       });
       setIsTransferring(false);
    } finally {
        setIsAdding(false);
    }
  }
  
  const handleRemoveParticipant = async (callSid: string) => {
    const sid = await ensureConferenceSid();
    if (!sid) return;
    try {
      await removeParticipant(sid, callSid);
      toast({ title: "Success", description: "Participant removed." });
      fetchParticipants(); // Refresh list
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove participant.", variant: 'destructive' });
    }
  };

  const handleTransferClick = () => {
    setIsTransferring(true);
    setIsAddParticipantModalOpen(true);
  };


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const contactInitial = callerName ? callerName.charAt(0).toUpperCase() : '?';

  const handleDigitClick = (digit: string) => {
  setDialerNumber((prev) => prev + digit);
  };

  const handleSendDigits = (digit: string) => {
  if (connection?.sendDigits) {
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

  const floatingToggle = (
    <button
      type="button"
      onClick={() => setIsCollapsed((prev) => !prev)}
      className="fixed bottom-4 right-4 z-[110] flex items-center gap-2.5 rounded-full bg-background px-4 py-2.5 shadow-2xl ring-1 ring-border hover:bg-muted/50 transition-colors"
      aria-label={isCollapsed ? 'Expand active call controls' : 'Collapse active call controls'}
    >
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
      </span>
      <Phone className="h-4 w-4 text-green-600" />
      <span className="font-mono text-sm font-semibold tabular-nums">{formatTime(duration)}</span>
      {isCollapsed ? (
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );

  if (isCollapsed) {
    return floatingToggle;
  }

  return (
    <>
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] max-w-5xl z-[100]">
        <div className="bg-background rounded-2xl shadow-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                 <Avatar className="h-12 w-12">
                    <AvatarFallback>{contactInitial}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold text-lg truncate max-w-[200px]">{callerName}</p>
                    
                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                    {contactNumber?.toLowerCase().startsWith("client:")
                      ? contactNumber.length > 20
                        ? contactNumber.substring(0, 20) + "..."
                        : contactNumber
                      : formatPhoneNumber(contactNumber)
                    }
                       &bull; {formatTime(duration)}</p>
                    {resolvedDepartmentName ? (
                      <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                        Department: {resolvedDepartmentName}
                      </p>
                    ) : null}
                </div>
            </div>

            <div className="flex items-center gap-4">
                <ActionButton icon={isMuted ? MicOff : Mic} label="Mute" onClick={toggleMute} isActive={isMuted} />
                <ActionButton icon={isOnHold ? Play : Pause} label="Hold" onClick={toggleHold} isActive={isOnHold} />
                {hasConsultCall ? (
                  <>
                    <ActionButton
                      icon={ArrowLeftRight}
                      label="Swap"
                      onClick={handleConsultSwap}
                      isActive={isConsultActionLoading}
                    />
                    <ActionButton
                      icon={GitMerge}
                      label="Merge"
                      onClick={handleConsultMerge}
                      isActive={isConsultActionLoading}
                    />
                  </>
                ) : null}
                <ActionButton icon={PhoneForwarded} label="Transfer" onClick={handleTransferClick} />
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
                <Dialog open={isAddParticipantModalOpen} onOpenChange={(open) => { setIsAddParticipantModalOpen(open); if (!open) setIsTransferring(false); }}>
                    <DialogTrigger asChild>
                         <ActionButton icon={UserPlus} label="Add" />
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{isTransferring ? 'Transfer Call' : 'Add Participant'}</DialogTitle>
                            {isTransferring ? (
                              <DialogDescription>
                                Select a colleague. The customer will be placed on hold until they answer.
                              </DialogDescription>
                            ) : null}
                        </DialogHeader>
                        <Tabs defaultValue="internal">
                            <TabsList className={`grid w-full ${isTransferring ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                <TabsTrigger value="internal">Internal User</TabsTrigger>
                                {!isTransferring ? (
                                  <TabsTrigger value="external">Dial Number</TabsTrigger>
                                ) : null}
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
                            {!isTransferring ? (
                            <TabsContent value="external" className="py-4 space-y-4">
                               <Select onValueChange={setDialerNumber} disabled={loadingUsers}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={loadingUsers ? 'Loading contacts...' : 'Select a contact'} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {companyContacts.map(contact => (
                                            <SelectItem key={contact.id} value={contact.phone_no}>
                                                {contact.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                               <div className="relative">
                                    <Input 
                                        value={dialerNumber}
                                        onChange={(e) => setDialerNumber(e.target.value)}
                                        placeholder="Or enter number manually"
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
                            ) : null}
                        </Tabs>
                         <Button onClick={handleAddParticipant} disabled={isAdding || (!selectedParticipant && !dialerNumber)}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            {isTransferring ? 'Transfer Call' : 'Add Participant'}
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
                            {currentParticipants.map((p: ConferenceParticipant) => (
                                <div key={p.call_sid} className="flex items-center justify-between p-2 rounded-md border">
                                    <div className="flex flex-col min-w-0">
                                      <span className="truncate">{p.label}</span>
                                      {p.is_agent ? (
                                        <span className="text-xs text-muted-foreground">You</span>
                                      ) : p.hold ? (
                                        <span className="text-xs text-amber-600">On hold</span>
                                      ) : (
                                        <span className="text-xs text-green-600">Active</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {!p.is_agent ? (
                                        <>
                                          <Button
                                            variant={p.call_sid === activeExternalCallSid && !p.hold ? "secondary" : "ghost"}
                                            size="sm"
                                            onClick={() => handleSwitchToCall(p.call_sid)}
                                            disabled={isConsultActionLoading || (!p.hold && p.call_sid === activeExternalCallSid)}
                                          >
                                            <PhoneCall className="h-4 w-4 mr-1" />
                                            Switch
                                          </Button>
                                          <Button variant="ghost" size="icon" onClick={() => handleParticipantHoldToggle(p)}>
                                            {p.hold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                                          </Button>
                                        </>
                                      ) : null}
                                      {!p.is_agent ? (
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveParticipant(p.call_sid)}>
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      ) : null}
                                    </div>
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
    {floatingToggle}
    </>
  );
}
