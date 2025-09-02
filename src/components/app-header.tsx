
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Department, PhoneNumber, Contact, User } from "@/types";
import { useTwilio } from '@/context/TwilioContext';
import { useToast } from "@/hooks/use-toast";
import { getDepartments } from "@/services/departmentService";
import { getUserDepartments } from "@/services/userService";
import { getPhoneNumbers, getconferenceSid } from "@/services/phoneNumberService";
import { getContacts } from "@/services/contactService";
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Search, Phone, MessageSquare, Video, Settings, LogOut } from "lucide-react";
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
    const { device, isDeviceReady, connectTwilio, activityName, toggleActivity, setFromNumber, setConferenceSid } = useTwilio();
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
    const [activeConferenceSid, setActiveConferenceSid] = useState<string | null>(null);

    // Search state
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchValue, setSearchValue] = useState("");
    const socketRef = useRef<WebSocket | null>(null);
    
    useEffect(() => {
        connectTwilio();
    }, [connectTwilio]);
    
    useEffect(() => {
        if (!user) {
        if (socketRef.current) {
            socketRef.current.close();
            socketRef.current = null;
        }
        return;
        }
        if (socketRef.current) return;

        const WS_URL = `wss://socket.windshieldhub.com?user_id=${user.id}`;
        const newSocket = new WebSocket(WS_URL);

        socketRef.current = newSocket;

        newSocket.onopen = () => {
            console.log("WebSocket connection established in AppHeader");
        };

        newSocket.onmessage = (evt) => {
        try {
            const data = JSON.parse(evt.data);
            console.log("WebSocket message received:", data);
            if (data.method_type === "refresh_listing") {
                console.log("Emitting refreshCalls");
                events.emit("refreshCalls");
            }
             if (data.method_type === "show_sms_notification" && data.data) {
                const { from, to, body } = data.data;
                const navigateToConversation = () => {
                    router.push(`/conversations/${encodeURIComponent(from)}/${encodeURIComponent(to)}`);
                };

                toast({
                    title: `New Message from ${from}`,
                    description: body,
                    action: <ToastAction altText="View" onClick={navigateToConversation}>View</ToastAction>,
                    onClick: navigateToConversation,
                    className: "cursor-pointer"
                });
            }
        } catch (e) {
            console.warn("Non-JSON message:", evt.data);
        }
        };

        newSocket.onerror = () => {
        try {
            newSocket.close();
        } catch {}
        };

        newSocket.onclose = () => {
            console.log("WebSocket closed in AppHeader");
        };

        return () => {
            if (socketRef.current) {
                socketRef.current.close();
                socketRef.current = null;
            }
        };
    }, [user, toast, router]);

    const handleDepartmentChange = useCallback(async (departmentId: string) => {
        setSelectedDepartmentId(departmentId);
        if (!departmentId) {
            setPhoneNumbers([]);
            setSelectedFromNumber('');
            return;
        }
        setLoadingNumbers(true);
        try {
            const numbers = await getPhoneNumbers(Number(departmentId));
            setPhoneNumbers(numbers);
            if (numbers.length > 0) {
                setSelectedFromNumber(numbers[0].phone_no);
            } else {
                setSelectedFromNumber('');
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to load phone numbers for this department.", variant: "destructive" });
        } finally {
            setLoadingNumbers(false);
        }
    }, [toast]);
    
    useEffect(() => {
        const fetchInitialData = async () => {
            if (!user) return;
            setLoadingDepartments(true);
            try {
                const isAdmin = user.role_id === 1 || user.role_id === 2;
                const [fetchedDepts, fetchedContacts] = await Promise.all([
                    isAdmin && user.company_id
                        ? getDepartments(user.company_id)
                        : getUserDepartments(user.id),
                    user.company_id ? getContacts(user.company_id) : Promise.resolve([])
                ]);
                const depts = Array.isArray(fetchedDepts) ? fetchedDepts : [];
                setDepartments(depts);
                setContacts(Array.isArray(fetchedContacts) ? fetchedContacts : []);
                if (depts.length > 0) {
                    handleDepartmentChange(String(depts[0].id));
                }
            } catch (error) {
                toast({ title: "Error", description: "Failed to load initial data.", variant: "destructive" });
            } finally {
                setLoadingDepartments(false);
            }
        };
        fetchInitialData();
    }, [user, toast, handleDepartmentChange]);
    
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
    
        try {
            const params: { To: string, From?: string, direction?: string, autoAccept?: string } = { To: number };
            if (fromNumber) {
                params.autoAccept = "0";
                params.From = fromNumber;
                params.direction = "outbound";
                setFromNumber(fromNumber);
            }
            const connection = await device.connect({ params });
            setDialerOpen(false);

            setActiveContactName(number);
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
                setActiveConferenceSid(null);
            });

            connection.on('cancel', () => {
                setIsActiveCallOpen(false);
                setActiveCall(null);
                setActiveConferenceSid(null);
            });

            connection.on('reject', () => {
                setIsActiveCallOpen(false);
                setActiveCall(null);
                setActiveConferenceSid(null);
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
                                    <ScrollArea className="max-h-60">
                                        {filteredContacts.map(contact => (
                                            <div 
                                                key={contact.id}
                                                onMouseDown={() => handleContactSelect(contact)}
                                                className="p-2 hover:bg-accent cursor-pointer"
                                            >
                                                <p className="font-medium">{contact.name}</p>
                                                <p className="text-xs text-muted-foreground">{contact.phone_no}</p>
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
                     <select
                        value={activityName || ''}
                        onChange={(e) => toggleActivity(e.target.value)}
                        className={`text-xs px-2 py-1 rounded border ${
                            activityName === 'Available' ? 'bg-green-500 text-white' :
                            activityName === 'Unavailable' ? 'bg-yellow-500 text-white' :
                            activityName === 'Offline' ? 'bg-red-500 text-white' :
                            'bg-gray-200 text-black'
                        }`}
                        >
                        <option value="Available">Available</option>
                        <option value="Unavailable">Unavailable</option>
                        <option value="Offline">Offline</option>
                    </select>
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
                                    <AvatarImage src={`https://placehold.co/100x100.png?text=${userInitial}`} alt={user?.name} />
                                    <AvatarFallback>{userInitial}</AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                                <Link href="/profile">
                                    <Settings className="mr-2" />
                                    <span>Profile</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={logout}>
                                <LogOut className="mr-2" />
                                <span>Logout</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>
              
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
              contactName={activeContactName}
              connection={activeCall}
              conferenceSid={activeConferenceSid}
              onHangUp={() => {
                activeCall?.disconnect();
                setIsActiveCallOpen(false);
                setActiveCall(null);
                setActiveConferenceSid(null);
              }}
            />
        </>
    );
}
