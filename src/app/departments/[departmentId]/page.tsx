
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from 'next/navigation';
import type { Call, Department } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { useTwilio } from '@/context/TwilioContext';
import { useToast } from "@/hooks/use-toast";
import { getCallLogs } from "@/services/callLogService";
import CallLog from "@/components/call-log";
import { InAppSidebar } from "@/components/in-app-sidebar";
import AppHeader from "@/components/app-header";
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { getDepartments } from "@/services/departmentService";


export default function DepartmentDetailPage() {
  const { user, logout } = useAuth();
  const { device } = useTwilio();
  const { toast } = useToast();
  const params = useParams();
  const departmentId = Number(params.departmentId);

  const [department, setDepartment] = useState<Department | null>(null);
  const [allCalls, setAllCalls] = useState<Call[]>([]);
  const [unreadCalls, setUnreadCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  const getLatestUniqueCallsByContact = (calls: Call[]): Call[] => {
    const latestCalls = new Map<string, Call>();
    const sortedCalls = [...calls].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    sortedCalls.forEach(call => {
        const otherPartyNumber = call.direction === 'inbound' ? call.from : call.to;
        if (otherPartyNumber && !latestCalls.has(otherPartyNumber)) {
            latestCalls.set(otherPartyNumber, call);
        }
    });
    return Array.from(latestCalls.values());
  };

  useEffect(() => {
    const fetchDepartmentData = async () => {
        if (!user || !departmentId) return;
        setLoading(true);
        try {
            if (user.company_id) {
                const depts = await getDepartments(user.company_id);
                const currentDept = depts.find(d => d.id === departmentId);
                setDepartment(currentDept || null);
            }

            const allCallLogs = await getCallLogs();
            const departmentCalls = allCallLogs.filter(c => c.department_id === departmentId);
            
            setAllCalls(getLatestUniqueCallsByContact(departmentCalls));
            setUnreadCalls(getLatestUniqueCallsByContact(departmentCalls.filter(c => !c.is_read)));
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

  return (
    <SidebarProvider>
        <Sidebar>
            <InAppSidebar />
        </Sidebar>
        <SidebarInset>
             <div className="flex h-screen w-full bg-background text-foreground">
                <div className="flex flex-1 flex-col">
                  <AppHeader user={user} logout={logout} pageTitle={department?.name || 'Department'}/>

                  <main className="flex-1 p-6 overflow-y-auto">
                    <Tabs defaultValue="all">
                      <TabsList>
                        <TabsTrigger value="all">All</TabsTrigger>
                        <TabsTrigger value="unread">Unread</TabsTrigger>
                      </TabsList>
                      <TabsContent value="all" className="mt-6">
                        {loading ? <p>Loading...</p> : <CallLog calls={allCalls} onMakeCall={handleMakeCall} />}
                      </TabsContent>
                      <TabsContent value="unread" className="mt-6">
                        {loading ? <p>Loading...</p> : <CallLog calls={unreadCalls} onMakeCall={handleMakeCall} />}
                      </TabsContent>
                    </Tabs>
                  </main>
                </div>
              </div>
        </SidebarInset>
    </SidebarProvider>
  );
}
