import type { Call } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Clock, Phone, User, Users, ArrowUp, ArrowDown } from 'lucide-react';
import { useMemo } from 'react';
import CategoryChart from './category-chart';

interface CallStatsProps {
  calls: Call[];
}

const StatCard = ({ title, value, icon: Icon, trend, trendType }: { title: string, value: string, icon: React.ElementType, trend: string, trendType: 'up' | 'down' }) => (
    <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
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

export default function CallStats({ calls }: CallStatsProps) {
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

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Calls" value={String(totalCalls)} icon={Phone} trend="+12%" trendType="up" />
        <StatCard title="Total Duration" value={`${totalDuration} min`} icon={Clock} trend="+25%" trendType="up" />
        <StatCard title="Top Contact" value={mostFrequentContact} icon={User} trend="-2%" trendType="down" />
        <StatCard title="Active Users" value="5" icon={Users} trend="+2" trendType="up" />
      </div>
       <div className="mt-4">
        <Card className="shadow-md col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle>Call Volume by Category</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <CategoryChart calls={calls} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
