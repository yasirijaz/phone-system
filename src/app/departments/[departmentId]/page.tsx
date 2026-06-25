
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from 'next/navigation';
import type { Communication, Department, PhoneNumber, User, PaginatedCommunicationsResponse, Contact, Operator } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useTwilio } from '@/context/TwilioContext';
import { useToast } from "@/hooks/use-toast";
import { getCommunications, enrichThreadsWithLastAttendee } from "@/services/callLogService";
import { getDepartmentPhoneNumbers } from "@/services/phoneNumberService";
import CallLog from "@/components/call-log";
import AppHeader from "@/components/app-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { getOperators, getDepartments, updateDndStatus, getDndStatus } from "@/services/departmentService";
import { getContacts } from "@/services/contactService";
import { getUsersByCompany } from "@/services/userService";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import OperatorsTable from "@/components/operators-table";
import PaginationControls from "@/components/pagination-controls";
import { events } from '@/lib/events';
import { getPhoneNumberOptionLabel } from "@/lib/utils";

type TabName = 'all' | 'unread' | 'calls' | 'messages' | 'operators' | 'missed' | 'voicemails' | 'recordings';

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

export default function DepartmentDetailPage() {
  const { user, logout } = useAuth();
  const { device } = useTwilio();
  const { toast } = useToast();
  const params = useParams();
  const departmentId = Number(params.departmentId);

  const [department, setDepartment] = useState<Department | null>(null);
  const [data, setData] = useState<Record<TabName, Communication[]>>({
    all: [], unread: [], calls: [], messages: [], operators: [],
    missed: [], voicemails: [], recordings: []
  });
  const [operators, setOperators] = useState<Operator[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companyUsers, setCompanyUsers] = useState<User[]>([]);

  const [dialerOpen, setDialerOpen] = useState(false);
  const [dialerNumber, setDialerNumber] = useState('');
  
  const [pagination, setPagination] = useState<Record<TabName, PaginationState>>({
    all: { ...initialPaginationState }, unread: { ...initialPaginationState }, calls: { ...initialPaginationState },
    messages: { ...initialPaginationState }, operators: { ...initialPaginationState }, missed: { ...initialPaginationState }, 
    voicemails: { ...initialPaginationState }, recordings: { ...initialPaginationState },
  });

  const [dndStatus, setDndStatus] = useState(false);
  const [dndLoading, setDndLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabName>("all");
  const companyUsersRef = useRef<User[]>([]);

  useEffect(() => {
    companyUsersRef.current = companyUsers;
  }, [companyUsers]);

  useEffect(() => {
    if (!user?.company_id) return;
    getContacts(user.company_id).then((list) => setContacts(Array.isArray(list) ? list : []));
    getUsersByCompany(user.company_id).then((result) => {
      setCompanyUsers(Array.isArray(result.data) ? result.data : []);
    });
  }, [user?.company_id]);

  const fetchCommunicationData = useCallback(async (tab: TabName, page: number = 1, limit: number = 10) => {
    if (!user || !departmentId) return;

    if (tab === 'operators') {
      try {
        setPagination(prev => ({ ...prev, [tab]: { ...prev[tab], loading: true } }));
        const operatorsResponse = await getOperators(departmentId);
        const validOperators = Array.isArray(operatorsResponse.operators)
          ? operatorsResponse.operators
          : [];
        setOperators(validOperators);
        // Note: Operator list is not paginated from the API yet.
        setPagination(prev => ({ ...prev, [tab]: { ...initialPaginationState, loading: false, totalRecords: validOperators.length, totalPages: 1 } }));
      } catch (error) {
        toast({ title: "Error fetching operators", description: "Failed to load data for this tab.", variant: "destructive" });
        setPagination(prev => ({ ...prev, [tab]: { ...prev[tab], loading: false } }));
      }
      return;
    }

    setPagination(prev => ({ ...prev, [tab]: { ...prev[tab], loading: true } }));
    
    try {
        let filters: Record<string, any> = { page, limit, department_id: departmentId };
        if (tab !== 'all') {
            filters.type = tab;
        }

        const response = await getCommunications(filters);
        
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
        toast({ title: `Error fetching ${tab}`, description: "Failed to load data for this tab.", variant: "destructive" });
        setPagination(prev => ({ ...prev, [tab]: { ...prev[tab], loading: false } }));
    }
  }, [user, departmentId, toast]);

  useEffect(() => {
    fetchCommunicationData(activeTab, pagination[activeTab].currentPage, pagination[activeTab].limit);
  }, [activeTab]);

  useEffect(() => {
    const fetchInitialDepartmentData = async () => {
        if (!user || !departmentId || !user.company_id) return;
        try {
            const depts = await getDepartments(user.company_id);
            const currentDept = depts.find(d => d.id === departmentId);
            setDepartment(currentDept || null);
            
            const [numbers, dnd] = await Promise.all([
                getDepartmentPhoneNumbers(departmentId),
                getDndStatus(departmentId, user.id),
            ]);
            
            setPhoneNumbers(numbers);
            setDndStatus(dnd.is_dnd);
        } catch (error) {
             toast({ title: "Error", description: "Failed to load initial department data.", variant: "destructive" });
        }
    };
    fetchInitialDepartmentData();
  }, [user, departmentId, toast]);
  
  const handlePageChange = (page: number) => {
      fetchCommunicationData(activeTab, page, pagination[activeTab].limit);
  };

  const handleLimitChange = (limit: number) => {
      fetchCommunicationData(activeTab, 1, limit);
  };

  const handleRefresh = useCallback(() => {
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

    setDialerNumber(number.replace(/^\+1/, ""));
    setDialerOpen(true);
  };
  
  const handleDndChange = async (checked: boolean) => {
    if (!user) return;
    setDndLoading(true);
    setDndStatus(checked);
    try {
        await updateDndStatus(departmentId, user.id, checked);
        toast({
            title: "Success",
            description: `Do Not Disturb has been ${checked ? 'enabled' : 'disabled'}.`,
        });
    } catch (error) {
        setDndStatus(!checked); // Revert on error
        toast({
            title: "Error",
            description: "Failed to update DND status.",
            variant: "destructive",
        });
    } finally {
        setDndLoading(false);
    }
  };
  
  const assignedNumber = phoneNumbers[0];
  const departmentPhoneNumber = assignedNumber
    ? getPhoneNumberOptionLabel(assignedNumber)
    : 'No number assigned';

  const renderTabContent = (tabName: TabName) => {
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
        <Card>
          <CallLog calls={currentData || []} contacts={contacts} companyUsers={companyUsers} onMakeCall={handleMakeCall} source={tabName === 'unread' ? 'unread' : undefined} />
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
                    dialerOpen={dialerOpen} dialerInitialValue={dialerNumber} onDialerOpenChange={() => setDialerOpen(!dialerOpen)}
                  />

                  <main className="flex-1 p-6 overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                          <h1 className="text-2xl font-bold">{department?.name || 'Department'}</h1>
                          <p className="text-sm text-muted-foreground">{departmentPhoneNumber}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Label htmlFor="dnd-switch">DO NOT DISTURB</Label>
                            <Switch 
                              id="dnd-switch"
                              checked={dndStatus}
                              onCheckedChange={handleDndChange}
                              disabled={dndLoading}
                            />
                        </div>
                    </div>
                    <Tabs defaultValue="all" onValueChange={(value) => setActiveTab(value as TabName)}>
                      <TabsList>
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="unread">Unread</TabsTrigger>
                        <TabsTrigger value="calls">Calls</TabsTrigger>
                        <TabsTrigger value="messages">Messages</TabsTrigger>
                        <TabsTrigger value="operators">Operators</TabsTrigger>
                        <TabsTrigger value="missed">Missed</TabsTrigger>
                        <TabsTrigger value="voicemails">Voicemails</TabsTrigger>
                        <TabsTrigger value="recordings">Recordings</TabsTrigger>
                      </TabsList>
                      <TabsContent value="all" className="mt-6">{renderTabContent('all')}</TabsContent>
                      <TabsContent value="unread" className="mt-6">{renderTabContent('unread')}</TabsContent>
                      <TabsContent value="calls" className="mt-6">{renderTabContent('calls')}</TabsContent>
                      <TabsContent value="messages" className="mt-6">{renderTabContent('messages')}</TabsContent>
                      <TabsContent value="operators" className="mt-6">
                        <OperatorsTable
                          operators={operators}
                          scope="department"
                          departmentId={departmentId}
                          currentUserId={user?.id}
                          emptyMessage="No operators assigned"
                        />
                      </TabsContent>
                       <TabsContent value="missed" className="mt-6">{renderTabContent('missed')}</TabsContent>
                       <TabsContent value="voicemails" className="mt-6">{renderTabContent('voicemails')}</TabsContent>
                       <TabsContent value="recordings" className="mt-6">{renderTabContent('recordings')}</TabsContent>
                    </Tabs>
                  </main>
                </div>
              </div>
  );
}
