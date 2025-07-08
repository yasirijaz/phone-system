"use client";

import { useState, useMemo, type ChangeEvent } from 'react';
import type { Call } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Search } from 'lucide-react';
import { Logo } from '@/components/icons';
import CallStats from '@/components/call-stats';
import CallLog from '@/components/call-log';
import LogCallForm from '@/components/log-call-form';

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
    dateTime: '2024-07-22T14:00:00',
    duration: 30,
    type: 'incoming',
    notes: 'Initial discovery call. Potential for a large enterprise deal. Scheduled a follow-up demo for next week.',
    category: 'Sales',
  },
  {
    id: '4',
    contact: 'Mom',
    dateTime: '2024-07-22T18:45:00',
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
];

export default function Home() {
  const [calls, setCalls] = useState<Call[]>(INITIAL_CALLS);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const filteredCalls = useMemo(() => {
    return calls
      .filter(call => call.contact.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [calls, searchTerm]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleAddCall = (newCall: Omit<Call, 'id'>) => {
    const callWithId: Call = { ...newCall, id: crypto.randomUUID() };
    setCalls(prevCalls => [callWithId, ...prevCalls]);
    setIsSheetOpen(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-card shadow-sm">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8 text-primary" />
          <h1 className="text-xl font-bold text-primary">CallSync</h1>
        </div>
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
      </header>

      <main className="flex-1 p-4 md:p-8 space-y-8">
        <CallStats calls={calls} />
        
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle>Call History</CardTitle>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter by contact..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CallLog calls={filteredCalls} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
