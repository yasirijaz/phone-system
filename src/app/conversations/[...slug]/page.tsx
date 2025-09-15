
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getCommunicationThread, markThreadAsRead } from "@/services/callLogService";
import type { Communication, Department, PhoneNumber } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send } from "lucide-react";
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

export default function ConversationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, logout } = useAuth();
    const { toast } = useToast();
    const { device, isDeviceReady } = useTwilio();

    const [allComms, setAllComms] = useState<Communication[]>([]);
    const [loading, setLoading] = useState(true);
    const [contactName, setContactName] = useState('');
    const [messageBody, setMessageBody] = useState('');
    const [isSending, setIsSending] = useState(false);
    
    const [departments, setDepartments] = useState<Department[]>([]);
    const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    const [selectedFromNumber, setSelectedFromNumber] = useState<string>('');
    const [loadingDepartments, setLoadingDepartments] = useState(true);
    const [loadingNumbers, setLoadingNumbers] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    const slug = params.slug ? (Array.isArray(params.slug) ? params.slug : [params.slug]) : [];
    const [from, to] = slug.map(part => decodeURIComponent(part));

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
                 const fetchedDepts = await (isAdmin && user.company_id
                    ? getDepartments(user.company_id)
                    : getUserDepartments(user.id));
                const depts = Array.isArray(fetchedDepts) ? fetchedDepts : [];
                setDepartments(depts);
                
                const logs = await getCommunicationThread(from, to);
                const sortedLogs = logs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                setAllComms(sortedLogs);
                
                if (searchParams.get('source') === 'unread') {
                    await markThreadAsRead(from, to);
                }
                
                if (sortedLogs.length > 0) {
                    const latestComm = sortedLogs[sortedLogs.length - 1];
                    const name = latestComm.direction === 'inbound' 
                        ? (latestComm.from_name?.name || from) 
                        : (latestComm.to_name?.name || to);
                    setContactName(name);

                    // Pre-select department and number
                    if (latestComm.department_id) {
                        const initialDeptId = String(latestComm.department_id);
                        setSelectedDepartmentId(initialDeptId);
                        await handleDepartmentChange(initialDeptId); // This will fetch numbers
                        
                        // Determine the correct "from" number for sending
                        const userNumber = latestComm.direction === 'inbound' ? latestComm.to : latestComm.from;
                        setSelectedFromNumber(userNumber);

                    } else if (depts.length > 0) {
                        await handleDepartmentChange(String(depts[0].id));
                    }
                } else {
                     setContactName(to); // Fallback
                     if (depts.length > 0) {
                        await handleDepartmentChange(String(depts[0].id));
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
        const recipient = contactName === from ? to : from;
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
            // Refresh conversation
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
                    <div className="flex flex-1 flex-col">
                         <AppHeader user={user} logout={logout} />
                         <header className="sticky top-16 z-20 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background/80 backdrop-blur-sm">
                            <div className="flex items-center gap-4">
                                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                                    <ArrowLeft />
                                </Button>
                                <div className="relative flex-1">
                                    <h1 className="text-xl font-bold">{contactName}</h1>
                                     <p className="text-sm text-muted-foreground">{contactName === from ? to : from}</p>
                                </div>
                            </div>
                        </header>
                         <main className="flex-1 overflow-y-auto p-6">
                           {loading ? <p>Loading...</p> : <CallLog calls={allComms} onMakeCall={handleMakeCall} isClickable={false} />}
                           <div ref={messagesEndRef} />
                        </main>
                        <footer className="p-4 border-t bg-background space-y-2">
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
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
