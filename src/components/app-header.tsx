
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Department, PhoneNumber, Contact, User } from "@/types";
import { useTwilio } from '@/context/TwilioContext';
import { useToast } from "@/hooks/use-toast";
import { getDepartments } from "@/services/departmentService";
import { getUserDepartments, stopImpersonation, getUsersByCompany } from "@/services/userService";
import { getCompanyPhoneNumbers, getconferenceSid } from "@/services/phoneNumberService";
import { getContacts } from "@/services/contactService";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuShortcut } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Phone, MessageSquare, Video, Settings, LogOut, MoreVertical, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
import GlobalSearch from "@/components/global-search";
import TwilioStatusIndicator from "@/components/twilio-status-indicator";
import Dialer from "@/components/dialer";
import SendMessageDialog, { type SendMessageDialogPayload } from "@/components/send-message-dialog";
import HardwareSettings from "@/components/hardware-settings";
import { useRouter } from "next/navigation";
import { events } from "@/lib/events";
import { ToastAction } from "./ui/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { cn, formatPhoneNumber } from "@/lib/utils";
import {
  findLocalContactByPhone,
  formatSmsNotificationSenderLabel,
} from "@/lib/contact-display";
import { dispatchOperatorStatusUpdate } from "@/lib/worker-status";
import { isElectron } from '@/lib/is-electron';
import { canListAllCompanyDepartments } from '@/lib/roles';
import { cacheGet, cacheSet } from '@/lib/simpleCache';
import { useAppDispatch } from "@/store";
import { setUser } from "@/store/slices/authSlice";
import { initiateConsultCall, consultEnsureAgent } from "@/services/twilioService";
import {
    applyOutboundContextSelection,
    type OutboundContext,
} from "@/lib/outbound-context";
import { resolveDefaultFromNumberForDepartment } from '@/lib/phone-numbers';
import AvailabilityStatusBanner from "@/components/availability-status-banner";

type AppInfo = { version?: string; updateReady?: boolean };

interface AppHeaderProps {
    user: User | null;
    logout: () => void;
    pageTitle?: string;
    searchClassName?: string;
    showBackButton?: boolean;
    backButtonHref?: string;
    dialerOpen?: boolean;
    onDialerOpenChange?: (open: boolean) => void;
    dialerInitialValue?: string;
}

export default function AppHeader({ 
    user, 
    logout, 
    pageTitle,
    searchClassName,
    showBackButton = false, 
    backButtonHref = "", 
    dialerOpen: controlledDialerOpen, 
    onDialerOpenChange: setControlledDialerOpen, 
    dialerInitialValue: controlledDialerInitialValue,
}: AppHeaderProps) {
    const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : '?';
    const [isVideoOpen, setIsVideoOpen] = useState(false);
    const { device, isDeviceReady, connectTwilio, activityName, toggleActivity, setFromNumber, setConferenceSid, connection: twilioConnection, conferenceSid: twilioConferenceSid, registerOutboundConnection, prepareLocalAudio } = useTwilio();
    const { toast } = useToast();
    const router = useRouter();

    const [departments, setDepartments] = useState<Department[]>([]);
    const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const contactsRef = useRef<Contact[]>([]);
    const [companyUsers, setCompanyUsers] = useState<User[]>([]);
    const [loadingDepartments, setLoadingDepartments] = useState(true);
    const [loadingNumbers, setLoadingNumbers] = useState(false);
    
    // Internal state for uncontrolled usage
    const [internalDialerOpen, setInternalDialerOpen] = useState(false);
    const [internalDialerInitialValue, setInternalDialerInitialValue] = useState('');

    const dialerOpen = controlledDialerOpen ?? internalDialerOpen;
    const setDialerOpen = setControlledDialerOpen ?? setInternalDialerOpen;
    const dialerInitialValue = controlledDialerInitialValue ?? internalDialerInitialValue;
    
    const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
    const [selectedFromNumber, setSelectedFromNumber] = useState('');
    const dialerSelectionPinnedRef = useRef(false);
    const isMountedRef = useRef(false);
    const [messageDialogOpen, setMessageDialogOpen] = useState(false);
    const [messageDialogPayload, setMessageDialogPayload] = useState<SendMessageDialogPayload | undefined>();

    const socketRef = useRef<WebSocket | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Electron app info
    const [appVersion, setAppVersion] = useState<string | null>(null);
    const [updateReady, setUpdateReady] = useState<boolean>(false);

    const dispatch = useAppDispatch();
    const [isImpersonating, setIsImpersonating] = useState(false);
    const [stoppingImpersonation, setStoppingImpersonation] = useState(false);
    
    const handleStopImpersonation = async () => {
        try {
            setStoppingImpersonation(true);

            const impersonationId =
            localStorage.getItem("impersonation_id");

            if (!impersonationId) {
            throw new Error(
                "Impersonation session not found."
            );
            }

            const response = await stopImpersonation(impersonationId);

            dispatch(
                setUser({
                    user: response.user,
                    token: response.token,
                })
            );

            // localStorage.setItem("authToken", response.token);
            // localStorage.setItem("user", JSON.stringify(response.user));

            localStorage.removeItem("impersonation_id");
            localStorage.removeItem("is_impersonating");

            toast({
                title: "Impersonation Ended",
                description: "You are now back in your admin account.",
            });

            router.push("/dashboard");
        } catch (error: any) {
            toast({
                title: "Error",
                description:
                    error?.response?.data?.message ||
                    "Failed to stop impersonation.",
                variant: "destructive",
            });
        } finally {
            setStoppingImpersonation(false);
        }
    };

    useEffect(() => {
        // Initialize the audio element once.
        if (typeof window !== 'undefined' && !audioRef.current) {
            audioRef.current = new Audio('/sounds/message.mp3');
        }

        setIsImpersonating(
            localStorage.getItem("is_impersonating") === "true"
        );
    }, []);
    
    useEffect(() => {
        connectTwilio();
    }, [connectTwilio]);

    // Fetch app version/update status from Electron (if present)
    useEffect(() => {
        if (!isElectron()) return;
        const w = window as any;
        const api = w?.api;
        if (api?.getAppInfo) {
            api.getAppInfo().then((info: AppInfo) => {
                if (info?.version) setAppVersion(info.version);
                if (info?.updateReady) setUpdateReady(Boolean(info.updateReady));
            }).catch(() => {});
        }
        // Listen for update ready broadcast
        const off = api?.onUpdateReady ? api.onUpdateReady((_payload: any) => {
            setUpdateReady(true);
        }) : undefined;
        return () => {
            if (typeof off === 'function') off();
            if (api?.remove) api.remove('update-ready');
        };
    }, []);

    useEffect(() => {
        if (!isElectron() || !window.electronAPI) return;

        const off = window.electronAPI.on('open-sms-conversation', (payload: { from?: string; to?: string }) => {
            if (!payload?.from || !payload?.to) return;
            router.push(
                `/conversations/${encodeURIComponent(payload.from)}/${encodeURIComponent(payload.to)}`
            );
        });

        return () => {
            off?.();
        };
    }, [router]);
    
    useEffect(() => {
        if (!user) {
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
            return;
        }

        let reconnectTimer:any;

        const connectSocket = () => {
            if (socketRef.current) return;

            const WS_URL = `wss://socket.windshieldhub.com?user_id=${user.id}`;
            const newSocket = new WebSocket(WS_URL);
            socketRef.current = newSocket;

            newSocket.onopen = () => {
                console.log("✅ WebSocket connection established in AppHeader");
            };

            newSocket.onmessage = (evt) => {
            try {
                const data = JSON.parse(evt.data);
                console.log("📩 WebSocket message received:", data);

                if (data.method_type === "operator_status_notification" && data.data) {
                    dispatchOperatorStatusUpdate(data.data);
                }

                if (data.method_type === "status_change" && data.data) {
                    if (
                        data.data.worker_status ||
                        data.data.activity_name ||
                        data.data.activity
                    ) {
                        dispatchOperatorStatusUpdate(data.data);
                    }
                }

                if (data.method_type === "refresh_listing") {
                    // Coalesce bursty call events so every agent doesn't refetch inbox lists at once.
                    // A terminal status is sent after the row is saved, so refresh that one immediately.
                    if (data.task_type === "call_status") {
                        events.emit("refreshCalls");
                    } else {
                        events.emitDebounced("refreshCalls", 5000);
                    }
                    const from = data.data?.from;
                    const to = data.data?.to;
                    if (typeof from === "string" && typeof to === "string" && from && to) {
                        events.emit("refreshConversation", { from, to });
                    }
                }

                if (data.method_type == "dnd_notification" && data.task_type == "dnd_status_change") {
                    console.log("📢 Department DND status change notification received:", data.data);
                    if (data.data?.department_id != null) {
                        events.emit("refreshOperators", data.data);
                    }
                }
                if (data.method_type == "dnd_notification" && data.task_type == "overall_dnd_status_change") {
                    console.log("📢 Overall DND status change notification received:", data.data);
                    events.emit("refreshOverallDnd", {
                        user_id: data.data?.user_id,
                        do_not_disturb: data.data?.do_not_disturb ?? data.data?.is_dnd,
                    });
                }

                if (data.method_type == "in_call_notification" && data.task_type == "user_in_call_status") {
                    console.log("📞 In-call status change notification received:", data.data);
                    events.emit("refreshInCallStatus", data.data);
                    const inCall = data.data?.in_call;
                    const callEnded = inCall === 0 || inCall === false || inCall === "0";
                    if (callEnded) {
                        events.emit("refreshCalls");
                    }
                }

                if (data.method_type === "live_call_notification" && data.data) {
                    if (data.task_type === "live_call_state") {
                        events.emit("liveCallState", data.data);
                        if (data.data?.event === "ended") {
                            events.emit("refreshCalls");
                        }
                    } else if (data.task_type === "live_transcript") {
                        events.emit("liveTranscript", data.data);
                    } else if (data.task_type === "live_analysis") {
                        events.emit("liveAnalysis", data.data);
                    }
                }

                if (
                    data.method_type === "conference_invite_notification" &&
                    data.task_type === "conference_invite" &&
                    data.data
                ) {
                    events.emit("conferenceInvite", data.data);
                }

                if (data.method_type === "sms_status_update" && data.data) {
                    const { from, to } = data.data;
                    try {
                        events.emit("refreshConversation", { from, to });
                        events.emitDebounced("refreshCalls", 500);
                    } catch (_) {}
                }

                if (data.method_type === "show_sms_notification" && data.data) {
                    if (audioRef.current) {
                        audioRef.current.play().catch(e =>
                        console.error("Error playing notification sound:", e)
                        );
                    }
                    const { from, to, body, contact_name: apiContactName } = data.data;
                    const localContact = findLocalContactByPhone(contactsRef.current, from);
                    const senderLabel = formatSmsNotificationSenderLabel(from, {
                        contactName: apiContactName,
                        localContact,
                    });
                    const notificationPayload = {
                        ...data.data,
                        contact_name: apiContactName || localContact?.name || null,
                    };

                    if (isElectron() && window.electronAPI) {
                        window.electronAPI.send('incoming-sms', notificationPayload);
                    }
                    // Notify open conversation views and refresh thread listings
                    try {
                        events.emit("refreshConversation", { from, to });
                        events.emitDebounced("refreshCalls", 500);
                    } catch (_) {}
                    const navigateToConversation = () => {
                        router.push(`/conversations/${encodeURIComponent(from)}/${encodeURIComponent(to)}`);
                    };

                    const hasMedia = Boolean(data.data?.meta_data?.num_media || data.data?.meta_data?.media_urls?.length);
                    toast({
                        title: hasMedia
                          ? `New MMS from ${senderLabel}`
                          : `New Message from ${senderLabel}`,
                        description: body || (hasMedia ? 'Media attachment' : ''),
                        action: (
                        <ToastAction
                          altText="View"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigateToConversation();
                          }}
                        >
                            View
                        </ToastAction>
                        ),
                        onClick: (event) => {
                          // Ignore clicks on close / action controls — only body opens chat.
                          const target = event.target as HTMLElement | null;
                          if (target?.closest('[toast-close], [data-radix-toast-close], button')) {
                            return;
                          }
                          navigateToConversation();
                        },
                        className: "cursor-pointer"
                    });
                }
            } catch (e) {
                console.warn("⚠️ Non-JSON message:", evt.data);
            }
            };

            newSocket.onerror = (err) => {
                console.error("❌ WebSocket error occurred. Details will be in the 'onclose' event.");
            };

            newSocket.onclose = (event) => {
                console.log(`⚠️ WebSocket closed. Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}. Retrying in 10s...`);
                socketRef.current = null;
                reconnectTimer = setTimeout(connectSocket, 10000);
            };
        };

        connectSocket();

        return () => {
            if (socketRef.current) {
                socketRef.current.onclose = null;
                socketRef.current.close();
                socketRef.current = null;
            }
            clearTimeout(reconnectTimer);
        };
    }, [user, toast, router]);


    const applyOutboundContext = useCallback((context?: OutboundContext, options?: { force?: boolean }) => {
        if (!options?.force && dialerSelectionPinnedRef.current) return;
        if (!context?.departmentId && !context?.fromNumber) return;

        const resolved = applyOutboundContextSelection(context, phoneNumbers);
        if (resolved.departmentId) {
            setSelectedDepartmentId(resolved.departmentId);
        }
        if (resolved.fromNumber) {
            setSelectedFromNumber(resolved.fromNumber);
        }
    }, [phoneNumbers]);

    const handleDepartmentChange = useCallback((departmentId: string) => {
        dialerSelectionPinnedRef.current = true;
        setSelectedDepartmentId(departmentId);
    }, []);

    const handleFromNumberChange = useCallback((fromNumber: string) => {
        dialerSelectionPinnedRef.current = true;
        setSelectedFromNumber(fromNumber);
    }, []);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        const runWhenMounted = (fn: () => void) => {
            queueMicrotask(() => {
                if (isMountedRef.current) fn();
            });
        };

        const handleSetOutboundContext = (context: OutboundContext) => {
            runWhenMounted(() => applyOutboundContext(context));
        };

        const handleOpenDialer = (payload?: OutboundContext & { initialValue?: string }) => {
            runWhenMounted(() => {
                if (payload) {
                    applyOutboundContext(payload, { force: true });
                }
                if (payload?.initialValue !== undefined) {
                    if (setControlledDialerOpen === undefined) {
                        setInternalDialerInitialValue(payload.initialValue.replace(/^\+1/, ''));
                    }
                } else if (setControlledDialerOpen === undefined) {
                    setInternalDialerInitialValue('');
                }
                setDialerOpen(true);
            });
        };

        const handleOpenMessageDialog = (payload?: SendMessageDialogPayload) => {
            runWhenMounted(() => {
                setMessageDialogPayload(payload);
                setMessageDialogOpen(true);
            });
        };

        events.on('setOutboundContext', handleSetOutboundContext);
        events.on('openDialer', handleOpenDialer);
        events.on('openMessageDialog', handleOpenMessageDialog);

        return () => {
            events.off('setOutboundContext', handleSetOutboundContext);
            events.off('openDialer', handleOpenDialer);
            events.off('openMessageDialog', handleOpenMessageDialog);
        };
    }, [applyOutboundContext, setControlledDialerOpen, setDialerOpen]);

    useEffect(() => {
        if (!user?.company_id || !user?.id) return;
        const companyId = user.company_id;
        const cacheKey = `header-init:${user.id}`;

        const refreshContacts = (changedCompanyId?: number) => {
            if (changedCompanyId && Number(changedCompanyId) !== companyId) return;
            void getContacts(companyId).then((freshContacts) => {
                const contactList = Array.isArray(freshContacts) ? freshContacts : [];
                setContacts(contactList);
                const cached = cacheGet<{
                    departments: Department[];
                    contacts: Contact[];
                    phoneNumbers: PhoneNumber[];
                    companyUsers: User[];
                }>(cacheKey);
                if (cached) {
                    cacheSet(cacheKey, { ...cached, contacts: contactList }, 5 * 60_000);
                }
            });
        };

        events.on('contactsChanged', refreshContacts);
        return () => events.off('contactsChanged', refreshContacts);
    }, [user?.company_id, user?.id]);

    const filteredPhoneNumbers = selectedDepartmentId
        ? phoneNumbers.filter(
            (num) => num.department_id != null && String(num.department_id) === selectedDepartmentId
          )
        : [];

    useEffect(() => {
        if (dialerSelectionPinnedRef.current || selectedDepartmentId || !departments.length || !phoneNumbers.length) {
            return;
        }
        const firstDeptId = String(departments[0].id);
        setSelectedDepartmentId(firstDeptId);
        setSelectedFromNumber(resolveDefaultFromNumberForDepartment(phoneNumbers, firstDeptId));
    }, [departments, phoneNumbers, selectedDepartmentId]);

    useEffect(() => {
        if (!selectedDepartmentId) {
            if (selectedFromNumber) setSelectedFromNumber('');
            return;
        }
        const hasSelectedNumber = filteredPhoneNumbers.some((num) => num.phone_no === selectedFromNumber);
        if (!hasSelectedNumber) {
            setSelectedFromNumber(resolveDefaultFromNumberForDepartment(phoneNumbers, selectedDepartmentId));
        }
    }, [selectedDepartmentId, filteredPhoneNumbers, selectedFromNumber, phoneNumbers]);

    useEffect(() => {
        contactsRef.current = contacts;
    }, [contacts]);
    
    useEffect(() => {
        let cancelled = false;

        const fetchInitialData = async () => {
            if (!user?.company_id) return;

            const cacheKey = `header-init:${user.id}`;
            const cached = cacheGet<{
              departments: Department[];
              contacts: Contact[];
              phoneNumbers: PhoneNumber[];
              companyUsers: User[];
            }>(cacheKey);
            if (cached) {
              if (cancelled) return;
              setDepartments(cached.departments);
              setContacts(cached.contacts);
              setPhoneNumbers(cached.phoneNumbers);
              setCompanyUsers(cached.companyUsers);
              setLoadingDepartments(false);
              return;
            }

            setLoadingDepartments(true);
            setLoadingNumbers(true);
            try {
                const canFetchAllDepts = canListAllCompanyDepartments(user.role_id);
                const [fetchedDepts, fetchedNumbers, usersResponse] = await Promise.all([
                    canFetchAllDepts
                        ? getDepartments(user.company_id)
                        : getUserDepartments(user.id),
                    getCompanyPhoneNumbers(user.company_id),
                    getUsersByCompany(user.company_id),
                ]);
                if (cancelled) return;
                const depts = Array.isArray(fetchedDepts) ? fetchedDepts : [];
                const numbers = Array.isArray(fetchedNumbers) ? fetchedNumbers : [];
                const users = Array.isArray(usersResponse.data) ? usersResponse.data : [];
                setDepartments(depts);
                setPhoneNumbers(numbers);
                setCompanyUsers(users);
                setLoadingDepartments(false);
                setLoadingNumbers(false);

                cacheSet(cacheKey, {
                  departments: depts,
                  contacts: [],
                  phoneNumbers: numbers,
                  companyUsers: users,
                }, 5 * 60_000);

                void getContacts(user.company_id)
                  .then((freshContacts) => {
                    if (cancelled) return;
                    const contactList = Array.isArray(freshContacts) ? freshContacts : [];
                    setContacts(contactList);
                    cacheSet(cacheKey, {
                      departments: depts,
                      contacts: contactList,
                      phoneNumbers: numbers,
                      companyUsers: users,
                    }, 5 * 60_000);
                  })
                  .catch(() => {
                    // Dialer/global search still work via searchContacts.
                  });
                return;
            } catch (error) {
                if (!cancelled) {
                  toast({ title: "Error", description: "Failed to load initial data.", variant: "destructive" });
                }
            } finally {
                if (!cancelled) {
                  setLoadingDepartments(false);
                  setLoadingNumbers(false);
                }
            }
        };
        void fetchInitialData();

        return () => {
            cancelled = true;
        };
    }, [user?.id, user?.company_id, user?.role_id, toast]);
    
    const handleMakeCall = async (number: string, fromNumber?: string) => {
        if (!device || !isDeviceReady) {
            toast({ title: "Twilio Error", description: "Twilio Device not ready. Please connect first.", variant: 'destructive'});
            return;
        }
        
        if (!fromNumber) {
            // If used as uncontrolled, update internal state
            if (setControlledDialerOpen === undefined) {
                setInternalDialerOpen(true);
                setInternalDialerInitialValue(number.replace(/^\+1/, ""));
            } else { // If controlled, expect parent to handle it
                 setControlledDialerOpen(true);
            }
            return;
        }

        const liveConnection = twilioConnection;
        const callStatus = liveConnection?.status?.();
        const isInLiveCall = callStatus === 'open';
        const isCallConnecting =
          !!callStatus && !['closed', 'disconnected'].includes(callStatus) && !isInLiveCall;
        const liveCallSid = liveConnection?.parameters?.CallSid as string | undefined;
        let conferenceSidForConsult = twilioConferenceSid;

        if (isCallConnecting) {
            toast({
                title: "Call connecting",
                description: "Please wait for the current call to connect before dialing another number.",
                variant: "destructive",
            });
            return;
        }

        if (isInLiveCall && liveConnection) {
            if (liveCallSid) {
                try {
                    const resolved = await getconferenceSid(liveCallSid);
                    if (resolved?.conferenceSid) {
                        conferenceSidForConsult = resolved.conferenceSid;
                        setConferenceSid(resolved.conferenceSid);
                    }
                } catch {
                    // fall back to context SID
                }
            }
            if (!conferenceSidForConsult) {
                toast({
                    title: "Call not ready",
                    description: "The conference is still being set up. Please try again in a moment.",
                    variant: "destructive",
                });
                return;
            }
            try {
                const consultResult = await initiateConsultCall(conferenceSidForConsult, fromNumber, number);
                if (!consultResult?.status) {
                    throw new Error(consultResult?.msg || 'Failed to start consult call.');
                }
                if (consultResult?.data?.conference_sid) {
                    setConferenceSid(consultResult.data.conference_sid);
                }
                await consultEnsureAgent(conferenceSidForConsult);
                setDialerOpen(false);
                toast({
                    title: 'Second call started',
                    description: `${formatPhoneNumber(number)} is being dialed. The first caller is on hold — use Swap or Switch when they answer.`,
                });
            } catch (error: any) {
                toast({
                    title: "Consult Error",
                    description: error?.response?.data?.msg || error?.message || "Failed to start consult call.",
                    variant: "destructive",
                });
            }
            return;
        }
    
        try {
            setConferenceSid(null);

            const params: { To: string, From?: string, conferenceSid?: string, direction?: string } = { To: number };
            if (fromNumber) {
                params.From = fromNumber;
                params.direction = "outbound";
                setFromNumber(fromNumber);
                localStorage.setItem("twilioFromNumber", fromNumber);
            }
            await prepareLocalAudio();
            const connection = await device.connect({ params });
            if (connection.status() === 'pending') {
                connection.accept();
            }
            setDialerOpen(false);

            const selectedDepartment = departments.find((dept) => String(dept.id) === selectedDepartmentId);
            const localContact = findLocalContactByPhone(contactsRef.current, number);
            registerOutboundConnection(connection, {
                callerName: localContact?.name || number,
                callerNumber: number,
                departmentName: selectedDepartment?.name || null,
            });

           connection.on('accept', async () => {
                console.log('Call accepted');
                const callSid = connection.parameters.CallSid;
                try {
                    const data = await getconferenceSid(callSid);
                    if (data.conferenceSid) {
                        setConferenceSid(data.conferenceSid);
                    } else {
                        console.warn('No conferenceSid found yet.');
                    }
                } catch (e) {
                    console.error('Error fetching conferenceSid:', e);
                }
            });
        } catch (error) {
            console.error("Error making call:", error);
            toast({ title: "Call Error", description: "Failed to make call. See console for details.", variant: 'destructive'});
        }
    };
    
    const statusClasses = {
        'Available': 'bg-green-500',
        'Unavailable': 'bg-yellow-500',
        'Offline': 'bg-red-500',
    };
    
    const handleCheckForUpdates = () => {
        if(window.electronAPI) {
            window.electronAPI.send('check-for-updates');
        } else {
            toast({ title: "Not available", description: "This feature is only available in the desktop app."});
        }
    }

    const handleRestartToUpdate = () => {
        const w = window as any;
        const api = w?.api;
        if (api?.restartToUpdate) {
            api.restartToUpdate();
        } else {
            toast({ title: "Restart not available", description: "This action is only available in the desktop app."});
        }
    }


    return (
        <>
            <header className="sticky top-0 z-30 flex items-center justify-between gap-4 h-16 px-4 md:px-8 border-b bg-background shadow-sm">
                <div className={cn('flex min-w-0 items-center gap-4', !pageTitle && 'flex-1')}>
                    <SidebarTrigger className="md:hidden shrink-0" />
                     {pageTitle ? (
                        <h1 className="text-xl font-bold">{pageTitle}</h1>
                     ) : (
                        <GlobalSearch
                            companyId={user?.company_id}
                            contacts={contacts}
                            users={companyUsers}
                            className={cn('w-full', searchClassName ?? 'md:max-w-md lg:max-w-xl')}
                        />
                     )}
                </div>
                <div className="flex shrink-0 items-center gap-4">
                    <TwilioStatusIndicator />
                    <ThemeToggle />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Reload app"
                      title="Reload app"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.location.reload();
                        }
                      }}
                    >
                      <RefreshCw className="h-5 w-5" />
                    </Button>
                     <Dialer
                        onMakeCall={handleMakeCall}
                        departments={departments}
                        phoneNumbers={phoneNumbers}
                        onDepartmentChange={handleDepartmentChange}
                        loadingDepartments={loadingDepartments}
                        loadingNumbers={loadingNumbers}
                        initialValue={dialerInitialValue}
                        open={dialerOpen}
                        onOpenChange={setDialerOpen}
                        selectedDepartmentId={selectedDepartmentId}
                        selectedFromNumber={selectedFromNumber}
                        onSetSelectedFromNumber={handleFromNumberChange}
                        contacts={contacts}
                     >
                       <Button variant="ghost" size="icon" onClick={() => { 
                           if (setControlledDialerOpen === undefined) {
                               setInternalDialerInitialValue(''); 
                           }
                           setDialerOpen(true);
                        }}>
                           <Phone className="h-5 w-5" />
                        </Button>
                     </Dialer>
                     <Button
                       variant="ghost"
                       size="icon"
                       onClick={() => {
                         setMessageDialogPayload(undefined);
                         setMessageDialogOpen(true);
                       }}
                     >
                       <MessageSquare className="h-5 w-5" />
                     </Button>
                     <Button variant="ghost" size="icon" onClick={() => setIsVideoOpen(true)}><Video className="h-5 w-5" /></Button>
                     <HardwareSettings />

                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={user?.profile_picture || `https://placehold.co/100x100.png?text=${userInitial}`} alt={user?.name} />
                                    <AvatarFallback>{userInitial}</AvatarFallback>
                                </Avatar>
                                 {activityName && (
                                    <span className={cn("absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-background", statusClasses[activityName as keyof typeof statusClasses] || 'bg-gray-500')} />
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 p-4">
                            <div className="flex items-center gap-3 mb-4">
                                <Avatar className="h-12 w-12">
                                     <AvatarImage src={user?.profile_picture || `https://placehold.co/100x100.png?text=${userInitial}`} alt={user?.name} />
                                     <AvatarFallback>{userInitial}</AvatarFallback>
                                     {activityName && (
                                        <span className={cn("absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-background", statusClasses[activityName as keyof typeof statusClasses] || 'bg-gray-500')} />
                                    )}
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{user?.name}</p>
                                    <p className="text-sm text-muted-foreground">{activityName}</p>
                                </div>
                            </div>

                             <div className="space-y-2 mb-4">
                                <Label htmlFor="status-select" className="text-xs text-muted-foreground">Update your status</Label>
                                 <Select value={activityName || ''} onValueChange={(value) => toggleActivity(value)}>
                                    <SelectTrigger id="status-select">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Available">Available</SelectItem>
                                        <SelectItem value="Unavailable">Unavailable</SelectItem>
                                        <SelectItem value="Offline">Offline</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link href="/profile">
                                    <Settings className="mr-2" />
                                    <span>Profile</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={logout}>
                                <LogOut className="mr-2" />
                                <span>Logout</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                           <Button variant="ghost" size="icon" className="relative" aria-label={updateReady ? 'Update ready — restart available' : 'More options'}>
                                <MoreVertical className="h-5 w-5" />
                                {updateReady && (
                                  <span
                                    className="absolute -top-0.5 -right-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-background animate-pulse"
                                    aria-hidden="true"
                                  />
                                )}
                           </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {!isElectron() && (
                              <>
                                <DropdownMenuItem asChild>
                                  <a
                                    href={process.env.NEXT_PUBLIC_DOWNLOAD_URL ?? 'https://phone-api.windshieldhub.com/api/download/latest'}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <span>Download app</span>
                                  </a>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                             <DropdownMenuItem>
                                <span>Version</span>
                                <DropdownMenuShortcut>{appVersion ?? 'web'}</DropdownMenuShortcut>
                            </DropdownMenuItem>
                            {updateReady && (
                              <DropdownMenuItem onClick={handleRestartToUpdate}>
                                <span className="text-amber-600 font-medium">Restart to update</span>
                              </DropdownMenuItem>
                            )}
                            {!updateReady && (
                              <DropdownMenuItem onClick={handleCheckForUpdates}>
                                <span>Check for updates</span>
                             </DropdownMenuItem>
                            )}
                             <DropdownMenuSeparator />
                            <DropdownMenuItem>
                                <span>Feedback</span>
                            </DropdownMenuItem>
                             <DropdownMenuItem>
                                <span>Help</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {isImpersonating && (
                <div className="bg-amber-100 border-b border-amber-300 px-4 py-2">
                    <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
                    <div className="flex items-center gap-2 text-amber-900">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium">
                            You are currently impersonating another user.
                        </span>
                    </div>

                    <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleStopImpersonation}
                        disabled={stoppingImpersonation}
                    >
                        {stoppingImpersonation ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Restoring...
                        </>
                        ) : (
                            "Exit Impersonation"
                        )}
                    </Button>
                    </div>
                </div>
            )}

            <AvailabilityStatusBanner />
              
            <SendMessageDialog
              open={messageDialogOpen}
              onOpenChange={setMessageDialogOpen}
              departments={departments}
              phoneNumbers={phoneNumbers}
              contacts={contacts}
              loadingDepartments={loadingDepartments}
              loadingNumbers={loadingNumbers}
              payload={messageDialogPayload}
            />

            <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
            <DialogContent>
                <DialogHeader>
                <DialogTitle>New Video Call</DialogTitle>
                <DialogDescription>
                    This feature is coming soon.
                </DialogDescription>
                </DialogHeader>
            </DialogContent>
            </Dialog>
        </>
    );
}
