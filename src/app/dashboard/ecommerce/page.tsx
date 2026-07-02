
"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Communication, Department, PhoneNumber, Contact, PaginatedCommunicationsResponse } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Search, Phone, UserCheck, Zap, ArrowUp, ArrowDown, Users, Clock, MoreHorizontal, Calendar, AreaChart, BarChart as BarChartIcon, MessageSquare, Video } from 'lucide-react';
import CallLog from '@/components/call-log';
import LogCallForm from '@/components/log-call-form';
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area, ComposedChart } from 'recharts';
import { useToast } from '@/hooks/use-toast';
import { getCommunications } from '@/services/callLogService';
import AppHeader from '@/components/app-header';
import PaginationControls from '@/components/pagination-controls';
import { events } from '@/lib/events';
import { isElectron } from '@/lib/is-electron';
import { getContacts } from '@/services/contactService';
import { getCompanyPhoneNumbers } from '@/services/phoneNumberService';
import type { OutboundContext } from '@/lib/outbound-context';

const StatCard = ({ title, value, icon: Icon, trend, trendType }: { title: string, value: string, icon: React.ElementType, trend: string, trendType: 'up' | 'down' }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground flex items-center">
                {trendType === 'up' ? <ArrowUp className="h-4 w-4 text-green-500" /> : <ArrowDown className="h-4 w-4 text-red-500" />}
                <span className="ml-1">{trend}</span>
            </p>
        </CardContent>
    </Card>
);

const MonthlyCallsChart = ({ calls }: { calls: Partial<Communication>[] }) => {
    const data = useMemo(() => {
        const callsByMonth: { [key: string]: number } = {};
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        monthNames.forEach(name => callsByMonth[name] = 0);

        calls.forEach(call => {
            if (call.created_at) {
                const month = new Date(call.created_at).getMonth();
                const monthName = monthNames[month];
                callsByMonth[monthName] += 1;
            }
        });

        return monthNames.map(name => ({ name, calls: callsByMonth[name] }));
    }, [calls]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Monthly Calls</CardTitle>
            </CardHeader>
            <CardContent>
                 <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} />
                        <Bar dataKey="calls" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

const StatisticsChart = ({ calls }: { calls: Partial<Communication>[] }) => {
  const data = useMemo(() => {
    const statsByMonth: { [key: string]: { calls: number, duration: number } } = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    monthNames.forEach(name => statsByMonth[name] = { calls: 0, duration: 0 });

    calls.forEach(call => {
      if(call.created_at && call.duration) {
        const month = new Date(call.created_at).getMonth();
        const monthName = monthNames[month];
        statsByMonth[monthName].calls += 1;
        statsByMonth[monthName].duration += parseInt(call.duration, 10);
      }
    });

    return monthNames.map(name => ({ name, ...statsByMonth[name] }));
  }, [calls]);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Statistics</CardTitle>
            <CardDescription>Target you've set for each month</CardDescription>
          </div>
          <div className="flex items-center gap-2">
             <Button variant="outline">Overview</Button>
             <Button variant="ghost">Sales</Button>
             <Button variant="ghost">Revenue</Button>
             <Button variant="outline" size="icon"><Calendar className="h-4 w-4"/></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis yAxisId="right" orientation="right" fontSize={12} tickLine={false} axisLine={false} />
            <defs>
              <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="calls" stroke="hsl(var(--primary))" fill="url(#colorCalls)" fillOpacity={1} yAxisId="left" name="Calls" />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default function EcommerceDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const inElectron = isElectron();
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [allCommunications, setAllCommunications] = useState<Communication[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const { toast } = useToast();
  const [dialerOpen, setDialerOpen] = useState(false);
  const [dialerNumber, setDialerNumber] = useState('');
  
  const [pagination, setPagination] = useState({
      currentPage: 1,
      totalPages: 1,
      totalRecords: 0,
      limit: 10,
      loading: true,
  });

  const fetchCommunications = useCallback(async (page: number = 1, limit: number = 5) => {
    if (!user) return;

    setPagination(prev => ({ ...prev, loading: true }));
    
    try {
        const [response, contactsResponse, numbersResponse] = await Promise.all([
          getCommunications({ page, limit }),
          user.company_id ? getContacts(user.company_id) : Promise.resolve([]),
          user.company_id ? getCompanyPhoneNumbers(user.company_id) : Promise.resolve([]),
        ]);

        setCommunications(response.results);
        setContacts(contactsResponse || []);
        setPhoneNumbers(Array.isArray(numbersResponse) ? numbersResponse : []);
        setPagination(prev => ({
            ...prev,
            currentPage: response.page_no,
            totalPages: response.TotalPages,
            totalRecords: response.TotalRecords,
            limit: limit,
            loading: false
        }));
    } catch (error) {
        toast({ title: "Error", description: "Failed to load communication history.", variant: "destructive" });
        setPagination(prev => ({ ...prev, loading: false }));
    }
  }, [user, toast]);

  useEffect(() => {
    fetchCommunications(pagination.currentPage, pagination.limit);
  }, []);

  const handlePageChange = (page: number) => {
      fetchCommunications(page, pagination.limit);
  };

  const handleLimitChange = (limit: number) => {
      fetchCommunications(1, limit);
  };


  const handleRefreshCalls = useCallback(() => {
    fetchCommunications(pagination.currentPage, pagination.limit);
  }, [fetchCommunications, pagination.currentPage, pagination.limit]);

  useEffect(() => {
    events.on("refreshCalls", handleRefreshCalls);
    return () => {
      events.off("refreshCalls", handleRefreshCalls);
    };
  }, [handleRefreshCalls]);

  useEffect(() => {
    if (user?.role_id === 1) {
      router.replace('/companies');
    }
  }, [user, router]);

  useEffect(() => {
    if (inElectron) {
      router.replace('/app');
    }
  }, [inElectron, router]);
  
  useEffect(() => {
    const fetchAllCommunications = async () => {
      try {
        const fetchedComms = await getCommunications({limit: 1000}); // fetch a large number for stats
        setAllCommunications(fetchedComms.results || []);
      } catch (error) {
        toast({ title: "Error", description: "Failed to load communication statistics.", variant: "destructive" });
      }
    };
    if (user) {
      fetchAllCommunications();
    }
  }, [user, toast]);
  
  const { totalCalls, totalDuration, mostFrequentContact } = useMemo(() => {
    if (allCommunications.length === 0) {
      return { totalCalls: 0, totalDuration: 0, mostFrequentContact: 'N/A' };
    }

    const totalDuration = allCommunications.reduce((acc, call) => acc + (parseInt(call.duration || '0', 10)), 0);

    const contactCounts = allCommunications.reduce((acc, call) => {
      const contactIdentifier = call.direction === 'inbound' ? call.from : call.to;
      const contactInfo = contacts.find(c => c.phone_no === contactIdentifier);
      const contactName = contactInfo?.name || contactIdentifier;

      acc[contactName] = (acc[contactName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostFrequentContact = Object.keys(contactCounts).length > 0
      ? Object.keys(contactCounts).reduce((a, b) => contactCounts[a] > contactCounts[b] ? a : b)
      : 'N/A';

    return {
      totalCalls: allCommunications.length,
      totalDuration,
      mostFrequentContact,
    };
  }, [allCommunications, contacts]);

  if (user?.role_id === 1 || inElectron) {
    return null; // or a loading spinner, as redirection is happening
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <AppSidebar />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          <AppHeader user={user} logout={logout} dialerOpen={dialerOpen} dialerInitialValue={dialerNumber} onDialerOpenChange={() => setDialerOpen(!dialerOpen)} />

          <main className="flex-1 p-4 md:p-8 space-y-8">
             <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4 2xl:gap-7.5">
                <StatCard title="Total Calls" value={String(totalCalls)} icon={Phone} trend="+12%" trendType="up" />
                <StatCard title="Total Duration" value={`${totalDuration} min`} icon={Clock} trend="+25%" trendType="up" />
                <StatCard title="Top Contact" value={mostFrequentContact} icon={Users} trend="-2%" trendType="down" />
                <StatCard title="New Users" value="3" icon={UserCheck} trend="+5%" trendType="up" />
            </div>
            
            <div className="grid grid-cols-12 gap-4 md:gap-6 2xl:gap-7.5">
                <div className="col-span-12">
                     <MonthlyCallsChart calls={allCommunications} />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:gap-6">
                <StatisticsChart calls={allCommunications} />
            </div>
            
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <CardTitle>Recent Call History</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CallLog
                  calls={communications}
                  contacts={contacts}
                  phoneNumbers={phoneNumbers}
                  onMakeCall={(number, context?: OutboundContext) => {
                    if (context) {
                      events.emit('setOutboundContext', context);
                    }
                    setDialerNumber(number.replace(/^\+1/, ""));
                    setDialerOpen(true);
                  }}
                />
              </CardContent>
              <PaginationControls
                {...pagination}
                onPageChange={handlePageChange}
                onLimitChange={handleLimitChange}
                isLoading={pagination.loading}
              />
            </Card>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
