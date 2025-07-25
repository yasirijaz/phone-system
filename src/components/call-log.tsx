
import type { Call } from '@/types';
import { PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

interface CallLogProps {
  calls: Call[];
  onMakeCall: (number: string) => void;
}

function CallCard({ call, onMakeCall }: { call: Call, onMakeCall: (number: string) => void; }) {
  const fromName = call.from_name?.name || call.from;
  const toName = call.to_name?.name || call.to;

  const receivedByName = call.user?.name ?? 'Unassigned';
  
  const contactName = call.direction === 'inbound' ? fromName : toName;
  const contactInitial = contactName ? contactName.charAt(0).toUpperCase() : '?';

  const isMissed = call.call_status === 'missed' || call.call_status === 'no-answer' || call.call_status === 'busy' || call.call_status === 'canceled';
  const hasRecording = !!call.recording_url;
  
  const cardBg = isMissed ? 'bg-red-50' : hasRecording ? 'bg-green-50' : 'bg-background';

  const contactDisplayNumber = call.direction === 'inbound' ? call.from : call.to;
  
  const handleCallClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onMakeCall(contactDisplayNumber);
  }

  return (
    <Link href={`/conversations/${encodeURIComponent(contactDisplayNumber)}`} key={call.id} className="block">
        <div className="flex items-start gap-4">
            <Avatar>
                <AvatarImage src={`https://placehold.co/100x100.png?text=${contactInitial}`} alt={contactName} />
                <AvatarFallback>{contactInitial}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <div className={`p-4 rounded-lg border ${cardBg}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium">
                           {call.direction === 'inbound' ? <PhoneIncoming className="h-4 w-4" /> : <PhoneOutgoing className="h-4 w-4" />}
                           <span>{call.direction.charAt(0).toUpperCase() + call.direction.slice(1)} / {call.call_status} ({call.duration} min)</span>
                      </div>
                    </div>
                    <div className="text-sm mt-2 space-y-1 text-muted-foreground">
                        <p className="text-foreground"><strong>Received By:</strong> {receivedByName}</p>
                        <p><strong>From:</strong> {fromName} ({call.from})</p>
                        <p><strong>To:</strong> {toName} ({call.to})</p>
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
    </Link>
  )
}

export default function CallLog({ calls, onMakeCall }: CallLogProps) {
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
                    <CallCard call={call} key={call.id} onMakeCall={onMakeCall} />
                ))}
             </div>
        </div>
      ))}
    </div>
  );
}
