
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from 'next/navigation';
import { getCommunicationThread } from "@/services/callLogService";
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

export default function ConversationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user, logout } = useAuth();
    const { toast } = useToast();
    const { device, isDeviceReady } = useTwilio();

    const [allComms, setAllComms] = useState<Communication[]>([]);
    const [loading, setLoading] = useState(true);
    const [contactName, setContactName] = useState('');
    
    const slug = params.slug ? (Array.isArray(params.slug) ? params.slug : [params.slug]) : [];
    const [from, to] = slug.map(part => decodeURIComponent(part));

    useEffect(() => {
        const fetchAndFilterComms = async () => {
            if (!user || !from || !to) return;
            setLoading(true);
            try {
                const logs = await getCommunicationThread(from, to);
                const sortedLogs = logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                setAllComms(sortedLogs);

                if (sortedLogs.length > 0) {
                    const latestComm = sortedLogs[0];
                    const name = latestComm.direction === 'inbound' 
                        ? (latestComm.from_name?.name || from) 
                        : (latestComm.to_name?.name || to);
                    setContactName(name);
                } else {
                    setContactName(to);
                }

            } catch (error) {
                console.error("Failed to fetch communication logs", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAndFilterComms();
    }, [user, from, to]);

    const handleMakeCall = async (number: string) => {
        if (!device || !isDeviceReady) {
            toast({ title: "Twilio Error", description: "Twilio Device not ready.", variant: 'destructive'});
            return;
        }
        console.log("Request to call from conversation detail:", number);
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
