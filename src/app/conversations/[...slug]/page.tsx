
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getCommunicationThread, markRead } from "@/services/callLogService";
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
import { cn, formatPhoneNumber } from "@/lib/utils";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

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
    const [isProfileSidebarOpen, setIsProfileSidebarOpen] = useState(false);
    
    const slug = params.slug ? (Array.isArray(params.slug) ? params.slug : [params.slug]) : [];
    const [from, to] = slug.map(part => decodeURIComponent(part));

    const findContact = (phone: string, contactList: Contact[]) => {
        if(!contactList || contactList.length === 0) return null;
        return contactList.find(c => c.phone_no === phone);
    };

    const refreshThread = useCallback(async () => {
        if (!user) return;
        try {
            const [logs, fetchedContacts] = await Promise.all([
                getCommunicationThread(from, to),
                user.company_id ? getContacts(user.company_id) : Promise.resolve([])
            ]);
            
            const contactList = Array.isArray(fetchedContacts) ? fetchedContacts : [];
            setContacts(contactList);

            const sortedLogs = logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            setAllComms(sortedLogs);

             if (sortedLogs.length > 0) {
                const latestComm = sortedLogs[sortedLogs.length - 1];
                const otherPartyNumber = latestComm.direction === 'inbound' ? latestComm.from : latestComm.to;
                const foundContact = findContact(otherPartyNumber, contactList);
                
                setContact({
                    ...(foundContact || {}),
                    phone_no: otherPartyNumber,
                    name: foundContact?.name || formatPhoneNumber(otherPartyNumber)
                });
             } else {
                 const otherPartyNumber = to;
                 const foundContact = findContact(otherPartyNumber, contactList);
                 setContact({
                    ...(foundContact || {}),
                    phone_no: otherPartyNumber,
                    name: foundContact?.name || formatPhoneNumber(otherPartyNumber)
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
                
                const unreadLogs = sortedLogs.filter(l => l.id && (l.is_read === 0));
                
                if (unreadLogs.length > 0) {
                    await Promise.all(
                        unreadLogs.map(log => markRead(String(log.id), log.type))
                    );
                    try { events.emit('refreshDepartmentsUnread'); } catch (_) {}
                }
                
                // Determine which number is the external contact
                const allCompanyNumbers = new Set<string>();
                for (const dept of depts) {
                    try {
                        const nums = await getPhoneNumbers(dept.id);
                        nums.forEach(n => allCompanyNumbers.add(n.phone_no));
                    } catch (e) {}
                }

                let otherPartyNumber: string;
                let ourNumber: string;

                if (allCompanyNumbers.has(from) && !allCompanyNumbers.has(to)) {
                    otherPartyNumber = to;
                    ourNumber = from;
                } else if (!allCompanyNumbers.has(from) && allCompanyNumbers.has(to)) {
                    otherPartyNumber = from;
                    ourNumber = to;
                } else {
                    // Fallback for ambiguity - check latest message
                    if (sortedLogs.length > 0) {
                        const lastLog = sortedLogs[sortedLogs.length - 1];
                        if (lastLog.direction === 'inbound') {
                           otherPartyNumber = lastLog.from;
                           ourNumber = lastLog.to;
                        } else {
                           otherPartyNumber = lastLog.to;
                           ourNumber = lastLog.from;
                        }
                    } else {
                       // Best guess
                       otherPartyNumber = to;
                       ourNumber = from;
                    }
                }
                
                const foundContact = contactList.find(c => c.phone_no === otherPartyNumber);
                setContact({
                    ...(foundContact || {}),
                    phone_no: otherPartyNumber,
                    name: foundContact?.name || formatPhoneNumber(otherPartyNumber)
                });
                
                // Determine and set the correct department and from number
                let resolvedDeptId: string | null = null;
                for (const dept of depts) {
                    try {
                        const nums = await getPhoneNumbers(dept.id);
                        if (nums.some(n => n.phone_no === ourNumber)) {
                            resolvedDeptId = String(dept.id);
                            break;
                        }
                    } catch(e) {}
                }

                if (!resolvedDeptId && depts.length > 0) {
                    resolvedDeptId = String(depts[0].id); // fallback
                }

                if (resolvedDeptId) {
                    setSelectedDepartmentId(resolvedDeptId);
                    await handleDepartmentChange(resolvedDeptId);
                    
                    // This is important: re-fetch numbers for the resolved dept and set the `from` number
                    try {
                        const numsForDept = await getPhoneNumbers(Number(resolvedDeptId));
                        if(numsForDept.some(n => n.phone_no === ourNumber)) {
                            setSelectedFromNumber(ourNumber);
                        } else if (numsForDept.length > 0) {
                            setSelectedFromNumber(numsForDept[0].phone_no);
                        }
                    } catch(e) {}
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

        const refreshCallsHandler = () => {
          // This will be triggered by 'refresh_listing'
          refreshThread();
        };

        events.on('refreshConversation', handler);
        events.on('refreshCalls', refreshCallsHandler);
        return () => {
            events.off('refreshConversation', handler);
            events.off('refreshCalls', refreshCallsHandler);
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
                        <ResizablePanelGroup direction="horizontal" className="flex-1 flex overflow-hidden">
                           <ResizablePanel defaultSize={75}>
                                <div className={cn("flex flex-col h-full bg-background text-foreground overflow-hidden")}>
                                    <header className="flex-shrink-0 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background/80 backdrop-blur-sm">
                                        <div className="flex items-center gap-4">
                                            <Button variant="ghost" size="icon" onClick={() => router.back()}>
                                                <ArrowLeft />
                                            </Button>
                                            <div className="relative flex-1">
                                                <h1 className="text-xl font-bold">{contact?.name}</h1>
                                                <p className="text-sm text-muted-foreground">{formatPhoneNumber(contact?.phone_no)}</p>
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
                                            <Select onValueChange={handleDepartmentChange} value={selectedDepartmentId} disabled={loadingDepartments}>
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
                                            <Select onValueChange={setSelectedFromNumber} value={selectedFromNumber} disabled={loadingNumbers || !selectedDepartmentId}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select Number" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {phoneNumbers.map((num) => (
                                                        <SelectItem key={num.id} value={num.phone_no}>
                                                            {formatPhoneNumber(num.phone_no)} ({num.label})
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
                            </ResizablePanel>
                             {isProfileSidebarOpen && (
                                <>
                                    <ResizableHandle withHandle />
                                    <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
                                        <aside className="border-l bg-background overflow-y-auto h-full">
                                            <ContactProfile contact={contact} onContactUpdate={refreshThread} onCollapse={() => setIsProfileSidebarOpen(false)} />
                                        </aside>
                                    </ResizablePanel>
                                </>
                            )}
                        </ResizablePanelGroup>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
