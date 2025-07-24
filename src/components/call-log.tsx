
import type { Call } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PhoneIncoming, PhoneOutgoing, User, Clock, CalendarDays, NotebookText, Voicemail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isSameDay } from 'date-fns';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

interface CallLogProps {
  calls: Call[];
}

function CallCard({ call }: { call: Call }) {
  const getContactName = () => {
    if (call.direction === 'inbound') {
      return call.meta_data?.from_name || call.from;
    }
    return call.meta_data?.to_name || call.to;
  };
  
  const getContactNumber = () => {
    return call.direction === 'inbound' ? call.from : call.to;
  }
  
  const contactName = getContactName();
  const receivedBy = call.meta_data?.received_by || "Melissa Pesantez"; // Placeholder
  const contactInitial = contactName ? contactName.charAt(0).toUpperCase() : '?';

  const isMissed = call.call_status === 'missed' || call.call_status === 'no-answer' || call.call_status === 'busy' || call.call_status === 'canceled';
  const hasRecording = !!call.recording_url;
  
  const cardBg = isMissed ? 'bg-red-50' : hasRecording ? 'bg-green-50' : 'bg-background';

  return (
    <div className="flex items-start gap-4">
        <Avatar>
            <AvatarImage src={`https://placehold.co/100x100.png?text=${contactInitial}`} alt={contactName} />
            <AvatarFallback>{contactInitial}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
            <div className={`p-4 rounded-lg border ${cardBg}`}>
                <div className="flex items-center gap-2 text-sm font-medium">
                     {call.direction === 'inbound' ? <PhoneIncoming className="h-4 w-4" /> : <PhoneOutgoing className="h-4 w-4" />}
                     <span>Inbound / {call.call_status} ({call.duration} min)</span>
                </div>
                <div className="text-sm mt-2">
                    <p><strong>Received By:</strong> {receivedBy}</p>
                    <div className="flex items-center gap-4 text-muted-foreground">
                        <span>({getContactNumber()})</span>
                        <PhoneIncoming className="h-4 w-4" />
                        <span>({call.from})</span>
                    </div>
                </div>
                 {hasRecording && (
                    <div className="mt-2">
                        <audio controls src={call.recording_url} className="w-full h-8" onClick={(e) => e.preventDefault()}></audio>
                    </div>
                )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{format(parseISO(call.created_at), 'p')}</p>
        </div>
    </div>
  )
}

export default function CallLog({ calls }: CallLogProps) {
  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-48 border-2 border-dashed rounded-lg">
        <p className="text-lg font-medium">No activity yet</p>
        <p>Your history with this contact will appear here.</p>
      </div>
    );
  }
  
  const groupedCalls = calls.reduce((acc, call) => {
    const date = format(parseISO(call.created_at), 'yyyy-MM-dd');
    if (!acc[date]) {
        acc[date] = [];
    }
    acc[date].push(call);
    return acc;
  }, {} as Record<string, Call[]>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedCalls).map(([date, callsForDay]) => (
        <div key={date}>
            <div className="flex items-center justify-center my-4">
                <div className="text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                    {format(parseISO(date), 'EEEE, d MMM yyyy')}
                </div>
            </div>
             <div className="space-y-4">
                {callsForDay.map((call) => (
                    <CallCard key={call.id} call={call} />
                ))}
             </div>
        </div>
      ))}
    </div>
  );
}
