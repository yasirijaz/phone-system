

"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useCallback } from "react";
import type { Communication, Contact, PaginatedCommunicationsResponse, User } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useTwilio } from '@/context/TwilioContext';
import { useToast } from "@/hooks/use-toast";
import { getCommunications, enrichThreadsWithLastAttendee } from "@/services/callLogService";
import { getContacts } from "@/services/contactService";
import { getUsersByCompany } from "@/services/userService";
import CallLog from "@/components/call-log";
import AppHeader from "@/components/app-header";
import { events } from '@/lib/events';
import PaginationControls from "@/components/pagination-controls";
import { cacheGet, cacheSet } from "@/lib/simpleCache";
import { useRef } from "react";
import { debounce } from "@/lib/utils";

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
  const activeTabRef = useRef(activeTab);
  const paginationRef = useRef(pagination);
  const lastFetchKeyRef = useRef<string | null>(null);
  const companyUsersRef = useRef(companyUsers);

  useEffect(() => {
    companyUsersRef.current = companyUsers;
  }, [companyUsers]);

  useEffect(() => {
    activeTabRef.current = activeTab;
    paginationRef.current = pagination;
  }, [activeTab, pagination]);

  useEffect(() => {
    if (!user?.company_id) return;
    getContacts(user.company_id).then((list) => setContacts(Array.isArray(list) ? list : []));
    getUsersByCompany(user.company_id).then((result) => {
      setCompanyUsers(Array.isArray(result.data) ? result.data : []);
    });
  }, [user?.company_id]);

  const fetchCommunicationData = useCallback(async (tab: TabName, page: number = 1, limit: number = 10, force = false) => {
    if (!user) return;
    
    const fetchKey = `${tab}:${page}:${limit}`;
    if (!force && lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;

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
        const cached = !force ? cacheGet<PaginatedCommunicationsResponse>(cacheKey) : null;

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

        const threadResults = Array.isArray(response.results) ? response.results : [];
        setData(prev => ({ ...prev, [tab]: threadResults }));
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

        enrichThreadsWithLastAttendee(threadResults, companyUsersRef.current).then((enrichedResults) => {
          setData((prev) => ({ ...prev, [tab]: enrichedResults }));
        });
    } catch (error) {
        toast({ title: "Error", description: `Failed to load data for ${tab}.`, variant: "destructive" });
        setPagination(prev => ({ ...prev, [tab]: { ...prev[tab], loading: false } }));
    }
  }, [user, toast]);

  useEffect(() => {
    if (!companyUsers.length) return;
    const tab = activeTabRef.current;
    setData((prev) => {
      const threads = prev[tab];
      if (!threads.length) return prev;
      enrichThreadsWithLastAttendee(threads, companyUsers).then((enrichedResults) => {
        setData((p) => ({ ...p, [tab]: enrichedResults }));
      });
      return prev;
    });
  }, [companyUsers]);

  useEffect(() => {
    lastFetchKeyRef.current = null;
    fetchCommunicationData(activeTab, pagination[activeTab].currentPage, pagination[activeTab].limit);
  }, [activeTab, fetchCommunicationData]);

  const handlePageChange = (page: number) => {
      lastFetchKeyRef.current = null;
      fetchCommunicationData(activeTab, page, pagination[activeTab].limit);
  };

  const handleLimitChange = (limit: number) => {
      lastFetchKeyRef.current = null;
      fetchCommunicationData(activeTab, 1, limit);
  };
  
  const handleRefresh = useCallback(() => {
    const tab = activeTabRef.current;
    const pag = paginationRef.current[tab];
    lastFetchKeyRef.current = null;
    fetchCommunicationData(tab, pag.currentPage, pag.limit, true);
  }, [fetchCommunicationData]);

  useEffect(() => {
    const debouncedRefresh = debounce(handleRefresh, 2000);
    events.on('refreshCalls', debouncedRefresh);
    return () => events.off('refreshCalls', debouncedRefresh);
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
        <CallLog
          calls={currentData || []}
          contacts={contacts}
          companyUsers={companyUsers}
          onMakeCall={handleMakeCall}
          source={tabName === 'unread' ? 'unread' : undefined}
          highlightFailedCalls
        />
        <PaginationControls
          {...currentPagination}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
      </Card>
    );
  };

  return (
             <div className="flex h-full min-h-0 w-full bg-background text-foreground">
                <div className="flex flex-1 flex-col">
                  <AppHeader 
                    user={user} 
                    logout={logout}
                    dialerOpen={dialerOpen} dialerInitialValue={dialerInitialValue} onDialerOpenChange={() => setDialerOpen(!dialerOpen)}
                  />

                  <main className="flex-1 p-6 overflow-y-auto">
                    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabName)}>
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
                        {/* <TabsTrigger value="spam">Spam</TabsTrigger>
                        <TabsTrigger value="unlogged">Unlogged</TabsTrigger> */}
                      </TabsList>
                      <div className="mt-6">
                        {activeTab === 'spam' ? (
                          <Card><CardContent className="p-6">Spam will appear here.</CardContent></Card>
                        ) : activeTab === 'unlogged' ? (
                          <Card><CardContent className="p-6">Unlogged calls will appear here.</CardContent></Card>
                        ) : (
                          renderTabContent(activeTab)
                        )}
                      </div>
                    </Tabs>
                  </main>
                </div>
              </div>
  );
}

