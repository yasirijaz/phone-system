
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { PhoneOff, Mic, MicOff, UserPlus, Pause, Play, Grip, PhoneForwarded, Users, Trash2, Delete, ChevronDown, ChevronUp, Phone, ArrowLeftRight, GitMerge, PhoneCall, X } from "lucide-react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { allParticipant, removeParticipant, addParticipant, holdParticipant, initiateConsultCall, consultSwap, consultMerge, consultSwitch, consultEnsureAgent, type ConferenceParticipant } from '@/services/twilioService';
import { getDepartmentSettings } from '@/services/departmentSettingsService';
import { getCompanySettings } from '@/services/companySettingsService';
import { getCallLogsBySid } from '@/services/callLogService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { getconferenceSid } from '@/services/phoneNumberService';
import {
  getParticipantConnectionStatus,
  getParticipantStatusLabel,
  isParticipantRinging,
  resolveParticipantDisplayName,
  type PendingOutgoingParticipant,
} from '@/lib/conference-participants';

interface ActiveCallBarProps {
  isOpen: boolean;
  contactNumber: string;
  callerName: string;
  departmentName?: string | null;
  onLeaveCall: (conferenceSid: string, callSid: string) => Promise<void>;
  onEndCallForAll: (conferenceSid?: string | null) => Promise<void>;
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


export default function ActiveCallBar({ isOpen, contactNumber, callerName, departmentName, onLeaveCall, onEndCallForAll, connection, conferenceSid }: ActiveCallBarProps) {
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
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [pendingOutgoing, setPendingOutgoing] = useState<PendingOutgoingParticipant | null>(null);
  const [pendingTransferCallSid, setPendingTransferCallSid] = useState<string | null>(null);
  const effectiveConferenceSid = conferenceSid || verifiedConferenceSid;
  const agentCallSid = connection?.parameters?.CallSid ?? null;
  const externalParticipants = (currentParticipants as ConferenceParticipant[]).filter(
    (participant) => !participant.is_agent && participant.call_sid !== agentCallSid
  );
  const otherAgents = (currentParticipants as ConferenceParticipant[]).filter(
    (participant) => participant.is_agent && participant.call_sid !== agentCallSid
  );
  const canSwitchBetweenCalls = externalParticipants.length >= 2;
  const hasConsultCall = canSwitchBetweenCalls;
  const activeExternalParticipant = externalParticipants.find((p) => p.call_sid === activeExternalCallSid)
    ?? externalParticipants.find((p) => !p.hold)
    ?? externalParticipants[0];
  const hasRingingParticipant = externalParticipants.some((participant) => isParticipantRinging(participant));
  const showCallLegs = canSwitchBetweenCalls || hasRingingParticipant || Boolean(pendingOutgoing) || Boolean(pendingTransferCallSid);
  const shouldPollParticipantsQuickly = hasRingingParticipant || Boolean(pendingOutgoing) || Boolean(pendingTransferCallSid);
  const participantUserIds = new Set(
    (currentParticipants as ConferenceParticipant[])
      .map((participant) => participant.user_id)
      .filter((id): id is number => Boolean(id))
  );
  const availableUsersToAdd = companyUsers.filter(
    (user) => authUser && user.id !== authUser.id && !participantUserIds.has(user.id)
  );
  
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
      setPendingOutgoing(null);
      setPendingTransferCallSid(null);
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

    if (pendingOutgoing) {
      const pendingParticipant = participantList.find((participant) => participant.call_sid === pendingOutgoing.callSid);
      if (pendingParticipant) {
        const pendingStatus = getParticipantConnectionStatus(pendingParticipant);
        if (pendingStatus === 'connected' || pendingStatus === 'ended') {
          setPendingOutgoing(null);
        }
      }
    }

    if (pendingTransferCallSid) {
      const transferParticipant = participantList.find((participant) => participant.call_sid === pendingTransferCallSid);
      if (transferParticipant) {
        const transferStatus = getParticipantConnectionStatus(transferParticipant);
        if (transferStatus === 'connected' || transferStatus === 'ended') {
          setPendingTransferCallSid(null);
        }
      }
    }

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
    const intervalMs = shouldPollParticipantsQuickly ? 1000 : 3000;
    const interval = setInterval(() => fetchParticipants({ silent: true }), intervalMs);
    return () => clearInterval(interval);
  }, [isOpen, effectiveConferenceSid, agentCallSid, shouldPollParticipantsQuickly]);

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

  const resolveOutgoingTargetName = (userId?: string, phoneNumber?: string) => {
    if (userId) {
      const user = companyUsers.find((entry) => String(entry.id) === userId);
      return user?.name || 'Colleague';
    }

    if (phoneNumber) {
      const contact = companyContacts.find((entry) => entry.phone_no === phoneNumber);
      if (contact?.name) {
        return contact.name;
      }
      return formatPhoneNumber(phoneNumber);
    }

    return 'Participant';
  };

  const handleCancelOutgoingCall = async (callSid: string, participantName?: string) => {
    const sid = await ensureConferenceSid();
    if (!sid) return;

    try {
      await removeParticipant(sid, callSid);
      if (consultCallSid === callSid) {
        setConsultCallSid(null);
      }
      if (pendingOutgoing?.callSid === callSid) {
        setPendingOutgoing(null);
      }
      if (pendingTransferCallSid === callSid) {
        setPendingTransferCallSid(null);
      }
      await fetchParticipants({ silent: true });
      toast({
        title: 'Call canceled',
        description: participantName
          ? `Stopped ringing ${participantName}.`
          : 'The outgoing call was canceled.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to cancel the outgoing call.',
        variant: 'destructive',
      });
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
        if (target && getParticipantConnectionStatus(target) === 'connected') {
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
      setPendingTransferCallSid(null);
      setPendingOutgoing(null);
      toast({
        title: 'Transfer complete',
        description: 'Your colleague is now connected with the customer.',
      });
      await onLeaveCall(conferenceSid, myCallSid);
      return;
    }

    try {
      await removeParticipant(conferenceSid, targetCallSid);
    } catch {
      // Target leg may have already ended.
    }

    setPendingTransferCallSid(null);
    setPendingOutgoing(null);

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

          const transferTargetName = resolveOutgoingTargetName(userId);
          setPendingTransferCallSid(targetCallSid);
          setPendingOutgoing({
            callSid: targetCallSid,
            name: transferTargetName,
            startedAt: Date.now(),
          });

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

        const outgoingCallSid = response?.data?.call_sid;
        const outgoingName = resolveOutgoingTargetName(userId, phoneNumber || dialerNumber);

        if (response?.data?.conference_sid) {
          setVerifiedConferenceSid(response.data.conference_sid);
          setConferenceSid(response.data.conference_sid);
        }

        if (outgoingCallSid) {
          setConsultCallSid(outgoingCallSid);
          setPendingOutgoing({
            callSid: outgoingCallSid,
            name: outgoingName,
            startedAt: Date.now(),
          });
        }

        if (phoneNumber && response?.consult) {
          if (response.consult.primary_call_sid) {
            setCustomerCallSid(response.consult.primary_call_sid);
          }
          if (response.consult.consult_call_sid) {
            const consultSid = response.consult.consult_call_sid as string;
            setConsultCallSid(consultSid);
            setPendingOutgoing({
              callSid: consultSid,
              name: outgoingName,
              startedAt: Date.now(),
            });
          }
          await consultEnsureAgent(sid);
          await fetchParticipants({ silent: true });
          toast({
            title: "Second call started",
            description: `${outgoingName} is ringing. The first caller is on hold.`,
          });
        } else if (userId) {
          await fetchParticipants({ silent: true });
          toast({
            title: "Calling colleague",
            description: `${outgoingName} is ringing. You can cancel from the call legs panel.`,
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


  const handleEndClick = () => {
    if (otherAgents.length > 0 && effectiveConferenceSid && agentCallSid) {
      setIsEndDialogOpen(true);
      return;
    }

    void handleEndCallForAll();
  };

  const handleEndCallForAll = async () => {
    setIsEndingCall(true);
    try {
      await onEndCallForAll(effectiveConferenceSid);
    } finally {
      setIsEndingCall(false);
      setIsEndDialogOpen(false);
    }
  };

  const handleLeaveCall = async () => {
    if (!effectiveConferenceSid || !agentCallSid) {
      await handleEndCallForAll();
      return;
    }

    setIsEndingCall(true);
    try {
      await onLeaveCall(effectiveConferenceSid, agentCallSid);
    } finally {
      setIsEndingCall(false);
      setIsEndDialogOpen(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const contactInitial = callerName ? callerName.charAt(0).toUpperCase() : '?';

  const renderParticipantStatusBadge = (status: ReturnType<typeof getParticipantConnectionStatus>) => {
    const label = getParticipantStatusLabel(status);
    if (status === 'ringing') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-600" />
          </span>
          {label}
        </span>
      );
    }
    if (status === 'connected') {
      return <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">{label}</span>;
    }
    if (status === 'on-hold') {
      return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{label}</span>;
    }
    return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{label}</span>;
  };

  const renderCallLeg = (
    key: string,
    name: string,
    status: ReturnType<typeof getParticipantConnectionStatus>,
    options: {
      callSid?: string;
      canCancel?: boolean;
      canSwitch?: boolean;
      canHold?: boolean;
      participant?: ConferenceParticipant;
    } = {}
  ) => (
    <div key={key} className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <div className="mt-1">{renderParticipantStatusBadge(status)}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {options.canSwitch && options.participant ? (
          <Button
            variant={options.participant.call_sid === activeExternalCallSid && !options.participant.hold ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleSwitchToCall(options.participant!.call_sid)}
            disabled={isConsultActionLoading || (!options.participant.hold && options.participant.call_sid === activeExternalCallSid)}
          >
            <PhoneCall className="h-4 w-4 mr-1" />
            Switch
          </Button>
        ) : null}
        {options.canHold && options.participant ? (
          <Button variant="ghost" size="icon" onClick={() => handleParticipantHoldToggle(options.participant!)}>
            {options.participant.hold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
        ) : null}
        {options.canCancel && options.callSid ? (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => void handleCancelOutgoingCall(options.callSid!, name)}
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );

  const visibleExternalLegs = externalParticipants.map((participant) => {
    const status = getParticipantConnectionStatus(participant);
    const name = resolveParticipantDisplayName(participant, companyUsers, companyContacts);
    return renderCallLeg(participant.call_sid, name, status, {
      callSid: participant.call_sid,
      canCancel: status === 'ringing' || status === 'connecting',
      canSwitch: canSwitchBetweenCalls && (status === 'connected' || status === 'on-hold'),
      canHold: canSwitchBetweenCalls && (status === 'connected' || status === 'on-hold'),
      participant,
    });
  });

  const pendingLeg = pendingOutgoing && !externalParticipants.some((participant) => participant.call_sid === pendingOutgoing.callSid)
    ? renderCallLeg(
        `pending-${pendingOutgoing.callSid}`,
        pendingOutgoing.name,
        'ringing',
        { callSid: pendingOutgoing.callSid, canCancel: true }
      )
    : null;

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
        <div className="bg-background rounded-2xl shadow-2xl overflow-hidden">
            {showCallLegs ? (
              <div className="border-b bg-muted/30 px-4 py-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Call legs</p>
                  {hasRingingParticipant || pendingOutgoing ? (
                    <span className="text-xs text-amber-700">Outgoing call in progress</span>
                  ) : null}
                </div>
                <div className="space-y-2">
                  {visibleExternalLegs}
                  {pendingLeg}
                </div>
              </div>
            ) : null}
            <div className="p-4 flex items-center justify-between gap-4">
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
                <Dialog open={isAddParticipantModalOpen} onOpenChange={(open) => {
                  setIsAddParticipantModalOpen(open);
                  if (!open) {
                    setIsTransferring(false);
                    setSelectedParticipant('');
                    setDialerNumber('');
                  }
                }}>
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
                               {availableUsersToAdd.length === 0 ? (
                                 <p className="text-sm text-muted-foreground">
                                   No colleagues available to add. Everyone else is already on this call.
                                 </p>
                               ) : (
                                 <Select value={selectedParticipant} onValueChange={setSelectedParticipant} disabled={loadingUsers}>
                                      <SelectTrigger>
                                          <SelectValue placeholder={loadingUsers ? 'Loading...' : 'Select a user'} />
                                      </SelectTrigger>
                                      <SelectContent>
                                          {availableUsersToAdd.map(user => (
                                              <SelectItem key={user.id} value={String(user.id)}>
                                                  {user.name}
                                              </SelectItem>
                                          ))}
                                      </SelectContent>
                                  </Select>
                               )}
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
                            {currentParticipants.map((p: ConferenceParticipant) => {
                              const status = getParticipantConnectionStatus(p);
                              const name = resolveParticipantDisplayName(p, companyUsers, companyContacts);
                              return (
                                <div key={p.call_sid} className="flex items-center justify-between p-2 rounded-md border">
                                    <div className="flex flex-col min-w-0">
                                      <span className="truncate">{name}</span>
                                      {p.is_agent ? (
                                        <span className="text-xs text-muted-foreground">You</span>
                                      ) : (
                                        <div className="mt-1">{renderParticipantStatusBadge(status)}</div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {!p.is_agent && (status === 'ringing' || status === 'connecting') ? (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="text-destructive hover:text-destructive"
                                          onClick={() => void handleCancelOutgoingCall(p.call_sid, name)}
                                        >
                                          <X className="h-4 w-4 mr-1" />
                                          Cancel
                                        </Button>
                                      ) : null}
                                      {!p.is_agent && canSwitchBetweenCalls && (status === 'connected' || status === 'on-hold') ? (
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
                                      {!p.is_agent && status !== 'ringing' && status !== 'connecting' ? (
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveParticipant(p.call_sid)}>
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      ) : null}
                                    </div>
                                </div>
                              );
                            })}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Button size="lg" variant="destructive" className="rounded-full h-12" onClick={handleEndClick} disabled={isEndingCall}>
                <PhoneOff className="mr-2" />
                End
            </Button>

            <AlertDialog open={isEndDialogOpen} onOpenChange={setIsEndDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Leave or end this call?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Another agent is on this call. You can leave and let them continue with the customer, or end the call for everyone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isEndingCall}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isEndingCall}
                    onClick={(event) => {
                      event.preventDefault();
                      void handleLeaveCall();
                    }}
                  >
                    Leave call
                  </AlertDialogAction>
                  <AlertDialogAction
                    disabled={isEndingCall}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={(event) => {
                      event.preventDefault();
                      void handleEndCallForAll();
                    }}
                  >
                    End for everyone
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>
        </div>
    </div>
    {floatingToggle}
    </>
  );
}
