
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from 'next/navigation';
import { getCallLogs } from "@/services/callLogService";
import type { Call } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Paperclip, Send, Eye, Phone } from "lucide-react";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import CallLog from "@/components/call-log";
import { InAppSidebar } from "@/components/in-app-sidebar";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function ConversationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [allCalls, setAllCalls] = useState<Call[]>([]);
    const [loading, setLoading] = useState(true);
    const [contactName, setContactName] = useState('');

    const contactNumber = params.number ? decodeURIComponent(params.number as string) : '';
    
    useEffect(() => {
        const fetchAndFilterCalls = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const logs = await getCallLogs();
                const filteredLogs = logs.filter(call => call.from === contactNumber || call.to === contactNumber)
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                
                if(filteredLogs.length > 0) {
                    setAllCalls([filteredLogs[0]]); // Keep only the most recent call
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
                             <Button variant="ghost" size="icon">
                                <Phone />
                            </Button>
                        </header>
                         <main className="flex-1 overflow-y-auto p-6">
                           {loading ? <p>Loading...</p> : <CallLog calls={allCalls} />}
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
