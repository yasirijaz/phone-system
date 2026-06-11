
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from 'next/navigation';
import type { Communication, Department, PhoneNumber, User, PaginatedCommunicationsResponse, Contact } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useTwilio } from '@/context/TwilioContext';
import { useToast } from "@/hooks/use-toast";
import { getCommunications, enrichThreadsWithLastAttendee } from "@/services/callLogService";
import { getPhoneNumbers } from "@/services/phoneNumberService";
import CallLog from "@/components/call-log";
import AppHeader from "@/components/app-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { getDepartmentUsers, getDepartments, updateDndStatus, getDndStatus } from "@/services/departmentService";
import { getContacts } from "@/services/contactService";
import { getUsersByCompany } from "@/services/userService";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import PaginationControls from "@/components/pagination-controls";
import { events } from '@/lib/events';
import { formatPhoneNumber } from "@/lib/utils";
import { getRoleName } from '@/lib/roles';
import {
  getWorkerStatusFromUser,
  getWorkerStatusBadgeVariant,
  parseWorkerStatusPayload,
} from '@/lib/worker-status';

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
  const { device, activityName } = useTwilio();
  const { toast } = useToast();
  const params = useParams();
  const departmentId = Number(params.departmentId);

  const [department, setDepartment] = useState<Department | null>(null);
  const [data, setData] = useState<Record<TabName, Communication[]>>({
    all: [], unread: [], calls: [], messages: [], operators: [],
    missed: [], voicemails: [], recordings: []
  });
  const [operators, setOperators] = useState<any[]>([]);
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
        const operatorsResponse = await getDepartmentUsers(user.company_id!, departmentId);
        const rawOperators = (Array.isArray(operatorsResponse.users) ? operatorsResponse.users : []) as unknown as Array<{
          id?: number;
          is_dnd?: number;
          user: User;
        }>;
        const validOperators = rawOperators
          .filter((op) => op?.user)
          .map((op) => ({
            ...op,
            user: {
              ...op.user,
              worker_status:
                (Number(op.user.id) === Number(user.id) && activityName) ||
                getWorkerStatusFromUser(op.user) ||
                undefined,
            },
          }));
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
  }, [user, departmentId, toast, activityName]);

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
                getPhoneNumbers(departmentId),
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

  // Handle DND status change notifications
  useEffect(() => {
    const handleDndStatusChange = (data: any) => {
      if (data?.is_dnd === undefined) return;

      setOperators(prevOperators =>
        prevOperators.map(op =>
          op.user && Number(op.user.id) === Number(data.user_id)
            ? { ...op, is_dnd: data.is_dnd ? 1 : 0 }
            : op
        )
      );
    };

    events.on('refreshOperators', handleDndStatusChange);
    return () => events.off('refreshOperators', handleDndStatusChange);
  }, []);

  // Handle in-call status change notifications
  useEffect(() => {
    const handleInCallStatusChange = (data: any) => {
      if (data?.in_call === undefined) return;

      const inCall = Number(data.in_call) ? 1 : 0;
      setOperators(prevOperators =>
        prevOperators.map(op =>
          op.user && Number(op.user.id) === Number(data.user_id)
            ? { ...op, user: { ...op.user, in_call: inCall } }
            : op
        )
      );
    };

    events.on('refreshInCallStatus', handleInCallStatusChange);
    return () => events.off('refreshInCallStatus', handleInCallStatusChange);
  }, []);

  useEffect(() => {
    const handleWorkerStatusChange = (data: any) => {
      const parsed = parseWorkerStatusPayload(data);
      if (!parsed) return;

      setOperators(prevOperators =>
        prevOperators.map(op =>
          op.user && Number(op.user.id) === parsed.user_id
            ? { ...op, user: { ...op.user, worker_status: parsed.worker_status } }
            : op
        )
      );
    };

    events.on('refreshWorkerStatus', handleWorkerStatusChange);
    return () => events.off('refreshWorkerStatus', handleWorkerStatusChange);
  }, []);

  useEffect(() => {
    if (!activityName || !user?.id) return;
    setOperators(prevOperators =>
      prevOperators.map(op =>
        op.user && Number(op.user.id) === Number(user.id)
          ? { ...op, user: { ...op.user, worker_status: activityName } }
          : op
      )
    );
  }, [activityName, user?.id]);

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
  
  const departmentPhoneNumber = phoneNumbers.length > 0 ? formatPhoneNumber(phoneNumbers[0].phone_no) : 'No number assigned';

  const renderTabContent = (tabName: TabName) => {
    const currentData = data[tabName];
    const currentPagination = pagination[tabName];
    
    return (
      <Card>
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
             <div className="flex h-screen w-full bg-background text-foreground">
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
                         <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>In-Call</TableHead>
                                            <TableHead>DND</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {operators.length > 0 ? (
                                            operators.map((op) => {
                                                const operatorUser = op.user;
                                                if (!operatorUser) return null;
                                                const workerStatus = operatorUser.worker_status ?? '—';
                                                return (
                                                <TableRow key={op.id ?? operatorUser.id}>
                                                    <TableCell>{operatorUser.name ?? '—'}</TableCell>
                                                    <TableCell>{operatorUser.email ?? '—'}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={operatorUser.role_id === 2 ? 'default' : 'secondary'}>
                                                            {getRoleName(operatorUser.role_id)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={getWorkerStatusBadgeVariant(workerStatus)}>
                                                            {workerStatus}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={operatorUser.in_call === 0 ? 'secondary' : 'default'}>
                                                            {operatorUser.in_call === 0 ? 'No' : 'Yes'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={op.is_dnd === 0 ? 'secondary' : 'destructive'}>
                                                            {op.is_dnd === 0 ? 'No' : 'Yes'}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                                );
                                            })
                                        ) : (
                                            <TableRow><TableCell colSpan={6} className="text-center h-24">No operators assigned</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                            <PaginationControls {...pagination.operators} onPageChange={handlePageChange} onLimitChange={handleLimitChange} />
                         </Card>
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
