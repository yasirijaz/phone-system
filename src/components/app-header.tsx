
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Department, PhoneNumber, Contact, User } from "@/types";
import { useTwilio } from '@/context/TwilioContext';
import { useToast } from "@/hooks/use-toast";
import { getDepartments } from "@/services/departmentService";
import { getUserDepartments, stopImpersonation } from "@/services/userService";
import { getCompanyPhoneNumbers, getconferenceSid } from "@/services/phoneNumberService";
import { getContacts } from "@/services/contactService";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuShortcut } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Search, Phone, MessageSquare, Video, Settings, LogOut, MoreVertical, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import TwilioStatusIndicator from "@/components/twilio-status-indicator";
import Dialer from "@/components/dialer";
import NewMessageForm from "@/components/new-message-form";
import HardwareSettings from "@/components/hardware-settings";
import ActiveCallBar from "./active-call-modal";
import type { Call } from '@twilio/voice-sdk';
import { ScrollArea } from "./ui/scroll-area";
import { useRouter } from "next/navigation";
import { events } from "@/lib/events";
import { ToastAction } from "./ui/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { cn, formatPhoneNumber } from "@/lib/utils";
import { isElectron } from '@/lib/is-electron';
import { canListAllCompanyDepartments } from '@/lib/roles';
import { cacheGet, cacheSet } from '@/lib/simpleCache';
import { useAppDispatch } from "@/store";
import { setUser } from "@/store/slices/authSlice";
import { initiateConsultCall } from "@/services/twilioService";

type AppInfo = { version?: string; updateReady?: boolean };

interface AppHeaderProps {
    user: User | null;
    logout: () => void;
    pageTitle?: string;
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
    showBackButton = false, 
    backButtonHref = "", 
    dialerOpen: controlledDialerOpen, 
    onDialerOpenChange: setControlledDialerOpen, 
    dialerInitialValue: controlledDialerInitialValue 
}: AppHeaderProps) {
    const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : '?';
    const [isVideoOpen, setIsVideoOpen] = useState(false);
    const { device, isDeviceReady, connectTwilio, activityName, toggleActivity, setFromNumber, setConferenceSid, connection: twilioConnection, conferenceSid: twilioConferenceSid } = useTwilio();
    const { toast } = useToast();
    const router = useRouter();

    const [departments, setDepartments] = useState<Department[]>([]);
    const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
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

    //for outgoing calls
    const [activeCall, setActiveCall] = useState<Call | null>(null);
    const [isActiveCallOpen, setIsActiveCallOpen] = useState(false);
    const [activeContactName, setActiveContactName] = useState('');
    const [activeDepartmentName, setActiveDepartmentName] = useState<string | null>(null);
    const [activeConferenceSid, setActiveConferenceSid] = useState<string | null>(null);

    // Search state
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchValue, setSearchValue] = useState("");
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

            router.push("/dashboard/ecommerce");
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

                if (data.method_type === "status_change") {
                    if (data.data) {
                        events.emit("refreshWorkerStatus", data.data);
                    }
                }

                if (data.method_type === "refresh_listing") {
                    events.emitDebounced("refreshCalls", 3000);
                }

                if (data.method_type == "dnd_notification" && data.task_type == "dnd_status_change") {
                    console.log("📢 DND status change notification received:", data.data);
                    events.emit("refreshOperators", data.data);
                }
                if (data.method_type == "dnd_notification" && data.task_type == "overall_dnd_status_change") {
                    console.log("📢 DND status change notification received:", data.data);
                    events.emit("refreshOperators", data.data);
                }

                if (data.method_type == "in_call_notification" && data.task_type == "user_in_call_status") {
                    console.log("📞 In-call status change notification received:", data.data);
                    events.emit("refreshInCallStatus", data.data);
                }

                if (data.method_type === "show_sms_notification" && data.data) {
                    if (audioRef.current) {
                        audioRef.current.play().catch(e =>
                        console.error("Error playing notification sound:", e)
                        );
                        if (isElectron() && window.electronAPI) {
                            window.electronAPI.send('incoming-sms',data.data);
                        }
                    }
                    const { from, to, body } = data.data;
                    // Notify any open conversation detail page to refresh
                    try {
                        events.emit("refreshConversation", { from, to });
                    } catch (_) {}
                    const navigateToConversation = () => {
                        router.push(`/conversations/${encodeURIComponent(from)}/${encodeURIComponent(to)}`);
                    };

                    const hasMedia = Boolean(data.data?.meta_data?.num_media || data.data?.meta_data?.media_urls?.length);
                    toast({
                        title: hasMedia
                          ? `New MMS from ${formatPhoneNumber(from)}`
                          : `New Message from ${formatPhoneNumber(from)}`,
                        description: body || (hasMedia ? 'Media attachment' : ''),
                        action: (
                        <ToastAction altText="View" onClick={navigateToConversation}>
                            View
                        </ToastAction>
                        ),
                        onClick: navigateToConversation,
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


    const handleDepartmentChange = useCallback((departmentId: string) => {
        setSelectedDepartmentId(departmentId);
    }, []);

    const filteredPhoneNumbers = selectedDepartmentId
        ? phoneNumbers.filter(
            (num) => num.department_id != null && String(num.department_id) === selectedDepartmentId
          )
        : phoneNumbers;

    useEffect(() => {
        if (!selectedDepartmentId) return;
        const hasSelectedNumber = filteredPhoneNumbers.some((num) => num.phone_no === selectedFromNumber);
        if (!hasSelectedNumber) {
            setSelectedFromNumber(filteredPhoneNumbers[0]?.phone_no ?? "");
        }
    }, [selectedDepartmentId, filteredPhoneNumbers, selectedFromNumber]);
    
    useEffect(() => {
        const fetchInitialData = async () => {
            if (!user?.company_id) return;

            const cacheKey = `header-init:${user.id}`;
            const cached = cacheGet<{
              departments: Department[];
              contacts: Contact[];
              phoneNumbers: PhoneNumber[];
              firstDeptId?: string;
            }>(cacheKey);
            if (cached) {
              setDepartments(cached.departments);
              setContacts(cached.contacts);
              setPhoneNumbers(cached.phoneNumbers);
              if (cached.firstDeptId) {
                setSelectedDepartmentId(cached.firstDeptId);
                const numbersForDept = cached.phoneNumbers.filter(
                  (num) => num.department_id != null && String(num.department_id) === cached.firstDeptId
                );
                setSelectedFromNumber(numbersForDept[0]?.phone_no ?? cached.phoneNumbers[0]?.phone_no ?? "");
              } else if (cached.phoneNumbers.length > 0) {
                setSelectedFromNumber(cached.phoneNumbers[0].phone_no);
              }
              setLoadingDepartments(false);
              return;
            }

            setLoadingDepartments(true);
            setLoadingNumbers(true);
            try {
                const canFetchAllDepts = canListAllCompanyDepartments(user.role_id);
                const [fetchedDepts, fetchedContacts, fetchedNumbers] = await Promise.all([
                    canFetchAllDepts
                        ? getDepartments(user.company_id)
                        : getUserDepartments(user.id),
                    getContacts(user.company_id),
                    getCompanyPhoneNumbers(user.company_id),
                ]);
                const depts = Array.isArray(fetchedDepts) ? fetchedDepts : [];
                const contactList = Array.isArray(fetchedContacts) ? fetchedContacts : [];
                const numbers = Array.isArray(fetchedNumbers) ? fetchedNumbers : [];
                setDepartments(depts);
                setContacts(contactList);
                setPhoneNumbers(numbers);

                let firstDeptId: string | undefined;
                if (depts.length > 0) {
                    firstDeptId = String(depts[0].id);
                    setSelectedDepartmentId(firstDeptId);
                    const numbersForDept = numbers.filter(
                      (num) => num.department_id != null && String(num.department_id) === firstDeptId
                    );
                    setSelectedFromNumber(numbersForDept[0]?.phone_no ?? numbers[0]?.phone_no ?? "");
                } else if (numbers.length > 0) {
                    setSelectedFromNumber(numbers[0].phone_no);
                }

                cacheSet(cacheKey, {
                  departments: depts,
                  contacts: contactList,
                  phoneNumbers: numbers,
                  firstDeptId,
                }, 60_000);
            } catch (error) {
                toast({ title: "Error", description: "Failed to load initial data.", variant: "destructive" });
            } finally {
                setLoadingDepartments(false);
                setLoadingNumbers(false);
            }
        };
        fetchInitialData();
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

        const liveConnection = activeCall || twilioConnection;
        const callStatus = liveConnection?.status?.();
        const isInLiveCall = callStatus === 'open';
        const isCallConnecting =
          !!callStatus && !['closed', 'disconnected'].includes(callStatus) && !isInLiveCall;
        const conferenceSidForConsult = activeConferenceSid || twilioConferenceSid;

        if (isCallConnecting) {
            toast({
                title: "Call connecting",
                description: "Please wait for the current call to connect before dialing another number.",
                variant: "destructive",
            });
            return;
        }

        if (isInLiveCall && liveConnection) {
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
                    setActiveConferenceSid(consultResult.data.conference_sid);
                }
                setDialerOpen(false);
                toast({
                    title: 'Consult call started',
                    description: `${formatPhoneNumber(number)} is being called as a consult leg.`,
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
            setActiveConferenceSid(null);

            const params: { To: string, From?: string, conferenceSid?: string, direction?: string } = { To: number };
            if (fromNumber) {
                params.From = fromNumber;
                params.direction = "outbound";
                setFromNumber(fromNumber);
                localStorage.setItem("twilioFromNumber", fromNumber);
            }
            const connection = await device.connect({ params });
            if (connection.status() === 'pending') {
                connection.accept();
            }
            setDialerOpen(false);

            setActiveContactName(number);
            const selectedDepartment = departments.find((dept) => String(dept.id) === selectedDepartmentId);
            setActiveDepartmentName(selectedDepartment?.name || null);
            setActiveCall(connection);
            setIsActiveCallOpen(true);

           connection.on('accept', async () => {
                console.log('Call accepted');
                const callSid = connection.parameters.CallSid;
                try {
                    const data = await getconferenceSid(callSid);
                    if (data.conferenceSid) {
                        setConferenceSid(data.conferenceSid);
                        setActiveConferenceSid(data.conferenceSid);
                    } else {
                        console.warn('No conferenceSid found yet.');
                    }
                } catch (e) {
                    console.error('Error fetching conferenceSid:', e);
                }
            });

            connection.on('disconnect', () => {
                setIsActiveCallOpen(false);
                setActiveCall(null);
                setActiveDepartmentName(null);
                setActiveConferenceSid(null);
                setConferenceSid(null);
            });

            connection.on('cancel', () => {
                setIsActiveCallOpen(false);
                setActiveCall(null);
                setActiveDepartmentName(null);
                setActiveConferenceSid(null);
                setConferenceSid(null);
            });

            connection.on('reject', () => {
                setIsActiveCallOpen(false);
                setActiveCall(null);
                setActiveDepartmentName(null);
                setActiveConferenceSid(null);
                setConferenceSid(null);
            });
        } catch (error) {
            console.error("Error making call:", error);
            toast({ title: "Call Error", description: "Failed to make call. See console for details.", variant: 'destructive'});
        }
    };
    
    const handleContactSelect = (contact: Contact) => {
        setSearchValue('');
        setSearchOpen(false);
        
        if (setControlledDialerOpen !== undefined) {
            setControlledDialerOpen(true);
        } else {
            setInternalDialerOpen(true);
        }
        
        // This relies on the dialer being able to receive the initial value.
        setInternalDialerInitialValue(contact.phone_no.replace(/^\+1/, ''));
    };

    
    const filteredContacts = searchValue
    ? contacts.filter(
        contact =>
          contact.name.toLowerCase().includes(searchValue.toLowerCase()) ||
          contact.phone_no.includes(searchValue)
      )
    : [];

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
            <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background shadow-sm">
                <div className="flex items-center gap-4">
                    <SidebarTrigger className="md:hidden" />
                     {pageTitle ? (
                        <h1 className="text-xl font-bold">{pageTitle}</h1>
                     ) : (
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search contacts..."
                                className="pl-9"
                                value={searchValue}
                                onFocus={() => setSearchOpen(true)}
                                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                                onChange={(e) => setSearchValue(e.target.value)}
                            />
                            {searchOpen && filteredContacts.length > 0 && (
                                <div className="absolute z-10 top-full mt-1 w-full bg-background border rounded-md shadow-lg">
                                    <ScrollArea className="max-h-60 overflow-y-auto">
                                        {filteredContacts.map(contact => (
                                            <div 
                                                key={contact.id}
                                                onMouseDown={() => handleContactSelect(contact)}
                                                className="p-2 hover:bg-accent cursor-pointer"
                                            >
                                                <p className="font-medium">{contact.name}</p>
                                                <p className="text-xs text-muted-foreground">{formatPhoneNumber(contact.phone_no)}</p>
                                            </div>
                                        ))}
                                    </ScrollArea>
                                </div>
                            )}
                        </div>
                     )}
                </div>
                <div className="flex items-center gap-4">
                    <TwilioStatusIndicator />
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
                        onSetSelectedFromNumber={setSelectedFromNumber}
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
                     <Button variant="ghost" size="icon" onClick={() => router.push('/messages')}><MessageSquare className="h-5 w-5" /></Button>
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
            
            <ActiveCallBar
              isOpen={isActiveCallOpen}
              contactNumber={activeContactName}
              callerName={activeContactName}
              departmentName={activeDepartmentName}
              connection={activeCall}
              conferenceSid={activeConferenceSid}
              onHangUp={() => {
                activeCall?.disconnect();
                setIsActiveCallOpen(false);
                setActiveCall(null);
                setActiveDepartmentName(null);
                setActiveConferenceSid(null);
                setConferenceSid(null);
              }}
            />
        </>
    );
}
