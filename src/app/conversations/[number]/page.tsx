
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from 'next/navigation';
import { getCallLogs } from "@/services/callLogService";
import type { Call, Department, PhoneNumber } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Paperclip, Send, Eye, Phone } from "lucide-react";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import CallLog from "@/components/call-log";
import { InAppSidebar } from "@/components/in-app-sidebar";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useTwilio } from "@/context/TwilioContext";
import { useToast } from "@/hooks/use-toast";
import { getDepartments } from "@/services/departmentService";
import { getUserDepartments } from "@/services/userService";
import { getPhoneNumbers } from "@/services/phoneNumberService";
import Dialer from "@/components/dialer";

export default function ConversationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const { toast } = useToast();
    const { device, isDeviceReady } = useTwilio();

    const [allCalls, setAllCalls] = useState<Call[]>([]);
    const [loading, setLoading] = useState(true);
    const [contactName, setContactName] = useState('');
    
    const [departments, setDepartments] = useState<Department[]>([]);
    const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
    const [loadingDepartments, setLoadingDepartments] = useState(true);
    const [loadingNumbers, setLoadingNumbers] = useState(false);
    
    const [dialerOpen, setDialerOpen] = useState(false);
    const [dialerInitialValue, setDialerInitialValue] = useState('');

    const contactNumber = params.number ? decodeURIComponent(params.number as string) : '';
    
    useEffect(() => {
        const fetchAndFilterCalls = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const logs = await getCallLogs();
                const filteredLogs = logs.filter(call => call.from === contactNumber || call.to === contactNumber)
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                
                setAllCalls(filteredLogs);

                if (filteredLogs.length > 0) {
                    const latestCall = filteredLogs[0];
                    const name = latestCall.direction === 'inbound' 
                        ? (latestCall.from_name?.name || latestCall.from) 
                        : (latestCall.to_name?.name || latestCall.to);
                    setContactName(name);
                } else {
                    setContactName(contactNumber);
                }

            } catch (error) {
                console.error("Failed to fetch call logs", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAndFilterCalls();
    }, [user, contactNumber]);

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!user) return;
            setLoadingDepartments(true);
            try {
                const isAdmin = user.role_id === 1 || user.role_id === 2;
                const fetchedDepts = await (isAdmin && user.company_id
                    ? getDepartments(user.company_id)
                    : getUserDepartments(user.id));
                setDepartments(Array.isArray(fetchedDepts) ? fetchedDepts : []);
            } catch (error) {
                toast({ title: "Error", description: "Failed to load department data.", variant: "destructive" });
            } finally {
                setLoadingDepartments(false);
            }
        };
        fetchInitialData();
    }, [user, toast]);

     const handleDepartmentChange = useCallback(async (departmentId: string) => {
        if (!departmentId) {
            setPhoneNumbers([]);
            return;
        };
        setLoadingNumbers(true);
        try {
            const numbers = await getPhoneNumbers(Number(departmentId));
            setPhoneNumbers(numbers);
        } catch (error) {
            toast({ title: "Error", description: "Failed to load phone numbers for this department.", variant: "destructive" });
            setPhoneNumbers([]);
        } finally {
            setLoadingNumbers(false);
        }
    }, [toast]);

    const handleMakeCall = async (number: string, fromNumber?: string) => {
        if (!device || !isDeviceReady) {
            toast({ title: "Twilio Error", description: "Twilio Device not ready. Please connect first.", variant: 'destructive'});
            return;
        }
        
        if (!fromNumber) {
            setDialerInitialValue(number);
            setDialerOpen(true);
            return;
        }

        try {
            const params: { To: string, From?: string } = { To: number };
            if (fromNumber) {
                params.From = fromNumber;
            }
            await device.connect({ params });
            setDialerOpen(false);
        } catch (error) {
            console.error("Error making call:", error);
            toast({ title: "Call Error", description: "Failed to make call. See console for details.", variant: 'destructive'});
        }
    };
    
    const handleCallButtonClick = () => {
        handleMakeCall(contactNumber);
    };

    return (
        <SidebarProvider>
            <Sidebar>
                <InAppSidebar />
            </Sidebar>
            <SidebarInset>
                <div className="flex h-screen w-full bg-background text-foreground">
                    <div className="flex flex-1 flex-col">
                        <header className="sticky top-0 z-30 flex items-center justify-between h-auto py-3 px-4 md:px-8 border-b bg-background shadow-sm">
                            <div className="flex items-center gap-4">
                                <SidebarTrigger className="md:hidden" />
                                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                                    <ArrowLeft />
                                </Button>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-xl font-bold">{contactName}</h1>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{contactNumber}</p>
                                </div>
                            </div>
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
                             >
                                <Button variant="ghost" size="icon" onClick={handleCallButtonClick}>
                                    <Phone />
                                </Button>
                            </Dialer>
                        </header>
                         <main className="flex-1 overflow-y-auto p-6">
                           {loading ? <p>Loading...</p> : <CallLog calls={allCalls} onMakeCall={handleMakeCall} />}
                        </main>
                        <footer className="p-4 border-t bg-background space-y-2">
                             <div className="grid grid-cols-2 gap-2">
                                 <Select>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="sales">Sales</SelectItem>
                                        <SelectItem value="support">Support</SelectItem>
                                        <SelectItem value="personal">Personal</SelectItem>
                                    </SelectContent>
                                </Select>
                                 <Select>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Template" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="template1">Template 1</SelectItem>
                                        <SelectItem value="template2">Template 2</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="relative">
                                <Textarea 
                                    placeholder="Write Your Message..."
                                    className="pr-10"
                                />
                                <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2">
                                    <Send className="h-5 w-5"/>
                                </Button>
                            </div>
                        </footer>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
