
"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useCallback } from "react";
import type { Call, Department, PhoneNumber, Contact } from "@/types";
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { useTwilio } from '@/context/TwilioContext';
import { getDepartments } from "@/services/departmentService";
import { getUserDepartments } from "@/services/userService";
import { useToast } from "@/hooks/use-toast";
import { getCallLogs } from "@/services/callLogService";
import { getContacts } from '@/services/contactService';
import CallLog from "@/components/call-log";
import { InAppSidebar } from "@/components/in-app-sidebar";
import AppHeader from "@/components/app-header";
import { events } from '@/lib/events';

export default function AppUIPage() {
  const { user, logout } = useAuth();
  const { device } = useTwilio();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  
  const [allCalls, setAllCalls] = useState<Call[]>([]);
  const [unreadCalls, setUnreadCalls] = useState<Call[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(true);

  const [dialerOpen, setDialerOpen] = useState(false);
  const [dialerInitialValue, setDialerInitialValue] = useState('');

  const getLatestUniqueCallsByContact = (calls: Call[]): Call[] => {
    const latestCalls = new Map<string, Call>();
    const sortedCalls = [...calls].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    sortedCalls.forEach(call => {
        const otherPartyNumber = call.direction === 'inbound' ? call.from : call.to;
        if (otherPartyNumber && !latestCalls.has(otherPartyNumber)) {
            latestCalls.set(otherPartyNumber, call);
        }
    });
    return Array.from(latestCalls.values());
  };

  const fetchCallData = useCallback(async () => {
    if (!user) return;
    setLoadingCalls(true);
    try {
        const allCallLogs = await getCallLogs();
        const callsData = Array.isArray(allCallLogs) ? allCallLogs : [];
        setAllCalls(getLatestUniqueCallsByContact(callsData));
        setUnreadCalls(getLatestUniqueCallsByContact(callsData.filter(c => !c.is_read)));
    } catch (error) {
        toast({ title: "Error", description: "Failed to load call data.", variant: "destructive" });
    } finally {
        setLoadingCalls(false);
    }
  }, [user, toast]);
  
  const handleDepartmentChange = useCallback(async (departmentId: string) => {
    // This function will be passed to the header, but its logic resides here
    // where we manage the state for the main page content.
  }, [toast]);

  useEffect(() => {
    fetchCallData();
  }, [fetchCallData]);
  
  useEffect(() => {
    const handleRefresh = () => {
        console.log('Refresh event received, fetching new call data...');
        fetchCallData();
    };

    events.on('refreshCalls', handleRefresh);

    return () => {
        events.off('refreshCalls', handleRefresh);
    };
  }, [fetchCallData]);

  const handleMakeCall = async (number: string) => {
     if (!device) {
        toast({ title: "Twilio Error", description: "Twilio Device not ready.", variant: 'destructive'});
        return;
    }
    setDialerInitialValue(number.replace(/^\+1/, ""));
    setDialerOpen(true);
  };

  return (
    <SidebarProvider>
        <Sidebar>
            <InAppSidebar />
        </Sidebar>
        <SidebarInset>
             <div className="flex h-screen w-full bg-background text-foreground">
                <div className="flex flex-1 flex-col">
                  <AppHeader 
                    user={user} 
                    logout={logout} 
                    dialerOpen={dialerOpen}
                    onDialerOpenChange={setDialerOpen}
                    dialerInitialValue={dialerInitialValue}
                  />

                  <main className="flex-1 p-6 overflow-y-auto">
                    <Tabs defaultValue="all">
                      <TabsList>
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="unread">Unread</TabsTrigger>
                        <TabsTrigger value="calls">Calls</TabsTrigger>
                        <TabsTrigger value="missed">Missed</TabsTrigger>
                        <TabsTrigger value="meetings">Meetings</TabsTrigger>
                        <TabsTrigger value="voicemails">Voicemails</TabsTrigger>
                        <TabsTrigger value="recordings">Recordings</TabsTrigger>
                        <TabsTrigger value="messages">Messages</TabsTrigger>
                        <TabsTrigger value="starred">Starred</TabsTrigger>
                        <TabsTrigger value="spam">Spam</TabsTrigger>
                        <TabsTrigger value="unlogged">Unlogged</TabsTrigger>
                      </TabsList>
                      <TabsContent value="all" className="mt-6">
                         {loadingCalls ? <p>Loading...</p> : <CallLog calls={allCalls} onMakeCall={(number) => handleMakeCall(number)} />}
                      </TabsContent>
                      <TabsContent value="unread" className="mt-6">
                        {loadingCalls ? <p>Loading...</p> : <CallLog calls={unreadCalls} onMakeCall={(number) => handleMakeCall(number)} />}
                      </TabsContent>
                      <TabsContent value="calls" className="mt-6">
                          <Card><CardContent className="p-6">Call logs will appear here.</CardContent></Card>
                      </TabsContent>
                        <TabsContent value="missed" className="mt-6">
                           {loadingCalls ? <p>Loading...</p> : <CallLog calls={getLatestUniqueCallsByContact(allCalls.filter(c => c.call_status === 'missed' || c.call_status === 'no-answer' || c.call_status === 'busy' || c.call_status === 'canceled'))} onMakeCall={(number) => handleMakeCall(number)} />}
                      </TabsContent>
                        <TabsContent value="meetings" className="mt-6">
                          <Card><CardContent className="p-6">Meeting recordings will appear here.</CardContent></Card>
                      </TabsContent>
                        <TabsContent value="voicemails" className="mt-6">
                          <Card><CardContent className="p-6">Voicemails will appear here.</CardContent></Card>
                      </TabsContent>
                        <TabsContent value="recordings" className="mt-6">
                          <Card><CardContent className="p-6">Call recordings will appear here.</CardContent></Card>
                      </TabsContent>
                        <TabsContent value="messages" className="mt-6">
                          <Card><CardContent className="p-6">Messages will appear here.</CardContent></Card>
                      </TabsContent>
                      <TabsContent value="starred" className="mt-6">
                          {loadingCalls ? <p>Loading...</p> : <CallLog calls={getLatestUniqueCallsByContact(allCalls.filter(c => c.is_starred))} onMakeCall={(number) => handleMakeCall(number)} />}
                      </TabsContent>
                      <TabsContent value="spam" className="mt-6">
                          <Card><CardContent className="p-6">Spam will appear here.</CardContent></Card>
                      </TabsContent>
                        <TabsContent value="unlogged" className="mt-6">
                          <Card><CardContent className="p-6">Unlogged calls will appear here.</CardContent></Card>
                      </TabsContent>
                    </Tabs>
                  </main>
                </div>
              </div>
        </SidebarInset>
    </SidebarProvider>
  );
}
