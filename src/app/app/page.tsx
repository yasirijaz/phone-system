
"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useCallback } from "react";
import type { Communication, PaginatedCommunicationsResponse } from "@/types";
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { useTwilio } from '@/context/TwilioContext';
import { useToast } from "@/hooks/use-toast";
import { getCommunications, getInboxCalls } from "@/services/callLogService";
import CallLog from "@/components/call-log";
import { InAppSidebar } from "@/components/in-app-sidebar";
import AppHeader from "@/components/app-header";
import { events } from '@/lib/events';
import PaginationControls from "@/components/pagination-controls";

type TabName = 'all' | 'unread' | 'calls' | 'missed' | 'meetings' | 'voicemails' | 'recordings' | 'messages' | 'starred';

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
  const [data, setData] = useState<Record<TabName, PaginatedCommunicationsResponse | null>>({
    all: null, unread: null, calls: null, missed: null, meetings: null,
    voicemails: null, recordings: null, messages: null, starred: null
  });
  const [pagination, setPagination] = useState<Record<TabName, PaginationState>>({
    all: { ...initialPaginationState }, unread: { ...initialPaginationState }, calls: { ...initialPaginationState },
    missed: { ...initialPaginationState }, meetings: { ...initialPaginationState }, voicemails: { ...initialPaginationState },
    recordings: { ...initialPaginationState }, messages: { ...initialPaginationState }, starred: { ...initialPaginationState },
  });

  const [dialerOpen, setDialerOpen] = useState(false);
  const [dialerInitialValue, setDialerInitialValue] = useState('');

  const fetchCommunicationData = useCallback(async (tab: TabName, page: number = 1, limit: number = 10) => {
    if (!user) return;
    setPagination(prev => ({ ...prev, [tab]: { ...prev[tab], loading: true } }));
    
    try {
        let response: PaginatedCommunicationsResponse;
        if (tab === 'all') {
            response = await getCommunications(page, limit);
        } else {
            response = await getInboxCalls(tab, page, limit);
        }
        
        setData(prev => ({ ...prev, [tab]: response }));
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
    } catch (error) {
        toast({ title: "Error", description: `Failed to load data for ${tab}.`, variant: "destructive" });
        setPagination(prev => ({ ...prev, [tab]: { ...prev[tab], loading: false } }));
    }
  }, [user, toast]);

  useEffect(() => {
    fetchCommunicationData(activeTab, pagination[activeTab].currentPage, pagination[activeTab].limit);
  }, [activeTab]);

  const handlePageChange = (page: number) => {
      fetchCommunicationData(activeTab, page, pagination[activeTab].limit);
  };

  const handleLimitChange = (limit: number) => {
      fetchCommunicationData(activeTab, 1, limit);
  };
  
  useEffect(() => {
    const handleRefresh = () => {
        console.log('Refresh event received, fetching new communication data...');
        fetchCommunicationData(activeTab, pagination[activeTab].currentPage, pagination[activeTab].limit);
    };

    events.on('refreshCalls', handleRefresh);

    return () => {
        events.off('refreshCalls', handleRefresh);
    };
  }, [fetchCommunicationData, activeTab, pagination]);

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
      <Card>
        <CallLog calls={currentData?.results || []} onMakeCall={handleMakeCall} />
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
