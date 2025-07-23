
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Calendar,
  Contact,
  Hash,
  Inbox,
  MessageSquare,
  Mic,
  Phone,
  Search,
  Settings,
  Star,
  Trash2,
  User,
  Users,
  Video,
  Voicemail,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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

export default function AppUIPage() {
  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      {/* Left Sidebar */}
      <aside className="w-72 flex-shrink-0 border-r bg-muted/40 flex flex-col">
        <div className="p-4">
          <Button variant="ghost" className="w-full justify-start text-lg h-12 bg-primary/10 text-primary">
            <Inbox className="mr-3 h-5 w-5" />
            Inbox
          </Button>
        </div>
        <nav className="flex-1 space-y-2 px-4">
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

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-16 items-center border-b px-6 justify-between">
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Phone className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Calls</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MessageSquare className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Messages</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Video className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Meetings</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="w-full max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Dialpad"
                className="pl-9 bg-muted border-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Settings className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Settings</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Calendar className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Calendar</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Avatar>
              <AvatarFallback className="bg-yellow-500 text-white">
                Y
              </AvatarFallback>
            </Avatar>
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
  );
}
