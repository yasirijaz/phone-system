
"use client";

import { useState, useMemo, type ChangeEvent, useEffect } from 'react';
import type { Call } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Search, Phone, UserCheck, Zap, ArrowUp, ArrowDown, Users, Clock, MoreHorizontal, Calendar, AreaChart, BarChart as BarChartIcon } from 'lucide-react';
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

const INITIAL_CALLS: Call[] = [
  {
    id: '1',
    contact: 'John Doe',
    dateTime: '2024-07-23T10:00:00',
    duration: 15,
    type: 'incoming',
    notes: 'Discussed Q3 sales targets and performance. Client is happy with the progress but wants to see more detailed reporting.',
    category: 'Sales',
  },
  {
    id: '2',
    contact: 'Jane Smith',
    dateTime: '2024-07-23T11:30:00',
    duration: 5,
    type: 'outgoing',
    notes: 'Followed up on support ticket #12345. Issue resolved by clearing browser cache.',
    category: 'Support',
  },
    {
    id: '3',
    contact: 'Alice Johnson',
    dateTime: '2024-06-15T14:00:00',
    duration: 30,
    type: 'incoming',
    notes: 'Initial discovery call. Potential for a large enterprise deal. Scheduled a follow-up demo for next week.',
    category: 'Sales',
  },
  {
    id: '4',
    contact: 'Mom',
    dateTime: '2024-05-22T18:45:00',
    duration: 25,
    type: 'incoming',
    notes: 'Called to see how I was doing and talked about weekend plans.',
    category: 'Personal',
  },
    {
    id: '5',
    contact: 'Tech Support',
    dateTime: '2024-07-21T09:15:00',
    duration: 45,
    type: 'outgoing',
    notes: 'Called about the internet outage. They are working on it, ETA 2 hours.',
    category: 'Support',
  },
  { id: '6', contact: 'Bob Brown', dateTime: '2024-01-10T10:00:00', duration: 20, type: 'incoming', category: 'Sales' },
  { id: '7', contact: 'Charlie Green', dateTime: '2024-02-12T11:30:00', duration: 10, type: 'outgoing', category: 'Support' },
  { id: '8', contact: 'David Black', dateTime: '2024-03-14T14:00:00', duration: 40, type: 'incoming', category: 'Sales' },
  { id: '9', contact: 'Eve White', dateTime: '2024-04-16T18:45:00', duration: 5, type: 'incoming', category: 'Personal' },
  { id: '10', contact: 'Frank Blue', dateTime: '2024-05-18T09:15:00', duration: 50, type: 'outgoing', category: 'Support' },
  { id: '11', contact: 'Grace Pink', dateTime: '2024-06-20T10:00:00', duration: 12, type: 'incoming', category: 'Sales' },
  { id: '12', contact: 'Harry Yellow', dateTime: '2024-08-24T11:30:00', duration: 8, type: 'outgoing', category: 'Support' },
  { id: '13', contact: 'Ivy Orange', dateTime: '2024-09-26T14:00:00', duration: 35, type: 'incoming', category: 'Sales' },
  { id: '14', contact: 'Jack Purple', dateTime: '2024-10-28T18:45:00', duration: 18, type: 'incoming', category: 'Personal' },
  { id: '15', contact: 'Kate Silver', dateTime: '2024-11-30T09:15:00', duration: 60, type: 'outgoing', category: 'Support' },
  { id: '16', contact: 'Leo Gold', dateTime: '2024-12-01T10:00:00', duration: 22, type: 'incoming', category: 'Sales' },
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


const MonthlySalesChart = ({ calls }: { calls: Call[] }) => {
    const data = useMemo(() => {
        const salesByMonth: { [key: string]: number } = {};
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        monthNames.forEach(name => salesByMonth[name] = 0);

        calls.forEach(call => {
            const month = new Date(call.dateTime).getMonth();
            const monthName = monthNames[month];
            salesByMonth[monthName] += 1;
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

const StatisticsChart = ({ calls }: { calls: Call[] }) => {
  const data = useMemo(() => {
    const statsByMonth: { [key: string]: { calls: number, duration: number } } = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    monthNames.forEach(name => statsByMonth[name] = { calls: 0, duration: 0 });

    calls.forEach(call => {
      const month = new Date(call.dateTime).getMonth();
      const monthName = monthNames[month];
      statsByMonth[monthName].calls += 1;
      statsByMonth[monthName].duration += call.duration;
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
  const [calls, setCalls] = useState<Call[]>(INITIAL_CALLS);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showIncomingCall, setShowIncomingCall] = useState(false);

  useEffect(() => {
    if(user?.role_id === 1) {
      router.replace('/companies');
    }
  }, [user, router]);

  const filteredCalls = useMemo(() => {
    return calls
      .filter(call => call.contact.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [calls, searchTerm]);

  const { totalCalls, totalDuration, mostFrequentContact } = useMemo(() => {
    if (calls.length === 0) {
      return { totalCalls: 0, totalDuration: 0, mostFrequentContact: 'N/A' };
    }

    const totalDuration = calls.reduce((acc, call) => acc + call.duration, 0);

    const contactCounts = calls.reduce((acc, call) => {
      acc[call.contact] = (acc[call.contact] || 0) + 1;
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


  const handleAddCall = (newCall: Omit<Call, 'id'>) => {
    const callWithId: Call = { ...newCall, id: crypto.randomUUID() };
    setCalls(prevCalls => [callWithId, ...prevCalls]);
    setIsSheetOpen(false);
  };
  

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
            <div className="flex items-center gap-4">
              <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Log a Call
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Log a New Call</SheetTitle>
                    <SheetDescription>
                      Enter the details of your call. Use the AI tool to categorize it automatically based on your notes.
                    </SheetDescription>
                  </SheetHeader>
                  <LogCallForm onCallAdded={handleAddCall} />
                </SheetContent>
              </Sheet>
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
                <CallLog calls={filteredCalls.slice(0, 5)} />
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
      </SidebarInset>
    </SidebarProvider>
  );
}
