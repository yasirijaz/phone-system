
"use client";

import { useState, useMemo, type ChangeEvent, useEffect, useCallback } from 'react';
import type { Call, Department, PhoneNumber } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Search, Phone, UserCheck, Zap, ArrowUp, ArrowDown, Users, Clock, MoreHorizontal, Calendar, AreaChart, BarChart as BarChartIcon, MessageSquare, Video } from 'lucide-react';
import CallLog from '@/components/call-log';
import LogCallForm from '@/components/log-call-form';
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import IncomingCallModal from '@/components/incoming-call-modal';
import { useTwilio } from '@/context/TwilioContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area, ComposedChart } from 'recharts';
import { Badge } from '@/components/ui/badge';
import Dialer from '@/components/dialer';
import { useToast } from '@/hooks/use-toast';
import { getDepartments } from '@/services/departmentService';
import { getUserDepartments } from '@/services/userService';
import { getPhoneNumbers } from '@/services/phoneNumberService';
import NewMessageForm from '@/components/new-message-form';
import HardwareSettings from '@/components/hardware-settings';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import TwilioStatusIndicator from '@/components/twilio-status-indicator';

const INITIAL_CALLS: Partial<Call>[] = [
  {
    id: '1',
    from: 'John Doe',
    to: 'Me',
    created_at: '2024-07-23T10:00:00',
    duration: "15",
    direction: 'inbound',
    notes: 'Discussed Q3 sales targets and performance. Client is happy with the progress but wants to see more detailed reporting.',
    category: 'Sales',
  },
  {
    id: '2',
    from: 'Me',
    to: 'Jane Smith',
    created_at: '2024-07-23T11:30:00',
    duration: "5",
    direction: 'outbound',
    notes: 'Followed up on support ticket #12345. Issue resolved by clearing browser cache.',
    category: 'Support',
  },
    {
    id: '3',
    from: 'Alice Johnson',
    to: 'Me',
    created_at: '2024-06-15T14:00:00',
    duration: "30",
    direction: 'inbound',
    notes: 'Initial discovery call. Potential for a large enterprise deal. Scheduled a follow-up demo for next week.',
    category: 'Sales',
  },
  {
    id: '4',
    from: 'Mom',
    to: 'Me',
    created_at: '2024-05-22T18:45:00',
    duration: "25",
    direction: 'inbound',
    notes: 'Called to see how I was doing and talked about weekend plans.',
    category: 'Personal',
  },
    {
    id: '5',
    from: 'Me',
    to: 'Tech Support',
    created_at: '2024-07-21T09:15:00',
    duration: "45",
    direction: 'outbound',
    notes: 'Called about the internet outage. They are working on it, ETA 2 hours.',
    category: 'Support',
  },
  { id: '6', from: 'Bob Brown', to: 'Me', created_at: '2024-01-10T10:00:00', duration: "20", direction: 'inbound', category: 'Sales' },
  { id: '7', from: 'Me', to: 'Charlie Green', created_at: '2024-02-12T11:30:00', duration: "10", direction: 'outbound', category: 'Support' },
  { id: '8', from: 'David Black', to: 'Me', created_at: '2024-03-14T14:00:00', duration: "40", direction: 'inbound', category: 'Sales' },
  { id: '9', from: 'Eve White', to: 'Me', created_at: '2024-04-16T18:45:00', duration: "5", direction: 'inbound', category: 'Personal' },
  { id: '10', from: 'Me', to: 'Frank Blue', created_at: '2024-05-18T09:15:00', duration: "50", direction: 'outbound', category: 'Support' },
  { id: '11', from: 'Grace Pink', to: 'Me', created_at: '2024-06-20T10:00:00', duration: "12", direction: 'inbound', category: 'Sales' },
  { id: '12', from: 'Me', to: 'Harry Yellow', created_at: '2024-08-24T11:30:00', duration: "8", direction: 'outbound', category: 'Support' },
  { id: '13', from: 'Ivy Orange', to: 'Me', created_at: '2024-09-26T14:00:00', duration: "35", direction: 'inbound', category: 'Sales' },
  { id: '14', from: 'Jack Purple', to: 'Me', created_at: '2024-10-28T18:45:00', duration: "18", direction: 'inbound', category: 'Personal' },
  { id: '15', from: 'Me', to: 'Kate Silver', created_at: '2024-11-30T09:15:00', duration: "60", direction: 'outbound', category: 'Support' },
  { id: '16', from: 'Leo Gold', to: 'Me', created_at: '2024-12-01T10:00:00', duration: "22", direction: 'inbound', category: 'Sales' },
];

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


const MonthlySalesChart = ({ calls }: { calls: Partial<Call>[] }) => {
    const data = useMemo(() => {
        const salesByMonth: { [key: string]: number } = {};
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        monthNames.forEach(name => salesByMonth[name] = 0);

        calls.forEach(call => {
            if (call.created_at) {
                const month = new Date(call.created_at).getMonth();
                const monthName = monthNames[month];
                salesByMonth[monthName] += 1;
            }
        });

        return monthNames.map(name => ({ name, sales: salesByMonth[name] }));
    }, [calls]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Monthly Sales</CardTitle>
            </CardHeader>
            <CardContent>
                 <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} />
                        <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

const StatisticsChart = ({ calls }: { calls: Partial<Call>[] }) => {
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


const MonthlyTargetCard = () => (
     <Card>
        <CardHeader>
            <div className="flex justify-between items-center">
                <CardTitle>Monthly Target</CardTitle>
                 <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4"/></Button>
            </div>
            <CardDescription>Target you've set for each month</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center">
             <div className="relative w-40 h-20 mb-4">
                <svg viewBox="0 0 100 50" className="w-full h-full">
                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="hsl(var(--primary))" strokeWidth="10" strokeDasharray="125.6" strokeDashoffset="31.4" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
                    <span className="text-3xl font-bold">75.55%</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-700">+10%</Badge>
                </div>
            </div>
            <p className="text-center text-sm text-muted-foreground mb-4">You earn $3287 today, it’s higher than last month. Keep up your good work!</p>
            <div className="flex w-full justify-around">
                <div className="text-center">
                    <p className="text-sm text-muted-foreground">Target</p>
                    <p className="font-bold flex items-center">$20K <ArrowDown className="h-4 w-4 text-red-500 ml-1"/></p>
                </div>
                <div className="text-center">
                    <p className="text-sm text-muted-foreground">Revenue</p>
                    <p className="font-bold flex items-center">$20K <ArrowUp className="h-4 w-4 text-green-500 ml-1"/></p>
                </div>
                <div className="text-center">
                    <p className="text-sm text-muted-foreground">Today</p>
                    <p className="font-bold flex items-center">$20K <ArrowUp className="h-4 w-4 text-green-500 ml-1"/></p>
                </div>
            </div>
        </CardContent>
    </Card>
)

export default function EcommerceDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [calls, setCalls] = useState<Call[]>(INITIAL_CALLS as Call[]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  
  const [isSmsOpen, setIsSmsOpen] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  
  const { device, isDeviceReady, connectTwilio } = useTwilio();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingNumbers, setLoadingNumbers] = useState(false);

  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedFromNumber, setSelectedFromNumber] = useState('');

  useEffect(() => {
    connectTwilio();
  }, [connectTwilio]);
  
  useEffect(() => {
    if(user?.role_id === 1) {
      router.replace('/companies');
    }
  }, [user, router]);
  
  const handleDepartmentChange = useCallback(async (departmentId: string) => {
    setSelectedDepartmentId(departmentId);
    if (!departmentId) {
        setPhoneNumbers([]);
        setSelectedFromNumber('');
        return;
    };
    setLoadingNumbers(true);
    try {
        const numbers = await getPhoneNumbers(Number(departmentId));
        setPhoneNumbers(numbers);
         if (numbers.length > 0) {
            setSelectedFromNumber(numbers[0].phone_no);
        } else {
            setSelectedFromNumber('');
        }
    } catch (error) {
        toast({ title: "Error", description: "Failed to load phone numbers for this department.", variant: "destructive" });
        setPhoneNumbers([]);
        setSelectedFromNumber('');
    } finally {
        setLoadingNumbers(false);
    }
  }, [toast]);
  
  useEffect(() => {
    const fetchDepartmentsData = async () => {
        if (!user) return;
        setLoadingDepartments(true);
        try {
            const isAdmin = user.role_id === 1 || user.role_id === 2;
            const fetchedDepts = isAdmin && user.company_id
                ? await getDepartments(user.company_id)
                : await getUserDepartments(user.id);
            
            const depts = Array.isArray(fetchedDepts) ? fetchedDepts : [];
            setDepartments(depts);
             if (depts.length > 0) {
                handleDepartmentChange(String(depts[0].id));
            }
        } catch (error) {
            toast({ title: "Error", description: "Failed to load departments.", variant: "destructive" });
        } finally {
            setLoadingDepartments(false);
        }
    };
    fetchDepartmentsData();
  }, [user, toast, handleDepartmentChange]);
  
  


  const handleMakeCall = async (number: string, fromNumber?: string) => {
    if (!device || !isDeviceReady) {
        toast({ title: "Twilio Error", description: "Twilio Device not ready. Please connect first.", variant: 'destructive'});
        return;
    }
    try {
        const params: { To: string, From?: string } = { To: number };
        if (fromNumber) {
            params.From = fromNumber;
        }
        await device.connect({ params });
    } catch (error) {
        console.error("Error making call:", error);
        toast({ title: "Call Error", description: "Failed to make call. See console for details.", variant: 'destructive'});
    }
  };


  const filteredCalls = useMemo(() => {
    return calls
      .filter(call => {
          const contact = call.direction === 'inbound' ? call.from : call.to;
          return contact.toLowerCase().includes(searchTerm.toLowerCase())
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [calls, searchTerm]);

  const { totalCalls, totalDuration, mostFrequentContact } = useMemo(() => {
    if (calls.length === 0) {
      return { totalCalls: 0, totalDuration: 0, mostFrequentContact: 'N/A' };
    }

    const totalDuration = calls.reduce((acc, call) => acc + (parseInt(call.duration, 10) || 0), 0);

    const contactCounts = calls.reduce((acc, call) => {
      const contact = call.direction === 'inbound' ? call.from : call.to;
      acc[contact] = (acc[contact] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostFrequentContact = Object.keys(contactCounts).reduce((a, b) =>
      contactCounts[a] > contactCounts[b] ? a : b
    );

    return {
      totalCalls: calls.length,
      totalDuration,
      mostFrequentContact,
    };
  }, [calls]);

  if(user?.role_id === 1) {
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
          <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search or type command..." className="pl-9 w-full md:w-96" />
                 <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 md:flex">
                    <span className="text-xs">⌘</span>K
                </kbd>
              </div>
            </div>
            <div className="flex items-center gap-2">
                 <TwilioStatusIndicator />
                 <Dialer
                    onMakeCall={handleMakeCall}
                    departments={departments}
                    phoneNumbers={phoneNumbers}
                    onDepartmentChange={handleDepartmentChange}
                    loadingDepartments={loadingDepartments}
                    loadingNumbers={loadingNumbers}
                    selectedDepartmentId={selectedDepartmentId}
                    selectedFromNumber={selectedFromNumber}
                    onSetSelectedFromNumber={setSelectedFromNumber}
                 >
                   <Button variant="ghost" size="icon"><Phone className="h-5 w-5" /></Button>
                 </Dialer>
                 <Button variant="ghost" size="icon" onClick={() => setIsSmsOpen(true)}><MessageSquare className="h-5 w-5" /></Button>
                 <Button variant="ghost" size="icon" onClick={() => setIsVideoOpen(true)}><Video className="h-5 w-5" /></Button>
                 <HardwareSettings />
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8 space-y-8">
             <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-4 2xl:gap-7.5">
                <StatCard title="Total Calls" value={String(totalCalls)} icon={Phone} trend="+12%" trendType="up" />
                <StatCard title="Total Duration" value={`${totalDuration} min`} icon={Clock} trend="+25%" trendType="up" />
                <StatCard title="Top Contact" value={mostFrequentContact} icon={Users} trend="-2%" trendType="down" />
                <StatCard title="New Users" value="3" icon={UserCheck} trend="+5%" trendType="up" />
            </div>
            
            <div className="grid grid-cols-12 gap-4 md:gap-6 2xl:gap-7.5">
                <div className="col-span-12">
                     <MonthlySalesChart calls={calls} />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:gap-6">
                <StatisticsChart calls={calls} />
            </div>
            
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <CardTitle>Recent Call History</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CallLog calls={filteredCalls.slice(0, 5)} onMakeCall={handleMakeCall} />
              </CardContent>
            </Card>
          </main>
          
           <IncomingCallModal
              isOpen={showIncomingCall}
              onClose={() => setShowIncomingCall(false)}
              callerName="Jane Doe"
              callerNumber="+1 (555) 123-4567"
              onAccept={() => { console.log('Call accepted'); setShowIncomingCall(false); }}
              onReject={() => { console.log('Call rejected'); setShowIncomingCall(false); }}
            />
        </div>
        
        <Dialog open={isSmsOpen} onOpenChange={setIsSmsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Message</DialogTitle>
               <DialogDescription>
                Select a department and number to send a message from.
              </DialogDescription>
            </DialogHeader>
            <NewMessageForm 
              onClose={() => setIsSmsOpen(false)}
              departments={departments}
              phoneNumbers={phoneNumbers}
              onDepartmentChange={handleDepartmentChange}
              loadingDepartments={loadingDepartments}
              loadingNumbers={loadingNumbers}
              selectedDepartmentId={selectedDepartmentId}
              selectedFromNumber={selectedFromNumber}
              onSetSelectedFromNumber={setSelectedFromNumber}
            />
          </DialogContent>
        </Dialog>
        
        <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Video Call</DialogTitle>
              <DialogDescription>
                This feature is coming soon.
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>

      </SidebarInset>
    </SidebarProvider>
  );
}
