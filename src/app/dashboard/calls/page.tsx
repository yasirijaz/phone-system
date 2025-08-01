
"use client";

import type { Call } from '@/types';
import { useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Area, AreaChart as RechartsAreaChart, Tooltip, DonutChart, Pie, PieChart } from 'recharts';
import { MoreHorizontal, Eye, Users, Phone, Clock, TrendingDown, TrendingUp, Filter, Globe } from 'lucide-react';
import { AppSidebar } from '@/components/app-sidebar';
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/app-header';

const INITIAL_CALLS: Partial<Call>[] = [
  { id: 1, from: 'John Doe', to: 'Me', created_at: '2024-07-23T10:00:00', duration: "15", direction: 'inbound', category: 'Sales' },
  { id: 2, from: 'Me', to: 'Jane Smith', created_at: '2024-07-23T11:30:00', duration: "5", direction: 'outbound', category: 'Support' },
  { id: 3, from: 'Alice Johnson', to: 'Me', created_at: '2024-06-15T14:00:00', duration: "30", direction: 'inbound', category: 'Sales' },
  { id: 4, from: 'Mom', to: 'Me', created_at: '2024-05-22T18:45:00', duration: "25", direction: 'inbound', category: 'Personal' },
  { id: 5, from: 'Me', to: 'Tech Support', created_at: '2024-07-21T09:15:00', duration: "45", direction: 'outbound', category: 'Support' },
  ...Array.from({ length: 25 }, (_, i) => ({ id: i + 6, from: i % 2 === 0 ? `Contact ${i + 1}` : 'Me', to: i % 2 === 0 ? 'Me' : `Contact ${i + 1}`, created_at: `2024-07-${String(i + 1).padStart(2, '0')}T10:00:00`, duration: String(Math.floor(Math.random() * 60)), direction: i % 2 === 0 ? 'inbound' : 'outbound', category: ['Sales', 'Support', 'Personal'][i % 3] })),
];


const StatCard = ({ title, value, percentage, change, icon: Icon, changeType }: { title: string, value: string, percentage: string, change: string, icon: React.ElementType, changeType: 'up' | 'down' }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">
                <span className={`font-semibold ${changeType === 'up' ? 'text-green-500' : 'text-red-500'}`}>{percentage}</span>
                <span> {change}</span>
            </p>
        </CardContent>
    </Card>
);

const AnalyticsChart = ({ calls }: { calls: Partial<Call>[] }) => {
    const data = useMemo(() => {
        const callsByDay: { [key: string]: number } = {};
        for(let i=1; i<=30; i++) {
            callsByDay[i] = 0;
        }

        calls.forEach(call => {
            if (call.created_at) {
                const day = new Date(call.created_at).getDate();
                if(day >= 1 && day <= 30){
                    callsByDay[day] = (callsByDay[day] || 0) + 1;
                }
            }
        });

        return Object.keys(callsByDay).map(day => ({ name: day, calls: callsByDay[parseInt(day)] }));
    }, [calls]);

    return (
        <Card className="col-span-12">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Analytics</CardTitle>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">12 months</Button>
                        <Button variant="ghost" size="sm">30 days</Button>
                        <Button variant="ghost" size="sm">7 days</Button>
                        <Button variant="ghost" size="sm">24 hours</Button>
                    </div>
                </div>
                <CardDescription>Call analytics for last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
                 <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis fontSize={12} tickLine={false} axisLine={false} />
                         <Tooltip
                          cursor={{ fill: 'hsla(var(--accent), 0.5)' }}
                          contentStyle={{ 
                            background: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 'var(--radius)'
                          }}
                        />
                        <Bar dataKey="calls" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

const TopListCard = ({ title, data, headers }: { title: string, data: {source: string, value: string}[], headers: string[] }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>{headers[0]}</TableHead>
                        <TableHead className="text-right">{headers[1]}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((item, index) => (
                        <TableRow key={index}>
                            <TableCell className="font-medium">{item.source}</TableCell>
                            <TableCell className="text-right">{item.value}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
             <Button variant="link" className="w-full mt-2">Channels Report &rarr;</Button>
        </CardContent>
    </Card>
);

const ActiveUsersCard = () => {
    const data = [
      { name: 'Page A', uv: 4000, pv: 2400, amt: 2400 },
      { name: 'Page B', uv: 3000, pv: 1398, amt: 2210 },
      { name: 'Page C', uv: 2000, pv: 9800, amt: 2290 },
      { name: 'Page D', uv: 2780, pv: 3908, amt: 2000 },
      { name: 'Page E', uv: 1890, pv: 4800, amt: 2181 },
      { name: 'Page F', uv: 2390, pv: 3800, amt: 2500 },
      { name: 'Page G', uv: 3490, pv: 4300, amt: 2100 },
    ];
    return (
        <Card>
             <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                    <span className="text-red-500 text-lg mr-1">&#8226;</span>
                     <span className="font-bold">437</span> Live visitors
                </p>
                <div className="h-[150px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <RechartsAreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                             <defs>
                                <linearGradient id="activeUsersGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="uv" stroke="hsl(var(--primary))" fill="url(#activeUsersGradient)" strokeWidth={2} />
                        </RechartsAreaChart>
                    </ResponsiveContainer>
                </div>
                 <div className="grid grid-cols-3 text-center mt-4">
                    <div>
                        <p className="text-lg font-bold">224</p>
                        <p className="text-xs text-muted-foreground">Avg. Daily</p>
                    </div>
                     <div>
                        <p className="text-lg font-bold">1.4K</p>
                        <p className="text-xs text-muted-foreground">Avg. Weekly</p>
                    </div>
                     <div>
                        <p className="text-lg font-bold">22.1K</p>
                        <p className="text-xs text-muted-foreground">Avg. Monthly</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
};


const DonutChartCard = ({ title, data, legendItems }: { title: string, data: { name: string, value: number, fill: string }[], legendItems: string[] }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <ResponsiveContainer width="100%" height={250}>
                 <PieChart>
                    <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5}>
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
                </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-4 text-xs">
                {legendItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{backgroundColor: data[index].fill}}></span>
                        <span>{item}</span>
                    </div>
                ))}
            </div>
        </CardContent>
    </Card>
);

const RecentCallsTable = ({ calls }: { calls: Partial<Call>[] }) => (
  <Card className="col-span-12">
    <CardHeader>
      <div className="flex justify-between items-center">
        <CardTitle>Recent Calls</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Filter className="h-4 w-4 mr-2"/>Filter</Button>
          <Button variant="ghost" size="sm">See all</Button>
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contact</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead className="text-right">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.slice(0, 5).map((call) => (
            <TableRow key={call.id}>
              <TableCell className="font-medium">{call.direction === 'inbound' ? call.from : call.to}</TableCell>
              <TableCell>
                <Badge variant="secondary">{call.category}</Badge>
              </TableCell>
              <TableCell>{call.direction}</TableCell>
              <TableCell>{call.duration} min</TableCell>
              <TableCell className="text-right">{call.created_at ? new Date(call.created_at).toLocaleDateString() : ''}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);

const DemographicCard = () => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Customers Demographic</CardTitle>
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <p className="text-xs text-muted-foreground mb-4">Number of customer based on country</p>
            <div className="relative h-48 w-full mb-4">
                 <Image src="https://placehold.co/400x200.png" alt="World map" layout="fill" objectFit="contain" data-ai-hint="world map" />
            </div>
            <div>
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-4 rounded-sm bg-gray-300" data-ai-hint="USA flag"></div>
                        <span className="text-sm font-medium">USA</span>
                    </div>
                    <span className="text-sm">79%</span>
                </div>
                 <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                    <div className="bg-primary h-1.5 rounded-full" style={{width: "79%"}}></div>
                </div>
            </div>
            <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-4 rounded-sm bg-gray-300" data-ai-hint="France flag"></div>
                        <span className="text-sm font-medium">France</span>
                    </div>
                    <span className="text-sm">23%</span>
                </div>
                 <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                    <div className="bg-primary h-1.5 rounded-full" style={{width: "23%"}}></div>
                </div>
            </div>
        </CardContent>
    </Card>
);


export default function CallsDashboard() {
  const { user, logout } = useAuth();
  
  const topContacts = useMemo(() => {
    const counts: Record<string, number> = {};
    INITIAL_CALLS.forEach(call => {
        const contact = call.direction === 'inbound' ? call.from : call.to;
        if(contact) counts[contact] = (counts[contact] || 0) + 1;
    });
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([source, value]) => ({ source, value: `${value} calls` }));
  }, []);

  const topCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    INITIAL_CALLS.forEach(call => {
        if (call.category) {
            counts[call.category] = (counts[call.category] || 0) + 1;
        }
    });
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([source, value]) => ({ source, value: `${value} calls` }));
  }, []);
  
  const callsByCategoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    INITIAL_CALLS.forEach(call => {
        if(call.category){
            counts[call.category] = (counts[call.category] || 0) + 1;
        }
    });
    const colors = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];
    return Object.entries(counts)
      .map(([name, value], i) => ({ name, value, fill: colors[i % colors.length] }));
  }, []);

  const legendItems = callsByCategoryData.map(d => d.name);

  const totalDuration = useMemo(() => {
    return INITIAL_CALLS.reduce((acc, c) => acc + (parseInt(c.duration || '0', 10)), 0);
  }, []);

  const avgDuration = useMemo(() => {
    if (INITIAL_CALLS.length === 0) return 0;
    return totalDuration / INITIAL_CALLS.length;
  }, [totalDuration]);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent><AppSidebar /></SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
            <AppHeader user={user} logout={logout} pageTitle="Calls Dashboard" />
            <main className="flex-1 p-4 md:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    <StatCard title="Total Calls" value={INITIAL_CALLS.length.toString()} percentage="+20%" change="vs last month" icon={Phone} changeType="up" />
                    <StatCard title="Total Duration" value={`${totalDuration} min`} percentage="+4%" change="vs last month" icon={Clock} changeType="up" />
                    <StatCard title="Avg. Duration" value={`${avgDuration.toFixed(1)} min`} percentage="-1.59%" change="vs last month" icon={TrendingDown} changeType="down" />
                    <StatCard title="Answer Rate" value="92%" percentage="+7%" change="vs last month" icon={TrendingUp} changeType="up" />
                </div>
                <AnalyticsChart calls={INITIAL_CALLS} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <TopListCard title="Top Contacts" data={topContacts} headers={['Source', 'Calls']} />
                    <TopListCard title="Top Categories" data={topCategories} headers={['Page', 'Calls']} />
                    <ActiveUsersCard />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <DonutChartCard title="Sessions By Device" data={callsByCategoryData} legendItems={legendItems} />
                     <DemographicCard />
                </div>
                <RecentCallsTable calls={INITIAL_CALLS} />
            </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
