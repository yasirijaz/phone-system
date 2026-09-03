
'use client';

import { useState, useEffect, useRef, useMemo, type PointerEvent } from 'react';
import { Button } from "@/components/ui/button";
import { PhoneOff, Mic, MicOff, UserPlus, Pause, Play, Grip, Users, Trash2, Delete, ChevronDown, ChevronUp, Phone, ArrowLeftRight, GitMerge, PhoneCall, X, Search } from "lucide-react";
import type { Call } from '@twilio/voice-sdk';
import type { User, Contact, DepartmentSettings, CompanySettings, Operator } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { getContacts } from '@/services/contactService';
import { getOperators } from '@/services/departmentService';
import { getUsersByCompany } from '@/services/userService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTwilio } from '@/context/TwilioContext';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn, formatPhoneNumber } from '@/lib/utils';
import { isPlaceholderCallerName, pickDisplayablePhoneNumber } from '@/lib/call-party-display';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { allParticipant, removeParticipant, addParticipant, holdParticipant, initiateConsultCall, consultSwap, consultMerge, consultSwitch, consultEnsureAgent, type ConferenceParticipant } from '@/services/twilioService';
import { getDepartmentSettings } from '@/services/departmentSettingsService';
import { getCompanySettings } from '@/services/companySettingsService';
import { getCallLogsBySid } from '@/services/callLogService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { getconferenceSid } from '@/services/phoneNumberService';
import { events } from '@/lib/events';
import { getWorkerStatusBadgeVariant, parseWorkerStatusPayload } from '@/lib/worker-status';
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
  fallbackAgentCallSid?: string | null;
}

const ActionButton = ({ icon: Icon, label, onClick, isActive, className }: { icon: React.ElementType, label: string, onClick?: () => void, isActive?: boolean, className?: string }) => (
    <div className="flex flex-col items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onClick} className={cn("rounded-full h-12 w-12", isActive ? 'bg-muted' : '', className)}>
            <Icon className="h-6 w-6" />
        </Button>
        <span className="text-xs text-muted-foreground">{label}</span>
    </div>
);

function mergeCompanyUsersWithOperators(
  users: User[],
  operators: Operator[],
  currentUserId?: number,
  activityName?: string | null
): Operator[] {
  const operatorById = new Map(operators.map((operator) => [operator.id, operator]));

  return users.map((user) => {
    const operator = operatorById.get(user.id);
    const workerStatus =
      Number(user.id) === Number(currentUserId)
        ? activityName ?? operator?.worker_status ?? user.worker_status
        : operator?.worker_status ?? user.worker_status;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role_id: user.role_id ?? operator?.role_id,
      do_not_disturb: operator?.do_not_disturb ?? Number(user.do_not_disturb ?? 0),
      in_call: operator?.in_call ?? Number(user.in_call ?? 0),
      worker_status: workerStatus,
      departments: operator?.departments ?? [],
    };
  });
}

function renderColleagueStatusBadges(colleague: Operator) {
  const isInCall = Number(colleague.in_call) === 1;

  if (isInCall) {
    return <Badge variant="default">In call</Badge>;
  }

  const workerStatus = colleague.worker_status?.trim();
  if (workerStatus) {
    return (
      <Badge variant={getWorkerStatusBadgeVariant(workerStatus)}>
        {workerStatus}
      </Badge>
    );
  }

  return <Badge variant="outline">Unknown</Badge>;
}


export default function ActiveCallBar({ isOpen, contactNumber, callerName, departmentName, onLeaveCall, onEndCallForAll, connection, conferenceSid, fallbackAgentCallSid }: ActiveCallBarProps) {
  const { user: authUser } = useAuth();
  const { fromNumber, setConferenceSid, activityName } = useTwilio();
  const [duration, setDuration] = useState(0);
  const [selectedParticipant, setSelectedParticipant] = useState('');
  const [colleagueSearch, setColleagueSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [colleagues, setColleagues] = useState<Operator[]>([]);
  const [callDepartmentId, setCallDepartmentId] = useState<number | null>(null);
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
  const [isConsultActionLoading, setIsConsultActionLoading] = useState(false);
  const [customerCallSid, setCustomerCallSid] = useState<string | null>(null);
  const [consultCallSid, setConsultCallSid] = useState<string | null>(null);
  const [activeExternalCallSid, setActiveExternalCallSid] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [floatingTogglePosition, setFloatingTogglePosition] = useState<{ x: number; y: number } | null>(null);
  const [resolvedDepartmentName, setResolvedDepartmentName] = useState<string | null>(departmentName || null);
  const [verifiedConferenceSid, setVerifiedConferenceSid] = useState<string | null>(null);
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false);
  const [isEndingCall, setIsEndingCall] = useState(false);
  const [pendingOutgoing, setPendingOutgoing] = useState<PendingOutgoingParticipant | null>(null);
  const effectiveConferenceSid = conferenceSid || verifiedConferenceSid;
  const agentCallSid = connection?.parameters?.CallSid ?? fallbackAgentCallSid ?? null;

  const resolveActionAgentCallSid = (): string | null => {
    if (agentCallSid) {
      return agentCallSid;
    }

    if (authUser?.id) {
      const selfParticipant = (currentParticipants as ConferenceParticipant[]).find(
        (participant) =>
          participant.is_agent && Number(participant.user_id) === Number(authUser.id)
      );
      if (selfParticipant?.call_sid) {
        return selfParticipant.call_sid;
      }
    }

    return null;
  };

  const isUsableTwilioCallerId = (value?: string | null): boolean => {
    if (!value) return false;
    const trimmed = value.trim();
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('client:') || lower.startsWith('sip:')) return false;
    if (/[A-Za-z]/.test(trimmed)) return false;
    const digits = trimmed.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  };

  const resolveTwilioNumber = (): string | null => {
    // Incoming softphone To is usually client:… — never use that as From.
    const candidates = [
      typeof window !== 'undefined' ? localStorage.getItem('twilioFromNumber') : null,
      fromNumber,
      connection?.direction === 'OUTGOING' ? connection?.parameters?.From : null,
    ];

    for (const candidate of candidates) {
      if (isUsableTwilioCallerId(candidate)) {
        const digits = candidate!.replace(/\D/g, '');
        return candidate!.startsWith('+') ? candidate! : `+${digits.length === 10 ? `1${digits}` : digits}`;
      }
    }

    return null;
  };

  const callIdentity = effectiveConferenceSid || agentCallSid || contactNumber;
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
  const shouldPollParticipantsQuickly = hasRingingParticipant || Boolean(pendingOutgoing);
  const floatingToggleDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    dragged: boolean;
  } | null>(null);
  const suppressToggleClickRef = useRef(false);
  const participantUserIds = useMemo(
    () =>
      new Set(
        (currentParticipants as ConferenceParticipant[])
          .filter((participant) => participant.is_agent)
          .map((participant) => Number(participant.user_id))
          .filter((id) => Number.isFinite(id) && id > 0)
      ),
    [currentParticipants]
  );

  const availableColleaguesToAdd = useMemo(
    () =>
      colleagues.filter(
        (colleague) =>
          authUser &&
          Number(colleague.id) !== Number(authUser.id) &&
          !participantUserIds.has(Number(colleague.id))
      ),
    [colleagues, authUser, participantUserIds]
  );

  const filteredColleaguesToAdd = useMemo(() => {
    const query = colleagueSearch.trim().toLowerCase();
    const sorted = [...availableColleaguesToAdd].sort((a, b) => a.name.localeCompare(b.name));

    if (!query) {
      return sorted;
    }

    return sorted.filter(
      (colleague) =>
        colleague.name.toLowerCase().includes(query) ||
        colleague.email.toLowerCase().includes(query)
    );
  }, [availableColleaguesToAdd, colleagueSearch]);

  const colleaguesAsUsers = useMemo<User[]>(
    () =>
      colleagues.map((colleague) => ({
        id: colleague.id,
        name: colleague.name,
        email: colleague.email,
        role_id: colleague.role_id,
        in_call: colleague.in_call,
        worker_status: colleague.worker_status,
      })),
    [colleagues]
  );
  
  const dialpadKeys = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    '*', '0', '#'
  ];

  useEffect(() => {
    setDepartmentSettings(null);
    setCompanySettings(null);
    setResolvedDepartmentName(departmentName || null);
    setCustomerCallSid(null);
    setConsultCallSid(null);
    setActiveExternalCallSid(null);
    setCurrentParticipants([]);
    setIsOnHold(false);
    setVerifiedConferenceSid(conferenceSid || null);
    setPendingOutgoing(null);
    setDuration(0);
    setIsCollapsed(false);
  }, [callIdentity, departmentName, conferenceSid]);

   useEffect(() => {
    const lookupCallSid = connection?.parameters?.CallSid || fallbackAgentCallSid;
    if (isOpen && lookupCallSid) {
      const fetchUserName = async () => {
        try {
          const currentCallSid = lookupCallSid;
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
              setCallDepartmentId(matchingCall.department_id);
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
      setCallDepartmentId(null);
    }
  }, [isOpen, contactNumber, connection, departmentName, fallbackAgentCallSid, setConferenceSid]);

  useEffect(() => {
    if (departmentName) {
      setResolvedDepartmentName(departmentName);
    }
  }, [departmentName]);
  
  useEffect(() => {
    if (!isOpen || !authUser?.company_id) {
      if (!isOpen) {
        setColleagues([]);
        setCompanyContacts([]);
        setSelectedParticipant('');
        setColleagueSearch('');
      }
      return;
    }

    let cancelled = false;
    setLoadingUsers(true);

    const loadColleaguesAndContacts = async () => {
      try {
        const [operatorsResponse, usersResponse, contactsResponse] = await Promise.all([
          getOperators(undefined, { companyWide: true }),
          getUsersByCompany(authUser.company_id!, { all: true }),
          getContacts(authUser.company_id!),
        ]);
        if (cancelled) return;

        const nextColleagues = mergeCompanyUsersWithOperators(
          usersResponse.data ?? [],
          operatorsResponse.operators ?? [],
          authUser.id,
          activityName
        );
        setColleagues(nextColleagues);
        setCompanyContacts(contactsResponse || []);
      } catch {
        if (!cancelled) {
          toast({
            title: 'Error',
            description: 'Failed to load colleagues or contacts.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingUsers(false);
        }
      }
    };

    void loadColleaguesAndContacts();

    return () => {
      cancelled = true;
    };
  }, [isOpen, authUser?.company_id, authUser?.id, activityName, toast]);

  useEffect(() => {
    if (!isOpen) return;

    const handleInCallStatusChange = (data: Record<string, unknown>) => {
      if (!data || data.user_id == null || data.in_call == null) return;
      const userId = Number(data.user_id);
      const inCall = Number(data.in_call) ? 1 : 0;

      setColleagues((prev) =>
        prev.map((colleague) =>
          Number(colleague.id) === userId ? { ...colleague, in_call: inCall } : colleague
        )
      );
    };

    const handleWorkerStatusChange = (data: Record<string, unknown>) => {
      const parsed = parseWorkerStatusPayload(data);
      if (!parsed) return;

      setColleagues((prev) =>
        prev.map((colleague) =>
          Number(colleague.id) === parsed.user_id
            ? { ...colleague, worker_status: parsed.worker_status }
            : colleague
        )
      );
    };

    events.on('refreshInCallStatus', handleInCallStatusChange);
    events.on('refreshWorkerStatus', handleWorkerStatusChange);

    return () => {
      events.off('refreshInCallStatus', handleInCallStatusChange);
      events.off('refreshWorkerStatus', handleWorkerStatusChange);
    };
  }, [isOpen]);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;

    const handleMute = (muted: boolean) => setIsMuted(muted);

    if (isOpen && connection) {
      setDuration(0);
      timer = setInterval(() => setDuration((prev) => prev + 1), 1000);
      setIsMuted(connection.isMuted());
      connection.on('mute', handleMute);
    }

    return () => {
      clearInterval(timer);
      connection?.removeListener('mute', handleMute);
    };
  }, [isOpen, connection]);

  useEffect(() => {
    if (!isOpen) {
      setIsCollapsed(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const expand = () => setIsCollapsed(false);
    const onHoldChanged = (hold: boolean) => setIsOnHold(Boolean(hold));
    events.on('expandActiveCallBar', expand);
    events.on('customerHoldChanged', onHoldChanged);
    return () => {
      events.off('expandActiveCallBar', expand);
      events.off('customerHoldChanged', onHoldChanged);
    };
  }, []);
  
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
    const callSid = resolveActionAgentCallSid();
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
        try {
          events.emit('customerHoldChanged', hold);
          if (typeof window !== 'undefined' && window.electronAPI) {
            window.electronAPI.send('show-call-progress', { isOnHold: hold });
          }
        } catch {
          // ignore
        }
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
      const user = colleagues.find((entry) => String(entry.id) === userId);
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

  const handleAddParticipant = async () => {
    if (!selectedParticipant && !dialerNumber) {
      toast({ title: "Error", description: "Please select a user or enter a number.", variant: 'destructive' });
      return;
    }
    
    const myCallSid = resolveActionAgentCallSid();
    if (!myCallSid) {
      toast({ title: "Error", description: "Cannot add participant. Active call session not found.", variant: 'destructive' });
      return;
    }

    const sid = await ensureConferenceSid();
    if (!sid) {
      toast({ title: "Error", description: "Cannot add participant. Conference session not ready yet.", variant: 'destructive' });
      return;
    }

    const twilioNumber = resolveTwilioNumber();

    if (!twilioNumber) {
      toast({ title: "Error", description: "Could not determine a valid Twilio number for this call.", variant: 'destructive' });
      return;
    }

    setIsAdding(true);
    try {
        const phoneNumber = dialerNumber ? `+1${dialerNumber.replace(/\D/g, '')}` : undefined;
        const userId = selectedParticipant || undefined;
        
        const response = phoneNumber
          ? await initiateConsultCall(sid, twilioNumber, phoneNumber)
          : await addParticipant(sid, twilioNumber, userId, phoneNumber);

        if (response?.status === false) {
          toast({
            title: "Error",
            description: response?.msg || "Failed to add participant.",
            variant: 'destructive',
          });
          return;
        }

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
            description: `${outgoingName} is ringing. Stay on the call until they answer. The first caller is on hold.`,
          });
        } else if (userId) {
          await fetchParticipants({ silent: true });
          toast({
            title: "Calling colleague",
            description: `${outgoingName} is ringing. Stay on the call until they answer.`,
          });
        } else if (phoneNumber) {
          toast({
            title: "Error",
            description: response?.msg || "Failed to start the second call.",
            variant: 'destructive',
          });
          return;
        }

        setIsAddParticipantModalOpen(false);
        setDialerNumber('');
        setSelectedParticipant('');
    } catch (err: any) {
       toast({
         title: "Error",
         description: err?.response?.data?.msg || err?.message || "Failed to add participant.",
         variant: 'destructive',
       });
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

  const handleEndClick = () => {
    // No leg of our own while the conference still has people in it means we never
    // joined (another agent answered first). Tear down this UI only — ending the
    // conference would drop the customer and the agent who is actually talking.
    if (!agentCallSid && currentParticipants.length > 0) {
      void onEndCallForAll(null);
      return;
    }

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

  const contactNumberDisplay = pickDisplayablePhoneNumber(contactNumber);
  const formattedContactNumber = contactNumberDisplay
    ? contactNumberDisplay.toLowerCase().startsWith('client:')
      ? contactNumberDisplay.length > 20
        ? `${contactNumberDisplay.substring(0, 20)}...`
        : contactNumberDisplay
      : formatPhoneNumber(contactNumberDisplay)
    : '';
  const displayCallerName = isPlaceholderCallerName(callerName)
    ? formattedContactNumber || callerName || 'Unknown Caller'
    : callerName;
  const contactInitial = displayCallerName ? displayCallerName.charAt(0).toUpperCase() : '?';
  const showNumberSublabel =
    Boolean(formattedContactNumber) &&
    formattedContactNumber !== displayCallerName &&
    contactNumberDisplay !== displayCallerName;

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

  const handleFloatingTogglePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    floatingToggleDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      dragged: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleFloatingTogglePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = floatingToggleDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.dragged && Math.hypot(deltaX, deltaY) < 4) return;

    drag.dragged = true;
    const width = event.currentTarget.offsetWidth;
    const height = event.currentTarget.offsetHeight;
    const padding = 8;
    const maxX = Math.max(padding, window.innerWidth - width - padding);
    const maxY = Math.max(padding, window.innerHeight - height - padding);

    setFloatingTogglePosition({
      x: Math.min(Math.max(padding, drag.originX + deltaX), maxX),
      y: Math.min(Math.max(padding, drag.originY + deltaY), maxY),
    });
  };

  const handleFloatingTogglePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = floatingToggleDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    suppressToggleClickRef.current = drag.dragged;
    floatingToggleDragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };


  if (!isOpen) {
    return null;
  }

  const floatingToggle = (
    <button
      type="button"
      onClick={() => {
        if (suppressToggleClickRef.current) {
          suppressToggleClickRef.current = false;
          return;
        }
        setIsCollapsed((prev) => !prev);
      }}
      onPointerDown={handleFloatingTogglePointerDown}
      onPointerMove={handleFloatingTogglePointerMove}
      onPointerUp={handleFloatingTogglePointerUp}
      onPointerCancel={handleFloatingTogglePointerUp}
      className={cn(
        "fixed z-[110] flex touch-none cursor-move select-none items-center gap-3 rounded-full px-5 py-3.5",
        "bg-emerald-600 text-white shadow-[0_12px_40px_rgba(5,150,105,0.55)]",
        "ring-2 ring-emerald-300/80 ring-offset-2 ring-offset-background",
        "transition-colors hover:bg-emerald-500",
        floatingTogglePosition ? "" : "bottom-5 right-5"
      )}
      style={
        floatingTogglePosition
          ? { left: floatingTogglePosition.x, top: floatingTogglePosition.y }
          : undefined
      }
      aria-label={isCollapsed ? 'Expand active call controls' : 'Collapse active call controls'}
    >
      <span className="relative flex h-3 w-3 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
      </span>
      <Phone className="h-5 w-5 shrink-0 text-white" strokeWidth={2.25} />
      <span className="hidden text-sm font-semibold tracking-wide sm:inline max-w-[160px] truncate">
        {pendingOutgoing
          ? `Waiting · ${pendingOutgoing.name}`
          : displayCallerName || 'On call'}
      </span>
      {pendingOutgoing ? (
        <span className="max-w-[140px] truncate text-xs font-medium text-emerald-50 sm:hidden">
          Waiting for {pendingOutgoing.name}
        </span>
      ) : null}
      <span className="font-mono text-base font-bold tabular-nums tracking-wider">
        {formatTime(duration)}
      </span>
      {isCollapsed ? (
        <ChevronUp className="h-5 w-5 shrink-0 text-emerald-100" />
      ) : (
        <ChevronDown className="h-5 w-5 shrink-0 text-emerald-100" />
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
            {pendingOutgoing ? (
              <div className="border-b bg-amber-50 px-4 py-2.5 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-50">
                Waiting for <span className="font-medium">{pendingOutgoing.name}</span> to join.
                Stay on the call until they answer.
              </div>
            ) : null}
            <div className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                 <Avatar className="h-12 w-12">
                    <AvatarFallback>{contactInitial}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold text-lg truncate max-w-[200px]">{displayCallerName}</p>
                    
                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                    {showNumberSublabel ? (
                      <>
                        {formattedContactNumber}
                        {' · '}
                      </>
                    ) : null}
                       {formatTime(duration)}</p>
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
                    setSelectedParticipant('');
                    setDialerNumber('');
                    setColleagueSearch('');
                  }
                }}>
                    <DialogTrigger asChild>
                         <ActionButton icon={UserPlus} label="Add" />
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Participant</DialogTitle>
                            <DialogDescription>
                              The other person must answer before you leave the call.
                            </DialogDescription>
                        </DialogHeader>
                        <Tabs defaultValue="internal">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="internal">Internal User</TabsTrigger>
                                <TabsTrigger value="external">Dial Number</TabsTrigger>
                            </TabsList>
                            <TabsContent value="internal" className="py-4 space-y-3">
                               {loadingUsers ? (
                                 <p className="text-sm text-muted-foreground">Loading colleagues...</p>
                               ) : availableColleaguesToAdd.length === 0 ? (
                                 <p className="text-sm text-muted-foreground">
                                   {colleagues.length === 0
                                     ? 'No company users found.'
                                     : 'No colleagues available to add. Everyone else is already on this call.'}
                                 </p>
                               ) : (
                                 <>
                                   <div className="relative">
                                     <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                     <Input
                                       placeholder="Search by name or email..."
                                       value={colleagueSearch}
                                       onChange={(event) => setColleagueSearch(event.target.value)}
                                       className="pl-9"
                                     />
                                   </div>
                                   <ScrollArea className="h-56 rounded-md border">
                                     <div className="divide-y">
                                       {filteredColleaguesToAdd.length === 0 ? (
                                         <p className="p-4 text-sm text-muted-foreground text-center">
                                           No colleagues match your search.
                                         </p>
                                       ) : (
                                         filteredColleaguesToAdd.map((colleague) => (
                                           <button
                                             key={colleague.id}
                                             type="button"
                                             onClick={() => setSelectedParticipant(String(colleague.id))}
                                             className={cn(
                                               'w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-muted/50 transition-colors',
                                               selectedParticipant === String(colleague.id) && 'bg-muted'
                                             )}
                                           >
                                             <div className="min-w-0">
                                               <p className="font-medium truncate">{colleague.name}</p>
                                               <p className="text-xs text-muted-foreground truncate">{colleague.email}</p>
                                             </div>
                                             <div className="shrink-0">
                                               {renderColleagueStatusBadges(colleague)}
                                             </div>
                                           </button>
                                         ))
                                       )}
                                     </div>
                                   </ScrollArea>
                                 </>
                               )}
                            </TabsContent>
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
                            {currentParticipants.map((p: ConferenceParticipant) => {
                              const status = getParticipantConnectionStatus(p);
                              const name = resolveParticipantDisplayName(p, colleaguesAsUsers, companyContacts);
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
