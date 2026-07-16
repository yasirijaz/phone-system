"use client";

import type { DashboardRecentCall, DashboardStats, DashboardTimeRange } from '@/types';
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Area,
  AreaChart as RechartsAreaChart,
  Tooltip,
  Pie,
  PieChart,
  Cell,
  Legend,
} from 'recharts';
import {
  Users,
  Phone,
  Clock,
  TrendingUp,
  PhoneMissed,
  Loader2,
  ArrowUp,
  ArrowDown,
  Minus,
  Headphones,
  Building2,
} from 'lucide-react';
import { AppSidebar } from '@/components/app-sidebar';
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/app-header';
import { getDashboardStats } from '@/services/dashboardService';
import { useToast } from '@/hooks/use-toast';
import { isElectron } from '@/lib/is-electron';
import { useRouter } from 'next/navigation';
import { formatPhoneNumber } from '@/lib/utils';
import {
  formatCompactDuration,
  formatDuration,
  formatPercent,
  formatTrend,
} from '@/lib/dashboard-utils';

const RANGE_OPTIONS: { value: DashboardTimeRange; label: string }[] = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '12m', label: '12 months' },
];

const STATUS_COLORS: Record<string, string> = {
  completed: 'hsl(var(--primary))',
  missed: 'hsl(0 72% 51%)',
  rejected: 'hsl(25 95% 53%)',
  in_progress: 'hsl(199 89% 48%)',
};

const DIRECTION_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2, 215 20% 65%))'];

const chartTooltipStyle = {
  background: 'hsl(var(--background))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 'var(--radius)',
};

const StatCard = ({
  title,
  value,
  trend,
  icon: Icon,
}: {
  title: string;
  value: string;
  trend: number | null | undefined;
  icon: React.ElementType;
}) => {
  const formatted = formatTrend(trend);
  const TrendIcon = formatted.type === 'up' ? ArrowUp : formatted.type === 'down' ? ArrowDown : Minus;
  const trendColor =
    formatted.type === 'up'
      ? 'text-green-500'
      : formatted.type === 'down'
        ? 'text-red-500'
        : 'text-muted-foreground';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold truncate" title={value}>{value}</div>
        <p className={`text-xs flex items-center mt-1 ${trendColor}`}>
          <TrendIcon className="h-3.5 w-3.5 mr-1" />
          {formatted.label}
        </p>
      </CardContent>
    </Card>
  );
};

function statusVariant(status: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'completed') return 'default';
  if (['missed', 'no-answer', 'no_answer', 'busy', 'canceled', 'cancelled', 'failed'].includes(normalized)) {
    return 'destructive';
  }
  if (normalized === 'in_progress') return 'secondary';
  return 'outline';
}

const RecentCallsTable = ({ calls }: { calls: DashboardRecentCall[] }) => (
  <Card className="col-span-12">
    <CardHeader>
      <CardTitle>Recent Calls</CardTitle>
      <CardDescription>Latest calls across your company</CardDescription>
    </CardHeader>
    <CardContent>
      {calls.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">No recent calls</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {calls.map((call) => (
              <TableRow key={call.id}>
                <TableCell className="font-medium">
                  {formatPhoneNumber(call.contact_phone || '') || 'Unknown'}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(call.call_status)}>
                    {call.call_status || 'unknown'}
                  </Badge>
                </TableCell>
                <TableCell className="capitalize">{call.direction}</TableCell>
                <TableCell>{call.user?.name || '—'}</TableCell>
                <TableCell>{call.department?.name || '—'}</TableCell>
                <TableCell>{formatCompactDuration(call.duration_seconds)}</TableCell>
                <TableCell className="text-right">
                  {call.created_at ? new Date(call.created_at).toLocaleString() : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </CardContent>
  </Card>
);

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const inElectron = isElectron();
  const { toast } = useToast();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<DashboardTimeRange>('30d');

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

  const fetchStats = useCallback(async (range: DashboardTimeRange) => {
    try {
      setLoading(true);
      const data = await getDashboardStats(range);
      setStats(data);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load call analytics.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!inElectron && user) {
      fetchStats(timeRange);
    }
  }, [inElectron, user, timeRange, fetchStats]);

  if (user?.role_id === 1 || inElectron) return null;

  if (loading && !stats) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const summary = stats?.summary;
  const trends = stats?.trends;
  const series = stats?.series ?? [];
  const statusData = (stats?.status_breakdown ?? []).filter((item) => item.value > 0);
  const directionData = (stats?.direction_breakdown ?? []).filter((item) => item.value > 0);
  const agentActivitySeries = series.map((point) => ({
    name: point.label,
    calls: point.calls,
  }));

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <AppSidebar />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          <AppHeader user={user} logout={logout} pageTitle="Dashboard" />
          <main className="flex-1 p-4 md:p-8 space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Call volume, outcomes, agents, and departments for your company.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {RANGE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    size="sm"
                    variant={timeRange === option.value ? 'default' : 'outline'}
                    onClick={() => setTimeRange(option.value)}
                    disabled={loading}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <StatCard
                title="Total Calls"
                value={String(summary?.total_calls ?? 0)}
                trend={trends?.total_calls}
                icon={Phone}
              />
              <StatCard
                title="Talk Time"
                value={formatDuration(summary?.total_duration_seconds ?? 0)}
                trend={trends?.total_duration}
                icon={Clock}
              />
              <StatCard
                title="Avg. Duration"
                value={formatCompactDuration(summary?.avg_duration_seconds ?? 0)}
                trend={trends?.avg_duration}
                icon={Headphones}
              />
              <StatCard
                title="Answer Rate"
                value={formatPercent(summary?.answer_rate)}
                trend={trends?.answer_rate}
                icon={TrendingUp}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <StatCard
                title="Missed Calls"
                value={String(summary?.missed ?? 0)}
                trend={trends?.missed}
                icon={PhoneMissed}
              />
              <StatCard
                title="Inbound"
                value={String(summary?.inbound ?? 0)}
                trend={null}
                icon={Phone}
              />
              <StatCard
                title="Outbound"
                value={String(summary?.outbound ?? 0)}
                trend={null}
                icon={Phone}
              />
              <StatCard
                title="Active Agents"
                value={String(summary?.active_agents ?? 0)}
                trend={null}
                icon={Users}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Call Volume</CardTitle>
                <CardDescription>
                  Calls over the selected range
                  {loading ? ' · refreshing…' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: 'hsla(var(--accent), 0.5)' }}
                      contentStyle={chartTooltipStyle}
                      formatter={(value: number, name: string) =>
                        name === 'duration_seconds'
                          ? [formatDuration(value), 'Talk time']
                          : [value, 'Calls']
                      }
                    />
                    <Bar
                      dataKey="calls"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      barSize={20}
                      name="calls"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Top Contacts</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contact</TableHead>
                        <TableHead className="text-right">Calls</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(stats?.top_contacts ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-muted-foreground text-center">
                            No contacts
                          </TableCell>
                        </TableRow>
                      ) : (
                        (stats?.top_contacts ?? []).slice(0, 6).map((contact) => (
                          <TableRow key={`${contact.phone}-${contact.calls}`}>
                            <TableCell className="font-medium max-w-[160px] truncate">
                              {contact.label}
                            </TableCell>
                            <TableCell className="text-right">{contact.calls}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Top Agents</CardTitle>
                  <Headphones className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead className="text-right">Calls</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(stats?.top_agents ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-muted-foreground text-center">
                            No agent activity
                          </TableCell>
                        </TableRow>
                      ) : (
                        (stats?.top_agents ?? []).slice(0, 6).map((agent) => (
                          <TableRow key={agent.user_id}>
                            <TableCell className="font-medium max-w-[160px] truncate">
                              {agent.name}
                            </TableCell>
                            <TableCell className="text-right">{agent.calls}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Agents On Calls</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    <span className="text-green-500 text-lg mr-1">●</span>
                    <span className="font-bold text-foreground">{summary?.active_agents ?? 0}</span>
                    {' '}currently in a call
                  </p>
                  <div className="h-[120px] w-full mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsAreaChart data={agentActivitySeries} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="activeAgentsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="calls"
                          stroke="hsl(var(--primary))"
                          fill="url(#activeAgentsGradient)"
                          strokeWidth={2}
                        />
                      </RechartsAreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 max-h-28 overflow-auto">
                    {(stats?.active_agents ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">No agents currently on a call</p>
                    ) : (
                      (stats?.active_agents ?? []).map((agent) => (
                        <div key={agent.id} className="flex items-center justify-between text-sm">
                          <span className="truncate">{agent.name}</span>
                          <Badge variant="secondary">In call</Badge>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Call Outcomes</CardTitle>
                </CardHeader>
                <CardContent>
                  {statusData.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">No data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={statusData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                        >
                          {statusData.map((entry) => (
                            <Cell
                              key={entry.key}
                              fill={STATUS_COLORS[entry.key] || 'hsl(var(--muted-foreground))'}
                            />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Inbound vs Outbound</CardTitle>
                </CardHeader>
                <CardContent>
                  {directionData.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">No data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={directionData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                        >
                          {directionData.map((entry, index) => (
                            <Cell
                              key={entry.key}
                              fill={DIRECTION_COLORS[index % DIRECTION_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Departments</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {(stats?.top_departments ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">No department data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={stats?.top_departments ?? []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Bar dataKey="calls" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Recordings</p>
                  <p className="text-2xl font-bold">{summary?.recording_count ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Voicemails</p>
                  <p className="text-2xl font-bold">{summary?.voicemail_count ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{summary?.completed ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">Rejected</p>
                  <p className="text-2xl font-bold">{summary?.rejected ?? 0}</p>
                </CardContent>
              </Card>
            </div>

            <RecentCallsTable calls={stats?.recent_calls ?? []} />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
