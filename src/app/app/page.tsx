

"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useCallback } from "react";
import type { Communication, Contact, PaginatedCommunicationsResponse, User } from "@/types";
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { useTwilio } from '@/context/TwilioContext';
import { useToast } from "@/hooks/use-toast";
import { getCommunications, enrichThreadsWithLastAttendee } from "@/services/callLogService";
import { getContacts } from "@/services/contactService";
import { getUsersByCompany } from "@/services/userService";
import CallLog from "@/components/call-log";
import { InAppSidebar } from "@/components/in-app-sidebar";
import AppHeader from "@/components/app-header";
import { events } from '@/lib/events';
import PaginationControls from "@/components/pagination-controls";
import { cacheGet, cacheSet } from "@/lib/simpleCache";
import { useRef } from "react";

type TabName = 'all' | 'unread' | 'calls' | 'missed' | 'meetings' | 'voicemails' | 'recordings' | 'messages' | 'starred' | 'spam' | 'unlogged';

type PaginationState = {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    limit: number;
    loading: boolean;
};

const initialPaginationState: PaginationState = {
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    limit: 10,
    loading: true,
};

export default function AppUIPage() {
  const { user, logout } = useAuth();
  const { device } = useTwilio();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabName>('all');
  const [data, setData] = useState<Record<TabName, Communication[]>>({
    all: [], unread: [], calls: [], missed: [], meetings: [],
    voicemails: [], recordings: [], messages: [], starred: [], spam: [], unlogged: []
  });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Record<TabName, PaginationState>>({
    all: { ...initialPaginationState }, unread: { ...initialPaginationState }, calls: { ...initialPaginationState },
    missed: { ...initialPaginationState }, meetings: { ...initialPaginationState }, voicemails: { ...initialPaginationState },
    recordings: { ...initialPaginationState }, messages: { ...initialPaginationState }, starred: { ...initialPaginationState },
    spam: { ...initialPaginationState }, unlogged: { ...initialPaginationState },
  });

  const [dialerOpen, setDialerOpen] = useState(false);
  const [dialerInitialValue, setDialerInitialValue] = useState('');
  const inFlightRequestsRef = useRef<Map<string, Promise<PaginatedCommunicationsResponse>>>(new Map());

  const fetchCommunicationData = useCallback(async (tab: TabName, page: number = 1, limit: number = 10) => {
    if (!user) return;

    setPagination(prev => ({ ...prev, [tab]: { ...prev[tab], loading: true } }));
    
    try {
        let filters: Record<string, any> = { page, limit };
        if (tab !== 'all') {
            if (tab === 'starred') {
                filters.is_starred = true;
            } else {
                filters.type = tab;
            }
        }

        const cacheKey = `comm:${tab}:${page}:${limit}`;
        const cached = cacheGet<PaginatedCommunicationsResponse>(cacheKey);
        const contactsKey = user.company_id ? `contacts:${user.company_id}` : undefined;
        const usersKey = user.company_id ? `companyUsers:${user.company_id}` : undefined;
        const cachedContacts = contactsKey ? cacheGet<Contact[]>(contactsKey) : [];
        const cachedUsers = usersKey ? cacheGet<User[]>(usersKey) : [];

        let response: PaginatedCommunicationsResponse;
        if (cached) {
          response = cached;
        } else {
          // de-dupe in-flight identical requests
          let inFlight = inFlightRequestsRef.current.get(cacheKey);
          if (!inFlight) {
            inFlight = getCommunications(filters);
            inFlightRequestsRef.current.set(cacheKey, inFlight);
          }
          response = await inFlight.finally(() => {
            inFlightRequestsRef.current.delete(cacheKey);
          });
          // cache results briefly to prevent double fetches on quick state churn
          cacheSet(cacheKey, response, 10_000);
        }

        let contactsResponse: Contact[] = [];
        if (Array.isArray(cachedContacts) && cachedContacts.length > 0) {
          contactsResponse = cachedContacts;
        } else if (user.company_id) {
          contactsResponse = await getContacts(user.company_id);
          cacheSet(`contacts:${user.company_id}`, contactsResponse, 5 * 60_000);
        }

        let usersResponse: User[] = [];
        if (Array.isArray(cachedUsers) && cachedUsers.length > 0) {
          usersResponse = cachedUsers;
        } else if (user.company_id) {
          const usersResult = await getUsersByCompany(user.company_id);
          usersResponse = Array.isArray(usersResult.data) ? usersResult.data : [];
          cacheSet(`companyUsers:${user.company_id}`, usersResponse, 5 * 60_000);
        }
        
        const threadResults = Array.isArray(response.results) ? response.results : [];
        setData(prev => ({ ...prev, [tab]: threadResults }));
        setContacts(Array.isArray(contactsResponse) ? contactsResponse : []);
        setCompanyUsers(usersResponse);
        setPagination(prev => ({
            ...prev,
            [tab]: {
                currentPage: response.page_no,
                totalPages: response.TotalPages,
                totalRecords: response.TotalRecords,
                limit: limit,
                loading: false
            }
        }));

        enrichThreadsWithLastAttendee(threadResults, usersResponse).then((enrichedResults) => {
          setData((prev) => ({ ...prev, [tab]: enrichedResults }));
        });
    } catch (error) {
        toast({ title: "Error", description: `Failed to load data for ${tab}.`, variant: "destructive" });
        setPagination(prev => ({ ...prev, [tab]: { ...prev[tab], loading: false } }));
    }
  }, [user, toast]);

  useEffect(() => {
    fetchCommunicationData(activeTab, pagination[activeTab].currentPage, pagination[activeTab].limit);
  }, [activeTab, fetchCommunicationData]);

  const handlePageChange = (page: number) => {
      fetchCommunicationData(activeTab, page, pagination[activeTab].limit);
  };

  const handleLimitChange = (limit: number) => {
      fetchCommunicationData(activeTab, 1, limit);
  };
  
  const handleRefresh = useCallback(() => {
    console.log('Refresh event received, fetching new communication data...');
    fetchCommunicationData(activeTab, pagination[activeTab].currentPage, pagination[activeTab].limit);
  }, [fetchCommunicationData, activeTab, pagination]);

  useEffect(() => {
    events.on('refreshCalls', handleRefresh);
    return () => events.off('refreshCalls', handleRefresh);
  }, [handleRefresh]);

  const handleMakeCall = async (number: string) => {
     if (!device) {
        toast({ title: "Twilio Error", description: "Twilio Device not ready.", variant: 'destructive'});
        return;
    }
    setDialerInitialValue(number.replace(/^\+1/, ""));
    setDialerOpen(true);
  };

  const renderTabContent = (tabName: TabName) => {
    const currentData = data[tabName];
    const currentPagination = pagination[tabName];
    
    return (
      <Card className="overflow-hidden">
        <CallLog calls={currentData || []} contacts={contacts} companyUsers={companyUsers} onMakeCall={handleMakeCall} source={tabName === 'unread' ? 'unread' : undefined} />
        <PaginationControls
          {...currentPagination}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
      </Card>
    );
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
                    dialerOpen={dialerOpen} dialerInitialValue={dialerInitialValue} onDialerOpenChange={() => setDialerOpen(!dialerOpen)}
                  />

                  <main className="flex-1 p-6 overflow-y-auto">
                    <Tabs defaultValue="all" onValueChange={(value) => setActiveTab(value as TabName)}>
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
                      <TabsContent value="all" className="mt-6">{renderTabContent('all')}</TabsContent>
                      <TabsContent value="unread" className="mt-6">{renderTabContent('unread')}</TabsContent>
                      <TabsContent value="calls" className="mt-6">{renderTabContent('calls')}</TabsContent>
                      <TabsContent value="missed" className="mt-6">{renderTabContent('missed')}</TabsContent>
                      <TabsContent value="meetings" className="mt-6">{renderTabContent('meetings')}</TabsContent>
                      <TabsContent value="voicemails" className="mt-6">{renderTabContent('voicemails')}</TabsContent>
                      <TabsContent value="recordings" className="mt-6">{renderTabContent('recordings')}</TabsContent>
                      <TabsContent value="messages" className="mt-6">{renderTabContent('messages')}</TabsContent>
                      <TabsContent value="starred" className="mt-6">{renderTabContent('starred')}</TabsContent>
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

