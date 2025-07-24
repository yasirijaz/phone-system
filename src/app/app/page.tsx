
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/icons";
import Link from 'next/link';
import {
  Hash,
  Inbox,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  Users,
  Phone,
  Video,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useCallback } from "react";
import type { Call, Department, PhoneNumber } from "@/types";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger, SidebarFooter } from "@/components/ui/sidebar";
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
import { getCallLogs, getUnreadCallLogs } from "@/services/callLogService";
import CallLog from "@/components/call-log";

function AppLayout({ children, calls }: { children: React.ReactNode, calls: Call[] }) {
    const getContactName = (call: Call) => {
        if (call.direction === 'inbound') {
            return call.meta_data?.from_name || call.from;
        }
        return call.meta_data?.to_name || call.to;
    };
    
    const getUniqueRecentCalls = (calls: Call[]) => {
        const uniqueContacts: { [key: string]: Call } = {};
        calls.forEach(call => {
            const contactIdentifier = getContactName(call);
            if (!uniqueContacts[contactIdentifier]) {
                uniqueContacts[contactIdentifier] = call;
            }
        });
        return Object.values(uniqueContacts);
    };

    const recentCalls = getUniqueRecentCalls(calls);


    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarContent className="p-0 flex flex-col">
                    <div className="p-4 flex items-center justify-between h-16 border-b shrink-0">
                       <Link href="/dashboard/ecommerce" className="flex items-center gap-2">
                           <Logo className="h-8 w-8 text-primary" />
                           <span className="text-xl font-bold text-foreground">
                                CallSync
                           </span>
                       </Link>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <div className="p-4">
                          <Button variant="ghost" className="w-full justify-start text-lg h-12 bg-primary/10 text-primary">
                            <Inbox className="mr-3 h-5 w-5" />
                            Inbox
                          </Button>
                        </div>
                        <nav className="space-y-2 px-4 py-4">
                          <Button variant="ghost" className="w-full justify-start h-10" asChild>
                            <Link href="/contacts">
                                <Users className="mr-3 h-5 w-5" />
                                Contacts
                            </Link>
                          </Button>
                          <Button variant="ghost" className="w-full justify-start h-10">
                            <Hash className="mr-3 h-5 w-5" />
                            All Channels
                          </Button>
                          <Button variant="ghost" className="w-full justify-start h-10">
                            <MessageSquare className="mr-3 h-5 w-5" />
                            Threads
                          </Button>
                        </nav>
                        <div className="flex flex-col min-h-0">
                          <h3 className="px-4 text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">
                            Recents
                          </h3>
                           <div className="flex-1 overflow-y-auto px-2">
                                {recentCalls.slice(0, 15).map((call) => {
                                    const contactName = getContactName(call);
                                    const initial = contactName ? contactName.charAt(0).toUpperCase() : '?';
                                    return (
                                        <div
                                            key={call.id}
                                            className="flex items-center gap-3 p-2 rounded-md hover:bg-muted"
                                        >
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback>
                                                    {initial}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 truncate">
                                                <p className="text-sm font-medium">{contactName}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </SidebarContent>
                 <SidebarFooter>
                 </SidebarFooter>
            </Sidebar>
            <SidebarInset>
                {children}
            </SidebarInset>
        </SidebarProvider>
    )
}

export default function AppUIPage() {
  const [isSmsOpen, setIsSmsOpen] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const { user, logout } = useAuth();
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : '?';

  const { device, isDeviceReady } = useTwilio();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingNumbers, setLoadingNumbers] = useState(false);

  const [allCalls, setAllCalls] = useState<Call[]>([]);
  const [unreadCalls, setUnreadCalls] = useState<Call[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
        if (!user) return;
        setLoadingDepartments(true);
        setLoadingCalls(true);
        try {
            const isAdmin = user.role_id === 1 || user.role_id === 2;
            const [fetchedDepts, allCallLogs, unreadCallLogs] = await Promise.all([
                isAdmin && user.company_id
                    ? getDepartments(user.company_id)
                    : getUserDepartments(user.id),
                getCallLogs(),
                getUnreadCallLogs(),
            ]);

            setDepartments(Array.isArray(fetchedDepts) ? fetchedDepts : []);
            setAllCalls(Array.isArray(allCallLogs) ? allCallLogs : []);
            setUnreadCalls(Array.isArray(unreadCallLogs) ? unreadCallLogs : []);

        } catch (error) {
            toast({ title: "Error", description: "Failed to load initial data.", variant: "destructive" });
        } finally {
            setLoadingDepartments(false);
            setLoadingCalls(false);
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
    try {
        const params: { To: string, From?: string } = { To: number };
        if (fromNumber) {
            params.From = fromNumber;
        }
        await device.connect({ params });
    } catch (error) {
        console.error("Error making call:", error);
        toast({ title: "Call Error", description: "Failed to make call. See console for details.", variant: 'destructive'});
    }
  };


  return (
    <AppLayout calls={allCalls}>
      <div className="flex h-screen w-full bg-background text-foreground">
        {/* Main Content */}
        <div className="flex flex-1 flex-col">
          {/* Header */}
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
                <div className="flex items-center gap-2">
                     <Dialer
                        onMakeCall={handleMakeCall}
                        departments={departments}
                        phoneNumbers={phoneNumbers}
                        onDepartmentChange={handleDepartmentChange}
                        loadingDepartments={loadingDepartments}
                        loadingNumbers={loadingNumbers}
                     >
                       <Button variant="ghost" size="icon"><Phone className="h-5 w-5" /></Button>
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

          {/* Content Area */}
          <main className="flex-1 p-6">
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
                {loadingCalls ? <p>Loading...</p> : <CallLog calls={unreadCalls} />}
              </TabsContent>
                <TabsContent value="all" className="mt-6">
                 {loadingCalls ? <p>Loading...</p> : <CallLog calls={allCalls} />}
              </TabsContent>
              <TabsContent value="calls" className="mt-6">
                  <Card><CardContent className="p-6">Call logs will appear here.</CardContent></Card>
              </TabsContent>
                <TabsContent value="missed" className="mt-6">
                   {loadingCalls ? <p>Loading...</p> : <CallLog calls={allCalls.filter(c => c.call_status === 'missed')} />}
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
                  {loadingCalls ? <p>Loading...</p> : <CallLog calls={allCalls.filter(c => c.is_starred)} />}
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
    </AppLayout>
  );
}
