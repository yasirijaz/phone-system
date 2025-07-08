import type { Call } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Clock, Phone, User, Users } from 'lucide-react';
import { useMemo } from 'react';
import CategoryChart from './category-chart';

interface CallStatsProps {
  calls: Call[];
}

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
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCalls}</div>
            <p className="text-xs text-muted-foreground">in the logbook</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDuration} min</div>
            <p className="text-xs text-muted-foreground">spent on calls</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Contact</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">{mostFrequentContact}</div>
            <p className="text-xs text-muted-foreground">Most frequently called</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-bold">&nbsp;</div>
            <p className="text-xs text-muted-foreground">Breakdown by category</p>
          </CardContent>
        </Card>
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
