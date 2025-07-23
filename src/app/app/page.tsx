
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/icons";
import Link from 'next/link';
import {
  Contact,
  Hash,
  Inbox,
  MessageSquare,
  PlusCircle,
  Search,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useState } from "react";
import LogCallForm from "@/components/log-call-form";
import Dialer from "@/components/dialer";
import type { Call } from "@/types";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";


const recentContacts = [
  { name: "(321) 799-6096", initial: "A" },
  { name: "Ideal GA", initial: "I", color: "bg-green-500" },
  { name: "Susan Buser", initial: "S", color: "bg-green-500" },
  { name: "(407) 269-8808", initial: "A" },
  { name: "(205) 916-8373", initial: "A" },
  { name: "(407) 410-4734", initial: "A" },
  { name: "Orlando FL", initial: "O", color: "bg-blue-500" },
  { name: "(813) 544-4201", initial: "M" },
  { name: "Metuchen NJ", initial: "M", color: "bg-yellow-500" },
  { name: "WindshieldHUB", initial: "W", color: "bg-orange-500" },
  { name: "(737) 204-9493", initial: "A" },
  { name: "(713) 804-8089", initial: "A" },
  { name: "Kashif Raza", initial: "K", color: "bg-yellow-500", status: "DND" },
  { name: "WindshieldHUB SMS", initial: "W", color: "bg-orange-500" },
  { name: "(407) 250-1607", initial: "A" },
];

function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarContent>
                    <aside className="w-full flex flex-col">
                        <div className="p-4 flex items-center gap-2 h-16 border-b">
                          <Button variant="ghost" className="w-full justify-start text-lg h-12 bg-primary/10 text-primary">
                            <Inbox className="mr-3 h-5 w-5" />
                            Inbox
                          </Button>
                        </div>
                        <nav className="flex-1 space-y-2 px-4 py-4">
                          <Button variant="ghost" className="w-full justify-start h-10">
                            <Users className="mr-3 h-5 w-5" />
                            Contacts
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
                        <div className="flex-1 flex flex-col min-h-0">
                          <h3 className="px-4 text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">
                            Recents
                          </h3>
                          <div className="overflow-y-auto px-2">
                            {recentContacts.map((contact, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted"
                              >
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className={contact.color}>
                                    {contact.initial}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 truncate">
                                  <p className="text-sm font-medium">{contact.name}</p>
                                  {contact.status && (
                                    <p className="text-xs text-destructive">{contact.status}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                    </aside>
                </SidebarContent>
            </Sidebar>
            <SidebarInset>
                {children}
            </SidebarInset>
        </SidebarProvider>
    )
}

export default function AppUIPage() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const handleAddCall = (newCall: Omit<Call, 'id'>) => {
    // This is a placeholder. In a real app, you'd update a state with the new call.
    console.log("New call logged:", newCall);
    setIsSheetOpen(false);
  };

  const handleMakeCall = (number: string) => {
     // This is a placeholder. In a real app, you'd connect this to the Twilio context.
    console.log("Making call to:", number);
  }

  return (
    <AppLayout>
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
                <div className="flex items-center gap-4">
                    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                        <SheetTrigger asChild>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Log a Call
                        </Button>
                        </SheetTrigger>
                        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                        <SheetHeader>
                            <SheetTitle>Log a New Call</SheetTitle>
                            <SheetDescription>
                            Enter the details of your call. Use the AI tool to categorize it automatically based on your notes.
                            </SheetDescription>
                        </SheetHeader>
                        <LogCallForm onCallAdded={handleAddCall} />
                        </SheetContent>
                    </Sheet>
                    <Dialer onMakeCall={handleMakeCall} />
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
                <Card>
                  <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                      <Contact className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold">
                      No unread conversations
                    </h3>
                    <p className="text-muted-foreground mt-1">
                      You're all caught up!
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
                <TabsContent value="all" className="mt-6">
                  <Card><CardContent className="p-6">All conversations will appear here.</CardContent></Card>
              </TabsContent>
              <TabsContent value="calls" className="mt-6">
                  <Card><CardContent className="p-6">Call logs will appear here.</CardContent></Card>
              </TabsContent>
                <TabsContent value="missed" className="mt-6">
                  <Card><CardContent className="p-6">Missed calls will appear here.</CardContent></Card>
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
                  <Card><CardContent className="p-6">Starred items will appear here.</CardContent></Card>
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
    </AppLayout>
  );
}
