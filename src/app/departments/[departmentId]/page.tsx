
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from 'next/navigation';
import type { Call, Department, PhoneNumber, User } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useTwilio } from '@/context/TwilioContext';
import { useToast } from "@/hooks/use-toast";
import { getCallLogs } from "@/services/callLogService";
import { getPhoneNumbers } from "@/services/phoneNumberService";
import CallLog from "@/components/call-log";
import { InAppSidebar } from "@/components/in-app-sidebar";
import AppHeader from "@/components/app-header";
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { getDepartmentUsers, getDepartments } from "@/services/departmentService";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


export default function DepartmentDetailPage() {
  const { user, logout } = useAuth();
  const { device } = useTwilio();
  const { toast } = useToast();
  const params = useParams();
  const departmentId = Number(params.departmentId);

  const [department, setDepartment] = useState<Department | null>(null);
  const [allCalls, setAllCalls] = useState<Call[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [operators, setOperators] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDepartmentData = async () => {
        if (!user || !departmentId || !user.company_id) return;
        setLoading(true);
        try {
            const depts = await getDepartments(user.company_id);
            const currentDept = depts.find(d => d.id === departmentId);
            setDepartment(currentDept || null);
            
            const numbers = await getPhoneNumbers(departmentId);
            setPhoneNumbers(numbers);

            const allCallLogs = await getCallLogs();
            const departmentCalls = allCallLogs.filter(c => c.department_id === departmentId);
            setAllCalls(departmentCalls);

            const operatorsResponse = await getDepartmentUsers(user.company_id, departmentId);
            setOperators(Array.isArray(operatorsResponse.users) ? operatorsResponse.users : []);

        } catch (error) {
            toast({ title: "Error", description: "Failed to load department data.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };
    fetchDepartmentData();
  }, [user, departmentId, toast]);

  const handleMakeCall = async (number: string) => {
     if (!device) {
        toast({ title: "Twilio Error", description: "Twilio Device not ready.", variant: 'destructive'});
        return;
    }
    console.log("Request to call:", number);
  };
  
  const departmentPhoneNumber = phoneNumbers.length > 0 ? phoneNumbers[0].phone_no : 'No number assigned';

  return (
    <SidebarProvider>
        <Sidebar>
            <InAppSidebar />
        </Sidebar>
        <SidebarInset>
             <div className="flex h-screen w-full bg-background text-foreground">
                <div className="flex flex-1 flex-col">
                  <AppHeader user={user} logout={logout} />

                  <main className="flex-1 p-6 overflow-y-auto">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                          <h1 className="text-2xl font-bold">{department?.name || 'Department'}</h1>
                          <p className="text-sm text-muted-foreground">{departmentPhoneNumber}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Label htmlFor="dnd-switch">DO NOT DISTURB</Label>
                            <Switch id="dnd-switch" />
                        </div>
                    </div>
                    <Tabs defaultValue="hold-queue">
                      <TabsList>
                        <TabsTrigger value="hold-queue">Hold Queue</TabsTrigger>
                        <TabsTrigger value="operators">Operators</TabsTrigger>
                        <TabsTrigger value="new">New</TabsTrigger>
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="missed">Missed</TabsTrigger>
                        <TabsTrigger value="voicemails">Voicemails</TabsTrigger>
                        <TabsTrigger value="recordings">Recordings</TabsTrigger>
                      </TabsList>
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
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow><TableCell colSpan={2} className="text-center">Loading...</TableCell></TableRow>
                                        ) : operators.length > 0 ? (
                                            operators.map((op) => (
                                                <TableRow key={op.id}>
                                                    <TableCell>{op.name}</TableCell>
                                                    <TableCell>{op.email}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={2} className="text-center h-24">No operators assigned</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                         </Card>
                      </TabsContent>
                       <TabsContent value="new" className="mt-6">
                         <Card><CardContent className="p-6">New calls will appear here.</CardContent></Card>
                      </TabsContent>
                      <TabsContent value="all" className="mt-6">
                        {loading ? <p>Loading...</p> : <CallLog calls={allCalls} onMakeCall={handleMakeCall} />}
                      </TabsContent>
                       <TabsContent value="missed" className="mt-6">
                         <Card><CardContent className="p-6">Missed calls will appear here.</CardContent></Card>
                      </TabsContent>
                       <TabsContent value="voicemails" className="mt-6">
                         <Card><CardContent className="p-6">Voicemails will appear here.</CardContent></Card>
                      </TabsContent>
                       <TabsContent value="recordings" className="mt-6">
                         <Card><CardContent className="p-6">Recordings will appear here.</CardContent></Card>
                      </TabsContent>
                    </Tabs>
                  </main>
                </div>
              </div>
        </SidebarInset>
    </SidebarProvider>
  );
}
