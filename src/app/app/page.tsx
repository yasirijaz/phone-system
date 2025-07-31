
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from 'next/link';
import {
  LogOut,
  Search,
  Settings,
  Phone,
  Video,
  MessageSquare,
  UserCheck,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useCallback, useRef } from "react";
import type { Call, Department, PhoneNumber } from "@/types";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import Dialer from "@/components/dialer";
import { useTwilio } from '@/context/TwilioContext';
import NewMessageForm from "@/components/new-message-form";
import { getDepartments } from "@/services/departmentService";
import { getUserDepartments } from "@/services/userService";
import { getPhoneNumbers } from "@/services/phoneNumberService";
import { useToast } from "@/hooks/use-toast";
import HardwareSettings from "@/components/hardware-settings";
import { getCallLogs } from "@/services/callLogService";
import CallLog from "@/components/call-log";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InAppSidebar } from "@/components/in-app-sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger } from "@radix-ui/react-popover";
import TwilioStatusIndicator from "@/components/twilio-status-indicator";

export default function AppUIPage() {
  const [isSmsOpen, setIsSmsOpen] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const { user, logout } = useAuth();
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : '?';

  const { device, isDeviceReady, connectTwilio } = useTwilio();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingNumbers, setLoadingNumbers] = useState(false);

  const [allCalls, setAllCalls] = useState<Call[]>([]);
  const [unreadCalls, setUnreadCalls] = useState<Call[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(true);

  const [dialerOpen, setDialerOpen] = useState(false);
  const [dialerInitialValue, setDialerInitialValue] = useState('');
  
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedFromNumber, setSelectedFromNumber] = useState('');


  useEffect(() => {
    connectTwilio();
  }, [connectTwilio]);

  const getLatestUniqueCallsByContact = (calls: Call[]): Call[] => {
    const latestCalls = new Map<string, Call>();

    // Sort calls by date descending to easily find the latest
    const sortedCalls = [...calls].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    sortedCalls.forEach(call => {
        // Determine the other party's number to use as a unique key
        const otherPartyNumber = call.direction === 'inbound' ? call.from : call.to;

        if (otherPartyNumber && !latestCalls.has(otherPartyNumber)) {
            latestCalls.set(otherPartyNumber, call);
        }
    });

    return Array.from(latestCalls.values());
  };
  
    const handleDepartmentChange = useCallback(async (departmentId: string) => {
        setSelectedDepartmentId(departmentId);
        if (!departmentId) {
            setPhoneNumbers([]);
            setSelectedFromNumber('');
            return;
        };
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
            setPhoneNumbers([]);
            setSelectedFromNumber('');
        } finally {
            setLoadingNumbers(false);
        }
    }, [toast]);


  useEffect(() => {
    const fetchInitialData = async () => {
        if (!user) return;
        setLoadingDepartments(true);
        setLoadingCalls(true);
        try {
            const isAdmin = user.role_id === 1 || user.role_id === 2;
            const [fetchedDepts, allCallLogs] = await Promise.all([
                isAdmin && user.company_id
                    ? getDepartments(user.company_id)
                    : getUserDepartments(user.id),
                getCallLogs(),
            ]);

            const callsData = Array.isArray(allCallLogs) ? allCallLogs : [];
            const depts = Array.isArray(fetchedDepts) ? fetchedDepts : [];
            setDepartments(depts);
            
            if (depts.length > 0) {
                // Automatically trigger fetching numbers for the first department
                handleDepartmentChange(String(depts[0].id));
            }

            setAllCalls(getLatestUniqueCallsByContact(callsData));
            setUnreadCalls(getLatestUniqueCallsByContact(callsData.filter(c => !c.is_read)));

        } catch (error) {
            toast({ title: "Error", description: "Failed to load initial data.", variant: "destructive" });
        } finally {
            setLoadingDepartments(false);
            setLoadingCalls(false);
        }
    };
    fetchInitialData();
  }, [user, toast, handleDepartmentChange]);


  const handleMakeCall = async (number: string, fromNumber?: string) => {
    if (!device || !isDeviceReady) {
        toast({ title: "Twilio Error", description: "Twilio Device not ready. Please connect first.", variant: 'destructive'});
        return;
    }
    
    // If called from call log, we need to open the dialer to select a 'from' number
    if (!fromNumber) {
        setDialerInitialValue(number);
        setDialerOpen(true);
        return;
    }

    try {
        const params: { To: string, From?: string, direction?: string } = { To: number };
        if (fromNumber) {
            params.From = fromNumber;
            params.direction = "outbound";

        }
        console.log("Making call with params:", params);
        // call
        await device.connect({params: params });
        setDialerOpen(false); // Close dialer after making a call
    } catch (error) {
        console.error("Error making call:", error);
        toast({ title: "Call Error", description: "Failed to make call. See console for details.", variant: 'destructive'});
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
                  <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background shadow-sm">
                      <div className="flex items-center gap-4">
                          <SidebarTrigger className="md:hidden" />
                          <div className="relative flex-1">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="Search or type command..." className="pl-9 w-full md:w-96" />
                              <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 md:flex">
                                  <span className="text-xs">⌘</span>K
                              </kbd>
                          </div>
                      </div>
                      <div className="flex items-center gap-4">
                           <TwilioStatusIndicator />
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
                           >
                             <Button variant="ghost" size="icon" onClick={() => { setDialerInitialValue(''); setDialerOpen(true);}}><Phone className="h-5 w-5" /></Button>
                           </Dialer>
                           <Button variant="ghost" size="icon" onClick={() => setIsSmsOpen(true)}><MessageSquare className="h-5 w-5" /></Button>
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

                  <main className="flex-1 p-6 overflow-y-auto">
                    <Tabs defaultValue="unread">
                      <TabsList>
                        <TabsTrigger value="unread">Unread</TabsTrigger>
                        <TabsTrigger value="all">All</TabsTrigger>
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
                      <TabsContent value="unread" className="mt-6">
                        {loadingCalls ? <p>Loading...</p> : <CallLog calls={unreadCalls} onMakeCall={handleMakeCall} />}
                      </TabsContent>
                        <TabsContent value="all" className="mt-6">
                         {loadingCalls ? <p>Loading...</p> : <CallLog calls={allCalls} onMakeCall={handleMakeCall} />}
                      </TabsContent>
                      <TabsContent value="calls" className="mt-6">
                          <Card><CardContent className="p-6">Call logs will appear here.</CardContent></Card>
                      </TabsContent>
                        <TabsContent value="missed" className="mt-6">
                           {loadingCalls ? <p>Loading...</p> : <CallLog calls={getLatestUniqueCallsByContact(allCalls.filter(c => c.call_status === 'missed' || c.call_status === 'no-answer' || c.call_status === 'busy' || c.call_status === 'canceled'))} onMakeCall={handleMakeCall} />}
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
                          {loadingCalls ? <p>Loading...</p> : <CallLog calls={getLatestUniqueCallsByContact(allCalls.filter(c => c.is_starred))} onMakeCall={handleMakeCall} />}
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

              <Dialog open={isSmsOpen} onOpenChange={setIsSmsOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Message</DialogTitle>
                     <DialogDescription>
                      Select a department and number to send a message from.
                    </DialogDescription>
                  </DialogHeader>
                  <NewMessageForm 
                    onClose={() => setIsSmsOpen(false)}
                    departments={departments}
                    phoneNumbers={phoneNumbers}
                    onDepartmentChange={handleDepartmentChange}
                    loadingDepartments={loadingDepartments}
                    loadingNumbers={loadingNumbers}
                     selectedDepartmentId={selectedDepartmentId}
                    selectedFromNumber={selectedFromNumber}
                    onSetSelectedFromNumber={setSelectedFromNumber}
                  />
                </DialogContent>
              </Dialog>
              
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
        </SidebarInset>
    </SidebarProvider>
  );
}
