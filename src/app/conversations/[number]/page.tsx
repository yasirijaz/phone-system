
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from 'next/navigation';
import { getCallLogs } from "@/services/callLogService";
import type { Call } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Phone, Video, MessageSquare } from "lucide-react";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import CallLog from "@/components/call-log";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ConversationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const [allCalls, setAllCalls] = useState<Call[]>([]);
    const [loading, setLoading] = useState(true);
    const [contactName, setContactName] = useState('');
    const [contactInitial, setContactInitial] = useState('?');

    const contactNumber = params.number ? decodeURIComponent(params.number as string) : '';
    
    useEffect(() => {
        const fetchAndFilterCalls = async () => {
            if (!user) return;
            setLoading(true);
            try {
                const logs = await getCallLogs();
                const filteredLogs = logs.filter(call => call.from === contactNumber || call.to === contactNumber);
                setAllCalls(filteredLogs);
                
                if(filteredLogs.length > 0) {
                    const latestCall = filteredLogs[0];
                    const name = latestCall.direction === 'inbound' 
                        ? latestCall.meta_data?.from_name || latestCall.from 
                        : latestCall.meta_data?.to_name || latestCall.to;
                    setContactName(name);
                    setContactInitial(name ? name.charAt(0).toUpperCase() : '#');
                } else {
                    setContactName(contactNumber);
                    setContactInitial('#');
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
            <Sidebar><SidebarContent><AppSidebar /></SidebarContent></Sidebar>
            <SidebarInset>
                <div className="flex h-screen w-full bg-background text-foreground">
                    <div className="flex flex-1 flex-col">
                        <header className="sticky top-0 z-30 flex items-center h-16 px-4 md:px-8 border-b bg-background shadow-sm">
                            <div className="flex items-center gap-4">
                                <SidebarTrigger className="md:hidden" />
                                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                                    <ArrowLeft />
                                </Button>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarFallback>{contactInitial}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h1 className="text-xl font-bold">{contactName}</h1>
                                        <p className="text-sm text-muted-foreground">{contactNumber}</p>
                                    </div>
                                </div>
                            </div>
                        </header>
                         <main className="flex-1 overflow-y-auto">
                            <div className="p-6">
                                <Tabs defaultValue="all">
                                    <TabsList>
                                        <TabsTrigger value="all">All</TabsTrigger>
                                        <TabsTrigger value="calls">Calls</TabsTrigger>
                                        <TabsTrigger value="messages">Messages</TabsTrigger>
                                        <TabsTrigger value="voicemails">Voicemails</TabsTrigger>
                                    </TabsList>
                                     <TabsContent value="all" className="mt-6">
                                        {loading ? <p>Loading...</p> : <CallLog calls={allCalls} />}
                                    </TabsContent>
                                    <TabsContent value="calls" className="mt-6">
                                        {loading ? <p>Loading...</p> : <CallLog calls={allCalls.filter(c => !c.recording_url)} />}
                                    </TabsContent>
                                     <TabsContent value="messages" className="mt-6">
                                        <Card><CardContent className="p-6 text-center text-muted-foreground">No messages with this contact yet.</CardContent></Card>
                                    </TabsContent>
                                     <TabsContent value="voicemails" className="mt-6">
                                       {loading ? <p>Loading...</p> : <CallLog calls={allCalls.filter(c => c.recording_url)} />}
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </main>
                    </div>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}