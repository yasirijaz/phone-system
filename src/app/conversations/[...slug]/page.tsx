
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getCommunicationThread, markRead } from "@/services/callLogService";
import type { Communication, Contact, Department, PhoneNumber } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PanelRightClose, User, Phone } from "lucide-react";
import CallLog from "@/components/call-log";
import MessageComposer from "@/components/message-composer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTwilio } from "@/context/TwilioContext";
import { useToast } from "@/hooks/use-toast";
import { useUnusualDepartmentSmsGuard } from "@/hooks/use-unusual-department-sms-guard";
import AppHeader from "@/components/app-header";
import { getDepartments } from "@/services/departmentService";
import { getUserDepartments } from "@/services/userService";
import { getCompanyPhoneNumbers } from "@/services/phoneNumberService";
import { sendMms } from "@/services/twilioService";
import { getContacts } from "@/services/contactService";
import { events } from "@/lib/events";
import ContactProfile from "@/components/contact-profile";
import { cn, formatPhoneNumber, phonesMatch, getPhoneNumberOptionLabel, isSameConversationThread } from "@/lib/utils";
import { buildThreadContactState } from "@/lib/contact-display";
import { canListAllCompanyDepartments } from "@/lib/roles";
import {
    findLastUsedDepartmentId,
    resolveOutboundContextFromDepartmentId,
} from "@/lib/department-selection";
import type { OutboundContext } from "@/lib/outbound-context";

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
    const chatScrollRef = useRef<HTMLElement>(null);
    const [isProfileSidebarOpen, setIsProfileSidebarOpen] = useState(false);
    const [departmentName, setDepartmentName] = useState<string | null>(null);
    const { confirmIfNeeded: confirmUnusualDepartmentSms, dialog: unusualDepartmentSmsDialog } =
        useUnusualDepartmentSmsGuard(departments);
    
    const slug = params.slug ? (Array.isArray(params.slug) ? params.slug : [params.slug]) : [];
    const [from, to] = slug.map(part => decodeURIComponent(part));

    const findContact = (phone: string, contactList: Contact[]) => {
        if(!contactList || contactList.length === 0) return null;
        return contactList.find(c => phonesMatch(c.phone_no, phone)) ?? null;
    };

    const refreshThread = useCallback(async (options?: { bypassCache?: boolean }) => {
        if (!user) return;
        try {
            const [logs, fetchedContacts] = await Promise.all([
                getCommunicationThread(from, to, { bypassCache: options?.bypassCache }),
                user.company_id ? getContacts(user.company_id) : Promise.resolve([])
            ]);
            
            const contactList = Array.isArray(fetchedContacts) ? fetchedContacts : [];
            setContacts(contactList);

            const sortedLogs = logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            setAllComms(sortedLogs);

            const unreadLogs = sortedLogs.filter((l) => l.id && l.is_read === 0);
            if (unreadLogs.length > 0) {
                await Promise.all(
                    unreadLogs.map((log) => markRead(String(log.id), log.type))
                );
                try { events.emit('refreshDepartmentsUnread'); } catch (_) {}
            }

             if (sortedLogs.length > 0) {
                const latestComm = sortedLogs[sortedLogs.length - 1];
                const otherPartyNumber = latestComm.direction === 'inbound' ? latestComm.from : latestComm.to;
                const foundContact = findContact(otherPartyNumber, contactList);

                setContact(buildThreadContactState(sortedLogs, otherPartyNumber, foundContact));
             } else {
                 const otherPartyNumber = to;
                 const foundContact = findContact(otherPartyNumber, contactList);

                 setContact(buildThreadContactState([], otherPartyNumber, foundContact));
             }
        } catch (e) {
            console.error('Failed to refresh conversation thread', e);
        }
    }, [from, to, user]);

     const handleDepartmentChange = useCallback((departmentId: string) => {
        setSelectedDepartmentId(departmentId);
    }, []);

    const filteredPhoneNumbers = selectedDepartmentId
        ? phoneNumbers.filter(
            (num) => num.department_id != null && String(num.department_id) === selectedDepartmentId
          )
        : [];

    useEffect(() => {
        if (!selectedDepartmentId) {
            setSelectedFromNumber("");
            return;
        }
        const hasSelectedNumber = filteredPhoneNumbers.some((num) => num.phone_no === selectedFromNumber);
        if (!hasSelectedNumber) {
            setSelectedFromNumber(filteredPhoneNumbers[0]?.phone_no ?? "");
        }
    }, [selectedDepartmentId, filteredPhoneNumbers, selectedFromNumber]);

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!user) return;
            setLoading(true);
            setLoadingDepartments(true);
            setLoadingNumbers(true);

            try {
                const canFetchAllDepts = canListAllCompanyDepartments(user.role_id);
                const [fetchedDepts, fetchedContacts, logs, companyNumbers] = await Promise.all([
                    canFetchAllDepts && user.company_id
                        ? getDepartments(user.company_id)
                        : getUserDepartments(user.id),
                    user.company_id ? getContacts(user.company_id) : Promise.resolve([]),
                    getCommunicationThread(from, to),
                    user.company_id ? getCompanyPhoneNumbers(user.company_id) : Promise.resolve([]),
                ]);
                const depts = Array.isArray(fetchedDepts) ? fetchedDepts : [];
                const numbers = Array.isArray(companyNumbers) ? companyNumbers : [];
                setDepartments(depts);
                setPhoneNumbers(numbers);

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
                
                const allCompanyNumbers = new Set<string>();
                const numberToDeptMap: Record<string, string> = {};
                const numberToDeptIdMap: Record<string, string> = {};
                numbers.forEach((n) => {
                    allCompanyNumbers.add(n.phone_no);
                    if (n.department?.name) {
                        numberToDeptMap[n.phone_no] = n.department.name;
                    }
                    if (n.department_id) {
                        numberToDeptIdMap[n.phone_no] = String(n.department_id);
                    }
                });

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
                
                const foundContact = contactList.find(c => phonesMatch(c.phone_no, otherPartyNumber));
                setContact(buildThreadContactState(sortedLogs, otherPartyNumber, foundContact ?? null));
                
                if (numberToDeptMap[ourNumber]) {
                    setDepartmentName(numberToDeptMap[ourNumber]);
                }

                // Determine and set the correct department and from number
                let resolvedDeptId: string | null = numberToDeptIdMap[ourNumber] ?? null;

                if (!resolvedDeptId && sortedLogs.length > 0) {
                    resolvedDeptId = findLastUsedDepartmentId(sortedLogs);
                }

                if (resolvedDeptId) {
                    const context = resolveOutboundContextFromDepartmentId(resolvedDeptId, numbers);
                    setSelectedDepartmentId(context.departmentId ?? resolvedDeptId);
                    if (context.fromNumber) {
                        setSelectedFromNumber(context.fromNumber);
                    } else if (numbers.some((n) => n.phone_no === ourNumber)) {
                        setSelectedFromNumber(ourNumber);
                    }
                } else if (numbers.some((n) => n.phone_no === ourNumber)) {
                    setSelectedFromNumber(ourNumber);
                }


            } catch (error) {
                console.error("Failed to fetch data", error);
                toast({ title: "Error", description: "Failed to load conversation details.", variant: "destructive" });
            } finally {
                setLoading(false);
                setLoadingDepartments(false);
                setLoadingNumbers(false);
            }
        };

        if (user && from && to) {
            fetchInitialData();
        }
    }, [user, from, to, toast, handleDepartmentChange, searchParams]);

    useEffect(() => {
        const handler = (payload: { from: string; to: string }) => {
            if (isSameConversationThread(from, to, payload.from, payload.to)) {
                void refreshThread({ bypassCache: true });
            }
        };

        const refreshCallsHandler = () => {
          void refreshThread({ bypassCache: true });
        };

        events.on('refreshConversation', handler);
        events.on('refreshCalls', refreshCallsHandler);
        return () => {
            events.off('refreshConversation', handler);
            events.off('refreshCalls', refreshCallsHandler);
        };
    }, [from, to, refreshThread]);
    
    useEffect(() => {
        if (loading) return;

        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }

        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "auto", block: "end" });
        }
    }, [allComms, loading]);


    const handleMakeCall = async (number: string, context?: OutboundContext) => {
        if (!device || !isDeviceReady) {
            toast({ title: "Twilio Error", description: "Twilio Device not ready.", variant: 'destructive'});
            return;
        }

        const outboundContext = context ?? {
            departmentId: selectedDepartmentId || undefined,
            fromNumber: selectedFromNumber || undefined,
        };
        if (outboundContext.departmentId || outboundContext.fromNumber) {
            events.emit('setOutboundContext', outboundContext);
        }
        setDialerInitialValue(number.replace(/^\+1/, ""));
        setDialerOpen(true);
    };

    const handleSendMessage = async ({ body, mediaFiles }: { body: string; mediaFiles: File[] }) => {
        const recipient = contact?.phone_no;
        if (!selectedDepartmentId) {
            toast({ title: "Select a department", description: "Choose which department this message should be sent from.", variant: "destructive" });
            return;
        }
        if (!selectedFromNumber) {
            toast({ title: "Error", description: "Please select a 'from' number.", variant: "destructive" });
            return;
        }
        if (!recipient) {
            toast({ title: "Error", description: "Could not determine recipient.", variant: "destructive" });
            return;
        }
        if (!body && mediaFiles.length === 0) {
            toast({ title: "Error", description: "Add a message or media attachment to send.", variant: "destructive" });
            return;
        }

        const confirmed = await confirmUnusualDepartmentSms({
            recipientPhone: recipient,
            selectedDepartmentId,
            communications: allComms,
        });
        if (!confirmed) return;

        setIsSending(true);
        try {
            await sendMms(
                selectedFromNumber,
                recipient,
                body,
                mediaFiles.length ? mediaFiles : undefined
            );
            toast({ title: "Success", description: mediaFiles.length ? "MMS sent successfully." : "Message sent successfully." });
            const logs = await getCommunicationThread(from, to);
            const sortedLogs = logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            setAllComms(sortedLogs);
        } finally {
            setIsSending(false);
        }
    };


    const [dialerOpen, setDialerOpen] = useState(false);
    const [dialerInitialValue, setDialerInitialValue] = useState("");

    const handleMakeCallDialer = (number: string) => {
        if (!device) {
        toast({
            title: "Twilio Error",
            description: "Twilio Device not ready.",
            variant: "destructive",
        });
        return;
        }

        if (selectedDepartmentId || selectedFromNumber) {
            events.emit('setOutboundContext', {
                departmentId: selectedDepartmentId || undefined,
                fromNumber: selectedFromNumber || undefined,
            });
        }
        setDialerInitialValue(number.replace(/^\+1/, ""));
        setDialerOpen(true);
    };

    return (
                 <div className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-background text-foreground">
                    {unusualDepartmentSmsDialog}
                    <div className="flex-1 flex flex-col">
                        <AppHeader user={user} logout={logout} 
                            dialerOpen={dialerOpen}
                            dialerInitialValue={dialerInitialValue}
                            onDialerOpenChange={() => setDialerOpen(!dialerOpen)}
                            outboundContext={{
                              departmentId: selectedDepartmentId || undefined,
                              fromNumber: selectedFromNumber || undefined,
                            }}
                        />
                        <div className="flex-1 flex overflow-hidden">
                                <div className={cn("flex flex-1 min-w-0 flex-col h-full bg-background text-foreground overflow-hidden")}>
                                    <header className="sticky top-0 z-20 flex h-16 flex-shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm md:px-8">
                                        <div className="flex items-center gap-4">
                                            <Button variant="ghost" size="icon" onClick={() => router.back()}>
                                                <ArrowLeft />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Call Now"
                                                className="text-left"
                                                onClick={() => handleMakeCallDialer(contact.phone_no)}
                                            >
                                                <Phone className="h-4 w-4" />
                                            </Button>
                                            <div className="relative flex-1">
                                                <h1 className="text-xl font-bold">{contact?.name}</h1>
                                                {(contact?.sublabel || departmentName) && (
                                                  <p className="text-sm text-muted-foreground">
                                                    {[contact?.sublabel, departmentName].filter(Boolean).join(' • ')}
                                                  </p>
                                                )}
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => setIsProfileSidebarOpen(!isProfileSidebarOpen)}>
                                            {isProfileSidebarOpen ? <PanelRightClose /> : <User />}
                                        </Button>
                                    </header>
                                    <main ref={chatScrollRef} className="flex-1 overflow-y-auto overscroll-contain">
                                    {loading ? <p className="p-4">Loading...</p> : (
                                      <CallLog
                                        calls={allComms}
                                        contacts={contacts}
                                        phoneNumbers={phoneNumbers}
                                        onMakeCall={handleMakeCall}
                                        isClickable={false}
                                      />
                                    )}
                                    <div ref={messagesEndRef} />
                                    </main>
                                    <footer className="flex-shrink-0 p-4 border-t bg-background space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <Select onValueChange={handleDepartmentChange} value={selectedDepartmentId} disabled={loadingDepartments}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select department" />
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
                                                    <SelectValue placeholder={selectedDepartmentId ? "Select number" : "Select department first"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {filteredPhoneNumbers.map((num) => (
                                                        <SelectItem key={num.id} value={num.phone_no}>
                                                            {getPhoneNumberOptionLabel(num)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <MessageComposer
                                            messageBody={messageBody}
                                            onMessageBodyChange={setMessageBody}
                                            onSend={handleSendMessage}
                                            isSending={isSending}
                                            placeholder="Write your message..."
                                        />
                                    </footer>
                                </div>
                            {isProfileSidebarOpen && (
                                <aside className="h-full w-full max-w-[380px] border-l bg-background overflow-y-auto">
                                    <ContactProfile
                                      contact={contact}
                                      contacts={contacts}
                                      onContactUpdate={refreshThread}
                                      onCollapse={() => setIsProfileSidebarOpen(false)}
                                    />
                                </aside>
                            )}
                        </div>
                    </div>
                </div>
    );
}
