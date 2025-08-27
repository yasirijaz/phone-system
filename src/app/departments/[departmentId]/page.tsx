
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from 'next/navigation';
import type { Communication, Department, PhoneNumber, User, PaginatedCommunicationsResponse } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useTwilio } from '@/context/TwilioContext';
import { useToast } from "@/hooks/use-toast";
import { getCommunications, getDepartmentNewCalls, getDepartmentMissedCalls, getDepartmentRecordings, getDepartmentVoiceMails } from "@/services/callLogService";
import { getPhoneNumbers } from "@/services/phoneNumberService";
import CallLog from "@/components/call-log";
import { InAppSidebar } from "@/components/in-app-sidebar";
import AppHeader from "@/components/app-header";
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { getDepartmentUsers, getDepartments, updateDndStatus, getDndStatus } from "@/services/departmentService";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";


const PaginationControls = ({
  currentPage,
  totalPages,
  totalRecords,
  onPageChange,
  isLoading,
}: {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
}) => {
  if (totalRecords === 0) return null;

  return (
    <CardFooter className="flex items-center justify-between pt-4">
        <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} ({totalRecords} records)
        </div>
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
            >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages || isLoading}
            >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
        </div>
    </CardFooter>
  );
};


export default function DepartmentDetailPage() {
  const { user, logout } = useAuth();
  const { device } = useTwilio();
  const { toast } = useToast();
  const params = useParams();
  const departmentId = Number(params.departmentId);

  const [department, setDepartment] = useState<Department | null>(null);
  const [allCalls, setAllCalls] = useState<PaginatedCommunicationsResponse | null>(null);
  const [newCalls, setNewCalls] = useState<PaginatedCommunicationsResponse | null>(null);
  const [missedCalls, setMissedCalls] = useState<PaginatedCommunicationsResponse | null>(null);
  const [recordings, setRecordings] = useState<PaginatedCommunicationsResponse | null>(null);
  const [voicemails, setVoicemails] = useState<PaginatedCommunicationsResponse | null>(null);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [operators, setOperators] = useState<User[]>([]);
  
  const [paginationState, setPaginationState] = useState({
      all: { currentPage: 1, totalPages: 1, totalRecords: 0, loading: true },
      new: { currentPage: 1, totalPages: 1, totalRecords: 0, loading: true },
      missed: { currentPage: 1, totalPages: 1, totalRecords: 0, loading: true },
      voicemails: { currentPage: 1, totalPages: 1, totalRecords: 0, loading: true },
      recordings: { currentPage: 1, totalPages: 1, totalRecords: 0, loading: true },
  });

  const [dndStatus, setDndStatus] = useState(false);
  const [dndLoading, setDndLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

   const fetchDataForTab = useCallback(async (tab: string, page: number = 1) => {
        if (!user || !departmentId) return;

        setPaginationState(prev => ({ ...prev, [tab]: { ...prev[tab as keyof typeof prev], loading: true } }));
        
        try {
            let response;
            switch(tab) {
                case 'all':
                    response = await getCommunications(departmentId, page);
                    setAllCalls(response);
                    break;
                case 'new':
                    response = await getDepartmentNewCalls(departmentId, page);
                    setNewCalls(response);
                    break;
                case 'missed':
                    response = await getDepartmentMissedCalls(departmentId, page);
                    setMissedCalls(response);
                    break;
                case 'voicemails':
                    response = await getDepartmentVoiceMails(departmentId, page);
                    setVoicemails(response);
                    break;
                case 'recordings':
                    response = await getDepartmentRecordings(departmentId, page);
                    setRecordings(response);
                    break;
                default:
                    return;
            }
             setPaginationState(prev => ({
                ...prev,
                [tab]: {
                    currentPage: response.page_no,
                    totalPages: response.TotalPages,
                    totalRecords: response.TotalRecords,
                    loading: false,
                }
            }));
        } catch (error) {
            toast({ title: `Error fetching ${tab} calls`, description: "Failed to load data for this tab.", variant: "destructive" });
            setPaginationState(prev => ({ ...prev, [tab]: { ...prev[tab as keyof typeof prev], loading: false } }));
        }
    }, [user, departmentId, toast]);

    useEffect(() => {
        fetchDataForTab(activeTab, 1);
    }, [activeTab, fetchDataForTab]);

  useEffect(() => {
    const fetchInitialDepartmentData = async () => {
        if (!user || !departmentId || !user.company_id) return;
        try {
            const depts = await getDepartments(user.company_id);
            const currentDept = depts.find(d => d.id === departmentId);
            setDepartment(currentDept || null);
            
            const [numbers, dnd, operatorsResponse] = await Promise.all([
                getPhoneNumbers(departmentId),
                getDndStatus(departmentId, user.id),
                getDepartmentUsers(user.company_id, departmentId),
            ]);
            
            setPhoneNumbers(numbers);
            setDndStatus(dnd.is_dnd);
            setOperators(Array.isArray(operatorsResponse.users) ? operatorsResponse.users : []);
        } catch (error) {
             toast({ title: "Error", description: "Failed to load initial department data.", variant: "destructive" });
        }
    };
    fetchInitialDepartmentData();
  }, [user, departmentId, toast]);
  
  const handlePageChange = (tab: string, page: number) => {
      fetchDataForTab(tab, page);
  };

  const handleMakeCall = async (number: string) => {
     if (!device) {
        toast({ title: "Twilio Error", description: "Twilio Device not ready.", variant: 'destructive'});
        return;
    }
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

  const departmentPhoneNumber = phoneNumbers.length > 0 ? phoneNumbers[0].phone_no : 'No number assigned';
  
  const getRoleName = (roleId?: number) => {
    switch (roleId) {
        case 1: return 'Super Admin';
        case 2: return 'Admin';
        case 3: return 'User';
        default: return 'Unknown';
    }
  }

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
                    <Tabs defaultValue="all" onValueChange={setActiveTab}>
                      <TabsList>
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="new">New</TabsTrigger>
                        <TabsTrigger value="hold-queue">Hold Queue</TabsTrigger>
                        <TabsTrigger value="operators">Operators</TabsTrigger>
                        <TabsTrigger value="missed">Missed</TabsTrigger>
                        <TabsTrigger value="voicemails">Voicemails</TabsTrigger>
                        <TabsTrigger value="recordings">Recordings</TabsTrigger>
                      </TabsList>
                      <TabsContent value="all" className="mt-6">
                        <Card>
                            <CallLog calls={allCalls?.results || []} onMakeCall={(number) => handleMakeCall(number)} />
                            <PaginationControls {...paginationState.all} onPageChange={(page) => handlePageChange('all', page)} isLoading={paginationState.all.loading}/>
                        </Card>
                      </TabsContent>
                      <TabsContent value="hold-queue" className="mt-6">
                         <Card><CardContent className="p-6 text-center text-muted-foreground">No Record Found</CardContent></Card>
                      </TabsContent>
                       <TabsContent value="operators" className="mt-6">
                         <Card>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Role</TableHead>
                                            <TableHead>In-Call</TableHead>
                                            <TableHead>DND</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {operators.length > 0 ? (
                                            operators.map((op) => (
                                                <TableRow key={op.id}>
                                                    <TableCell>{op.name}</TableCell>
                                                    <TableCell>{op.email}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={op.role_id === 2 ? 'default' : 'secondary'}>
                                                            {getRoleName(op.role_id)}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={op.in_call === 0 ? 'default' : 'secondary'}>
                                                            {op.in_call === 0 ? 'No' : 'Yes'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={op.do_not_disturb === 0 ? 'default' : 'secondary'}>
                                                            {op.do_not_disturb === 0 ? 'No' : 'Yes'}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={5} className="text-center h-24">No operators assigned</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                         </Card>
                      </TabsContent>
                       <TabsContent value="new" className="mt-6">
                         <Card>
                            <CallLog calls={newCalls?.results || []} onMakeCall={(number) => handleMakeCall(number)} />
                            <PaginationControls {...paginationState.new} onPageChange={(page) => handlePageChange('new', page)} isLoading={paginationState.new.loading}/>
                         </Card>
                      </TabsContent>
                       <TabsContent value="missed" className="mt-6">
                         <Card>
                            <CallLog calls={missedCalls?.results || []} onMakeCall={(number) => handleMakeCall(number)} />
                            <PaginationControls {...paginationState.missed} onPageChange={(page) => handlePageChange('missed', page)} isLoading={paginationState.missed.loading}/>
                         </Card>
                      </TabsContent>
                       <TabsContent value="voicemails" className="mt-6">
                         <Card>
                            <CallLog calls={voicemails?.results || []} onMakeCall={(number) => handleMakeCall(number)} />
                            <PaginationControls {...paginationState.voicemails} onPageChange={(page) => handlePageChange('voicemails', page)} isLoading={paginationState.voicemails.loading}/>
                         </Card>
                      </TabsContent>
                       <TabsContent value="recordings" className="mt-6">
                         <Card>
                             <CallLog calls={recordings?.results || []} onMakeCall={(number) => handleMakeCall(number)} />
                             <PaginationControls {...paginationState.recordings} onPageChange={(page) => handlePageChange('recordings', page)} isLoading={paginationState.recordings.loading}/>
                         </Card>
                      </TabsContent>
                    </Tabs>
                  </main>
                </div>
              </div>
        </SidebarInset>
    </SidebarProvider>
  );
}
