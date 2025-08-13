
import type { Call, User } from '@/types';
import { PhoneIncoming, PhoneOutgoing, Phone as PhoneIcon, Ear, Mic } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { useAuth } from '@/context/AuthContext';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';
import { addParticipant } from '@/services/twilioService';

interface CallLogProps {
  calls: Call[];
  onMakeCall: (number: string) => void;
  isClickable?: boolean;
}

function CallCard({ call, onMakeCall, isClickable }: { call: Call, onMakeCall: (number: string) => void, isClickable: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role_id === 1 || user?.role_id === 2;

  const fromName = call.from_name?.name || call.user?.name || call.from;
  const toName = call.to_name?.name || call.user?.name || call.to;

  const receivedByName = call.user?.name ?? 'Unassigned';
  const contactName = call.direction === 'inbound' 
                        ? (call.from_name?.name || call.user?.name || call.from) 
                        : (call.to_name?.name || call.user?.name || call.to);
                        
  const contactInitial = contactName ? contactName.charAt(0).toUpperCase() : '?';

  const isMissed = call.call_status === 'missed' || call.call_status === 'no-answer' || call.call_status === 'busy' || call.call_status === 'canceled';
  const isInProgress = call.call_status === 'in_progress';
  const hasRecording = !!call.recording_url;
  
  const cardBg = isMissed ? 'bg-red-50 dark:bg-red-950/20' : hasRecording ? 'bg-green-50 dark:bg-green-950/20' : 'bg-background';

  const contactDisplayNumber = call.direction === 'inbound' ? call.from : call.to;
  
  const handleCallClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onMakeCall(contactDisplayNumber);
  }
  
  const handleJoinCall = async (options: { silent?: boolean, coach?: boolean }) => {
    if (!user || !call.conference_sid) {
      toast({ title: "Error", description: "Cannot join call. Required information is missing.", variant: "destructive" });
      return;
    }
    
    try {
      await addParticipant(call.conference_sid, call.from, String(user.id), options);
      toast({ title: "Success", description: "You have joined the call." });
    } catch(error) {
       toast({ title: "Error", description: "Failed to join the call.", variant: "destructive" });
    }
  }


  const getStatusBadge = (status?: string) => {
    switch (status) {
        case 'completed': return <Badge variant="default">Completed</Badge>;
        case 'in_progress': return <Badge variant="secondary" className="bg-blue-100 text-blue-800">In Progress</Badge>;
        case 'ringing': return <Badge variant="outline">Ringing</Badge>;
        case 'missed':
        case 'no-answer':
        case 'busy':
        case 'canceled':
            return <Badge variant="destructive">Missed</Badge>;
        default:
            return <Badge variant="secondary">{status}</Badge>;
    }
  }

  const CardContent = () => (
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
                       <span>{call.direction.charAt(0).toUpperCase() + call.direction.slice(1)}</span>
                       {getStatusBadge(call.call_status)}
                       <span>({call.duration} min)</span>
                  </div>
                   <Button variant="ghost" size="icon" onClick={handleCallClick}>
                        <PhoneIcon className="h-4 w-4" />
                   </Button>
                </div>
                <div className="text-sm mt-2 space-y-1 text-muted-foreground">
                    <p className="text-foreground"><strong>Received By:</strong> {receivedByName}</p>
                    <p><strong>From:</strong> {fromName} ({call.from})</p>
                    <p><strong>To:</strong> {toName} ({call.to})</p>
                </div>
                 {isInProgress && isAdmin && (
                    <div className="mt-4 flex gap-2 border-t pt-2">
                        <Button variant="outline" size="sm" onClick={() => handleJoinCall({ silent: true, coach: true })}>
                            <Ear className="mr-2 h-4 w-4" />
                            Silently Listen
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleJoinCall({ coach: true })}>
                            <Mic className="mr-2 h-4 w-4" />
                            Barge In
                        </Button>
                    </div>
                 )}
                 {hasRecording && (
                    <div className="mt-2">
                        {/* <audio controls src={call.recording_url} className="w-full h-8" onClick={(e) => e.preventDefault()}></audio> */}
                    </div>
                )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{format(parseISO(call.created_at), 'p')}</p>
        </div>
    </div>
  );

  if (isClickable) {
    return (
        <Link href={`/conversations/${encodeURIComponent(contactDisplayNumber)}`} key={call.id} className="block">
            <CardContent />
        </Link>
    );
  }

  return <CardContent />;
}

export default function CallLog({ calls, onMakeCall, isClickable = true }: CallLogProps) {
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
                    <CallCard call={call} key={call.id} onMakeCall={onMakeCall} isClickable={isClickable} />
                ))}
             </div>
        </div>
      ))}
    </div>
  );
}
