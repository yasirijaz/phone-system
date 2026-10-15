

"use client";

import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect, useCallback } from "react";
import type { Communication, Operator, PaginatedCommunicationsResponse, User, PhoneNumber } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useTwilio } from '@/context/TwilioContext';
import { useToast } from "@/hooks/use-toast";
import { getCommunications, enrichThreadsWithLastAttendee } from "@/services/callLogService";
import { getOperators, type OperatorsScope } from "@/services/departmentService";
import { getUsersByCompany } from "@/services/userService";
import { getCompanyPhoneNumbers } from "@/services/phoneNumberService";
import CallLog from "@/components/call-log";
import AppHeader from "@/components/app-header";
import OperatorsTable from "@/components/operators-table";
import { events } from '@/lib/events';
import PaginationControls from "@/components/pagination-controls";
import { cacheGet, cacheSet } from "@/lib/simpleCache";
import { useRef } from "react";
import { debounce } from "@/lib/utils";
import type { OutboundContext } from "@/lib/outbound-context";

type TabName = 'all' | 'unread' | 'calls' | 'missed' | 'meetings' | 'voicemails' | 'recordings' | 'messages' | 'operators' | 'starred' | 'spam' | 'unlogged';

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
    voicemails: [], recordings: [], messages: [], operators: [], starred: [], spam: [], unlogged: []
  });
  const [operators, setOperators] = useState<Operator[]>([]);
  const [operatorsScope, setOperatorsScope] = useState<OperatorsScope>('assigned_departments');
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [pagination, setPagination] = useState<Record<TabName, PaginationState>>({
    all: { ...initialPaginationState }, unread: { ...initialPaginationState }, calls: { ...initialPaginationState },
    missed: { ...initialPaginationState }, meetings: { ...initialPaginationState }, voicemails: { ...initialPaginationState },
    recordings: { ...initialPaginationState }, messages: { ...initialPaginationState }, operators: { ...initialPaginationState }, starred: { ...initialPaginationState },
    spam: { ...initialPaginationState }, unlogged: { ...initialPaginationState },
  });

  const [dialerOpen, setDialerOpen] = useState(false);
  const [dialerInitialValue, setDialerInitialValue] = useState('');
  const inFlightRequestsRef = useRef<Map<string, Promise<PaginatedCommunicationsResponse>>>(new Map());
  const activeTabRef = useRef(activeTab);
  const paginationRef = useRef(pagination);
  const lastFetchKeyRef = useRef<string | null>(null);
  const companyUsersRef = useRef(companyUsers);
  const navigationKeyRef = useRef('');
  const backgroundSeqRef = useRef(0);

  useEffect(() => {
    companyUsersRef.current = companyUsers;
  }, [companyUsers]);

  useEffect(() => {
    activeTabRef.current = activeTab;
    paginationRef.current = pagination;
  }, [activeTab, pagination]);

  useEffect(() => {
    if (!user?.company_id) return;
    getUsersByCompany(user.company_id).then((result) => {
      setCompanyUsers(Array.isArray(result.data) ? result.data : []);
    });
    getCompanyPhoneNumbers(user.company_id).then((numbers) => {
      setPhoneNumbers(Array.isArray(numbers) ? numbers : []);
    });
  }, [user?.company_id]);

  const fetchCommunicationData = useCallback(async (tab: TabName, page: number = 1, limit: number = 10, force = false, silent = false) => {
    if (!user) return;
    if (silent && tab === 'operators') return;

    const fetchKey = `${tab}:${page}:${limit}`;
    if (silent) {
      if (navigationKeyRef.current !== fetchKey) return;
      if (paginationRef.current[tab]?.loading) return;
      backgroundSeqRef.current += 1;
    } else {
      if (!force && lastFetchKeyRef.current === fetchKey) return;
      lastFetchKeyRef.current = fetchKey;
      navigationKeyRef.current = fetchKey;
      backgroundSeqRef.current += 1;
      setData(prev => ({ ...prev, [tab]: [] }));
      setPagination(prev => ({ ...prev, [tab]: { ...prev[tab], loading: true } }));
    }

    const backgroundSeq = backgroundSeqRef.current;
    
    try {
        if (tab === 'operators') {
          const operatorsResponse = await getOperators();
          const operatorList = Array.isArray(operatorsResponse.operators)
            ? operatorsResponse.operators
            : [];

          setOperators(operatorList);
          setOperatorsScope(operatorsResponse.scope);
          setPagination(prev => ({
            ...prev,
            operators: {
              ...initialPaginationState,
              loading: false,
              totalRecords: operatorList.length,
              totalPages: 1,
            },
          }));
          return;
        }

        let filters: Record<string, any> = { page, limit };
        if (silent) filters.fresh = 1;
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
          const flightKey = silent ? `${cacheKey}:fresh` : cacheKey;
          let inFlight = inFlightRequestsRef.current.get(flightKey);
          if (!inFlight) {
            inFlight = getCommunications(filters);
            inFlightRequestsRef.current.set(flightKey, inFlight);
          }
          response = await inFlight.finally(() => {
            inFlightRequestsRef.current.delete(flightKey);
          });
          cacheSet(cacheKey, response, 10_000);
        }

        if (navigationKeyRef.current !== fetchKey || backgroundSeq !== backgroundSeqRef.current) return;

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
          if (navigationKeyRef.current !== fetchKey || backgroundSeq !== backgroundSeqRef.current) return;
          setData((prev) => ({ ...prev, [tab]: enrichedResults }));
        });
    } catch (error) {
        if (navigationKeyRef.current !== fetchKey || backgroundSeq !== backgroundSeqRef.current) return;
        if (!silent) {
          toast({ title: "Error", description: `Failed to load data for ${tab}.`, variant: "destructive" });
          setPagination(prev => ({ ...prev, [tab]: { ...prev[tab], loading: false } }));
        }
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
    setData(prev => ({ ...prev, [activeTab]: [] }));
    fetchCommunicationData(activeTab, 1, pagination[activeTab].limit);
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
    fetchCommunicationData(tab, pag.currentPage, pag.limit, true, true);
  }, [fetchCommunicationData]);

  useEffect(() => {
    const debouncedRefresh = debounce(handleRefresh, 2000);
    events.on('refreshCalls', debouncedRefresh);
    return () => events.off('refreshCalls', debouncedRefresh);
  }, [handleRefresh]);

  const handleMakeCall = async (number: string, context?: OutboundContext) => {
     if (!device) {
        toast({ title: "Twilio Error", description: "Twilio Device not ready.", variant: 'destructive'});
        return;
    }
    if (context) {
      events.emit('setOutboundContext', context);
    }
    setDialerInitialValue(number.replace(/^\+1/, ""));
    setDialerOpen(true);
  };

  const renderTabContent = (tabName: TabName) => {
    if (tabName === 'operators') {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {operatorsScope === 'company'
              ? 'Showing all company operators'
              : operatorsScope === 'department'
              ? 'Showing operators in this department'
              : 'Showing operators in your departments'}
          </p>
          <OperatorsTable
            operators={operators}
            scope="company"
            currentUserId={user?.id}
            emptyMessage="No operators found"
          />
        </div>
      );
    }

    const currentData = data[tabName];
    const currentPagination = pagination[tabName];
    
    return (
      <div className="space-y-4">
        <PaginationControls
          {...currentPagination}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
          showControls={false}
        />
        <Card className="overflow-hidden">
          {currentPagination.loading ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading activity…
            </div>
          ) : (
          <CallLog
            calls={currentData || []}
            companyUsers={companyUsers}
            phoneNumbers={phoneNumbers}
            onMakeCall={handleMakeCall}
            source={tabName === 'unread' ? 'unread' : undefined}
            showDepartment
          />
          )}
          <PaginationControls
            {...currentPagination}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            showSummary={false}
          />
        </Card>
      </div>
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
                    <h1 className="mb-4 text-2xl font-bold">All My Departments — Recent Activity</h1>
                    <Tabs value={activeTab} onValueChange={(value) => {
                      setActiveTab(value as TabName);
                      setData(prev => ({ ...prev, [value]: [] }));
                    }}>
                      <TabsList>
                        <TabsTrigger className="data-[state=active]:bg-[#6D28D9] data-[state=active]:text-white" value="all">All</TabsTrigger>
                        <TabsTrigger className="data-[state=active]:bg-[#6D28D9] data-[state=active]:text-white" value="unread">Unread</TabsTrigger>
                        <TabsTrigger className="data-[state=active]:bg-[#6D28D9] data-[state=active]:text-white" value="calls">Calls</TabsTrigger>
                        <TabsTrigger className="data-[state=active]:bg-[#6D28D9] data-[state=active]:text-white" value="missed">Missed Calls</TabsTrigger>
                        <TabsTrigger className="data-[state=active]:bg-[#6D28D9] data-[state=active]:text-white" value="messages">Messages</TabsTrigger>
                        <TabsTrigger className="data-[state=active]:bg-[#6D28D9] data-[state=active]:text-white" value="voicemails">Voicemails</TabsTrigger>
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

