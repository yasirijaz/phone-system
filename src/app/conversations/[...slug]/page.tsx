
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getCommunicationThread, markThreadAsRead } from "@/services/callLogService";
import type { Communication, Contact, Department, PhoneNumber } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, PanelRightClose, PanelRightOpen, User } from "lucide-react";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import CallLog from "@/components/call-log";
import { InAppSidebar } from "@/components/in-app-sidebar";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTwilio } from "@/context/TwilioContext";
import { useToast } from "@/hooks/use-toast";
import AppHeader from "@/components/app-header";
import { getDepartments } from "@/services/departmentService";
import { getUserDepartments } from "@/services/userService";
import { getPhoneNumbers } from "@/services/phoneNumberService";
import { sendSms } from "@/services/twilioService";
import { getContacts } from "@/services/contactService";
import { events } from "@/lib/events";
import ContactProfile from "@/components/contact-profile";
import { cn } from "@/lib/utils";

export default function ConversationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, logout } = useAuth();
    const { toast } = useToast();
    const { device, isDeviceReady } = useTwilio();

    const [allComms, setAllComms] = useState<Communication[]>([]);
    const [loading, setLoading] = useState(true);
    const [contact, setContact] = useState<any>(null);
    const [messageBody, setMessageBody] = useState('');
    const [isSending, setIsSending] = useState(false);
    
    const [departments, setDepartments] = useState<Department[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    const [selectedFromNumber, setSelectedFromNumber] = useState<string>('');
    const [loadingDepartments, setLoadingDepartments] = useState(true);
    const [loadingNumbers, setLoadingNumbers] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isProfileSidebarOpen, setIsProfileSidebarOpen] = useState(true);
    
    const slug = params.slug ? (Array.isArray(params.slug) ? params.slug : [params.slug]) : [];
    const [from, to] = slug.map(part => decodeURIComponent(part));

    const findContact = (phone: string) => {
        if(!contacts || contacts.length === 0) return null;
        return contacts.find(c => c.phone_no === phone);
    };

    const refreshThread = useCallback(async () => {
        try {
            const [logs, fetchedContacts] = await Promise.all([
                getCommunicationThread(from, to),
                user?.company_id ? getContacts(user.company_id) : Promise.resolve([])
            ]);
            setContacts(Array.isArray(fetchedContacts) ? fetchedContacts : []);

            const sortedLogs = logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            setAllComms(sortedLogs);

             if (sortedLogs.length > 0) {
                const latestComm = sortedLogs[sortedLogs.length - 1];
                const otherPartyNumber = latestComm.direction === 'inbound' ? latestComm.from : latestComm.to;
                const foundContact = findContact(otherPartyNumber);
                
                setContact({
                    ...(foundContact || {}),
                    phone_no: otherPartyNumber,
                    name: foundContact?.name || otherPartyNumber
                });
             }
        } catch (e) {
            console.error('Failed to refresh conversation thread', e);
        }
    }, [from, to, user]);

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
                // Try to keep the previously selected number if it exists in the new list
                const currentNumberIsValid = numbers.some(n => n.phone_no === selectedFromNumber);
                if (!currentNumberIsValid) {
                    setSelectedFromNumber(numbers[0].phone_no);
                }
            } else {
                setSelectedFromNumber('');
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to load phone numbers for this department.", variant: "destructive" });
        } finally {
            setLoadingNumbers(false);
        }
    }, [toast, selectedFromNumber]);

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!user) return;
            setLoading(true);
            setLoadingDepartments(true);

            try {
                const isAdmin = user.role_id === 1 || user.role_id === 2;
                const [fetchedDepts, fetchedContacts, logs] = await Promise.all([
                    isAdmin && user.company_id
                        ? getDepartments(user.company_id)
                        : getUserDepartments(user.id),
                    user.company_id ? getContacts(user.company_id) : Promise.resolve([]),
                    getCommunicationThread(from, to)
                ]);
                const depts = Array.isArray(fetchedDepts) ? fetchedDepts : [];
                setDepartments(depts);

                const contactList = Array.isArray(fetchedContacts) ? fetchedContacts : [];
                setContacts(contactList);
                
                const sortedLogs = logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                setAllComms(sortedLogs);

                const hasUnread = sortedLogs.some((l: any) => l?.is_read === 0 || l?.is_read === false);
                if (hasUnread) {
                    await markThreadAsRead(from, to);
                    try { events.emit('refreshDepartmentsUnread'); } catch (_) {}
                }
                
                if (sortedLogs.length > 0) {
                    const latestComm = sortedLogs[sortedLogs.length - 1];
                    const otherPartyNumber = latestComm.direction === 'inbound' ? latestComm.from : latestComm.to;
                    const foundContact = contactList.find(c => c.phone_no === otherPartyNumber);
                    
                    setContact({
                        ...(foundContact || {}),
                        phone_no: otherPartyNumber,
                        name: foundContact?.name || otherPartyNumber
                    });

                    const lastUsedOurNumber = latestComm.direction === 'inbound' ? latestComm.to : latestComm.from;

                    let resolvedDeptId: string | null = latestComm.department_id
                        ? String(latestComm.department_id)
                        : null;

                    const findDepartmentIdByNumber = async (phone: string): Promise<string | null> => {
                        for (const d of depts) {
                            try {
                                const nums = await getPhoneNumbers(d.id);
                                if (nums.some(n => n.phone_no === phone)) {
                                    return String(d.id);
                                }
                            } catch (e) {}
                        }
                        return null;
                    };

                    if (!resolvedDeptId && depts.length > 0) {
                        resolvedDeptId = await findDepartmentIdByNumber(lastUsedOurNumber);
                        if (!resolvedDeptId) {
                            resolvedDeptId = await findDepartmentIdByNumber(from);
                        }
                        if (!resolvedDeptId) {
                            resolvedDeptId = String(depts[0].id);
                        }
                    }

                    if (resolvedDeptId) {
                        setSelectedDepartmentId(resolvedDeptId);
                        await handleDepartmentChange(resolvedDeptId); 

                        try {
                            const nums = await getPhoneNumbers(Number(resolvedDeptId));
                            if (nums.some(n => n.phone_no === lastUsedOurNumber)) {
                                setSelectedFromNumber(lastUsedOurNumber);
                            }
                        } catch (_) {}
                    }
                } else {
                     setContact({ phone_no: to, name: to });
                     if (depts.length > 0) {
                        let deptId: string | null = null;
                        for (const d of depts) {
                            try {
                                const nums = await getPhoneNumbers(d.id);
                                if (nums.some(n => n.phone_no === from)) {
                                    deptId = String(d.id);
                                    break;
                                }
                            } catch (_) {}
                        }
                        const finalDeptId = deptId ?? String(depts[0].id);
                        await handleDepartmentChange(finalDeptId);
                        try {
                            const nums = await getPhoneNumbers(Number(finalDeptId));
                            if (nums.some(n => n.phone_no === from)) {
                                setSelectedFromNumber(from);
                            }
                        } catch (_) {}
                    }
                }

            } catch (error) {
                console.error("Failed to fetch data", error);
                toast({ title: "Error", description: "Failed to load conversation details.", variant: "destructive" });
            } finally {
                setLoading(false);
                setLoadingDepartments(false);
            }
        };

        if (user && from && to) {
            fetchInitialData();
        }
    }, [user, from, to, toast, handleDepartmentChange, searchParams]);

    useEffect(() => {
        const handler = (payload: { from: string; to: string }) => {
            const matches = (payload.from === from && payload.to === to) || (payload.from === to && payload.to === from);
            if (matches) {
                refreshThread();
            }
        };
        events.on('refreshConversation', handler);
        return () => {
            events.off('refreshConversation', handler);
        };
    }, [from, to, refreshThread]);
    
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
        }
    }, [allComms, loading]);


    const handleMakeCall = async (number: string) => {
        if (!device || !isDeviceReady) {
            toast({ title: "Twilio Error", description: "Twilio Device not ready.", variant: 'destructive'});
            return;
        }
        console.log("Request to call from conversation detail:", number);
    };

    const handleSendMessage = async () => {
        const recipient = contact?.phone_no;
        if (!selectedFromNumber) {
            toast({ title: "Error", description: "Please select a 'from' number.", variant: "destructive" });
            return;
        }
        if (!recipient) {
            toast({ title: "Error", description: "Could not determine recipient.", variant: "destructive" });
            return;
        }
        if (!messageBody) {
            toast({ title: "Error", description: "Message body cannot be empty.", variant: "destructive" });
            return;
        }
        setIsSending(true);
        try {
            await sendSms(selectedFromNumber, recipient, messageBody);
            toast({ title: "Success", description: "Message sent successfully." });
            setMessageBody("");
            const logs = await getCommunicationThread(from, to);
            const sortedLogs = logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            setAllComms(sortedLogs);
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || "Failed to send message.";
            toast({ title: "Error", description: errorMessage, variant: "destructive" });
        } finally {
            setIsSending(false);
        }
    };


    return (
        <SidebarProvider>
            <Sidebar>
                <InAppSidebar />
            </Sidebar>
            <SidebarInset>
                 <div className="flex h-screen w-full bg-background text-foreground">
                    <div className="flex-1 flex flex-col">
                        <AppHeader user={user} logout={logout} />
                        <div className="flex-1 flex overflow-hidden">
                            <div className={cn("flex flex-col h-full bg-background text-foreground overflow-hidden transition-all duration-300", isProfileSidebarOpen ? "w-full md:w-2/3 lg:w-3/4" : "w-full")}>
                                <header className="flex-shrink-0 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background/80 backdrop-blur-sm">
                                    <div className="flex items-center gap-4">
                                        <Button variant="ghost" size="icon" onClick={() => router.back()}>
                                            <ArrowLeft />
                                        </Button>
                                        <div className="relative flex-1">
                                            <h1 className="text-xl font-bold">{contact?.name}</h1>
                                            <p className="text-sm text-muted-foreground">{contact?.phone_no}</p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setIsProfileSidebarOpen(!isProfileSidebarOpen)}>
                                        {isProfileSidebarOpen ? <PanelRightClose /> : <User />}
                                    </Button>
                                </header>
                                <main className="flex-1 overflow-y-auto">
                                {loading ? <p className="p-4">Loading...</p> : <CallLog calls={allComms} contacts={contacts} onMakeCall={handleMakeCall} isClickable={false} />}
                                <div ref={messagesEndRef} />
                                </main>
                                <footer className="flex-shrink-0 p-4 border-t bg-background space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <Select onValueChange={handleDepartmentChange} value={selectedDepartmentId} disabled={loadingDepartments || allComms.length > 0}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Department" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {departments.map((dept) => (
                                                    <SelectItem key={dept.id} value={String(dept.id)}>
                                                        {dept.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Select onValueChange={setSelectedFromNumber} value={selectedFromNumber} disabled={loadingNumbers || !selectedDepartmentId || allComms.length > 0}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Number" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {phoneNumbers.map((num) => (
                                                    <SelectItem key={num.id} value={num.phone_no}>
                                                        {num.phone_no} ({num.label})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="relative">
                                        <Textarea 
                                            placeholder="Write Your Message..."
                                            className="pr-10"
                                            value={messageBody}
                                            onChange={(e) => setMessageBody(e.target.value)}
                                        />
                                        <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={handleSendMessage} disabled={isSending}>
                                            {isSending ? '...' : <Send className="h-5 w-5"/>}
                                        </Button>
                                    </div>
                                </footer>
                            </div>
                            <aside className={cn("border-l bg-background overflow-y-auto transition-all duration-300", isProfileSidebarOpen ? "w-full md:w-1/3 lg:w-1/4" : "w-0 hidden")}>
                                <ContactProfile contact={contact} onContactUpdate={refreshThread} onCollapse={() => setIsProfileSidebarOpen(false)} />
                            </aside>
                        </div>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
