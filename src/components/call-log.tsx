

import type { Communication } from '@/types';
import { PhoneIncoming, PhoneOutgoing, Phone as PhoneIcon, Ear, Mic, Info, Loader2, MessageSquare, Video } from 'lucide-react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { useAuth } from '@/context/AuthContext';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';
import { addParticipant } from '@/services/twilioService';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import AudioPlayer from './AudioPlayer';
import React from 'react';
import { cn } from '@/lib/utils';

interface CallLogProps {
  calls: Communication[];
  onMakeCall: (number: string) => void;
  isClickable?: boolean;
  source?: string;
}

function CommunicationCard({ 
    comm, 
    onMakeCall, 
    isClickable, 
    source, 
    isFirstInGroup 
}: { 
    comm: Communication, 
    onMakeCall: (number: string) => void, 
    isClickable: boolean, 
    source?: string,
    isFirstInGroup: boolean
}) {
  const { user } = useAuth();
  const { toast } = useToast();

  const isMine = comm.direction === 'outbound' || (user && comm.user_id === user.id && comm.direction !== 'inbound');

  const contactName = isMine 
    ? (user?.name || 'Me')
    : (comm.from_name?.name || comm.user?.name || comm.from);
                        
  const contactInitial = contactName ? contactName.charAt(0).toUpperCase() : '?';

  const isMissed = comm.call_status === 'missed' || comm.call_status === 'no-answer' || comm.call_status === 'busy' || comm.call_status === 'canceled';
  const isInProgress = comm.call_status === 'in_progress';

  const contactDisplayNumber = (comm.direction === 'inbound' || (comm.latest_type || comm.type) === 'sms') ? comm.from : comm.to;
  
  const showAvatar = !isMine && isFirstInGroup;

  const renderMessageBubble = (c: Communication) => (
    <div className={cn("p-3 rounded-lg max-w-[80%]", isMine ? "bg-primary text-primary-foreground" : "bg-muted")}>
      <p>{c.body}</p>
    </div>
  );

  const renderCallBubble = (c: Communication) => (
    <div className={cn("p-3 rounded-lg max-w-[80%] flex items-center gap-2", isMine ? "bg-blue-900 text-white" : "bg-gray-700 text-white")}>
      {c.direction === 'inbound' ? <PhoneIncoming className="h-5 w-5 flex-shrink-0" /> : <PhoneOutgoing className="h-5 w-5 flex-shrink-0" />}
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="font-semibold whitespace-nowrap text-sm">{c.direction === 'inbound' ? 'Incoming Call' : 'Outgoing Call'}</p>
        <p className="text-xs whitespace-nowrap">{c.duration ? `${c.duration} min` : 'Unanswered'}</p>
      </div>
    </div>
  );

  const CardContent = () => (
     <div className={cn("flex items-start gap-3 p-2", isMine ? "justify-end" : "justify-start")}>
        {showAvatar && (
            <Avatar className="h-8 w-8">
                <AvatarFallback>{contactInitial}</AvatarFallback>
            </Avatar>
        )}
         {!showAvatar && !isMine && <div className="w-8" />}

        <div className={cn("flex flex-col gap-1", isMine ? 'items-end' : 'items-start')}>
             {isFirstInGroup && comm.created_at && (
                 <p className={cn("text-xs text-muted-foreground", isMine ? "text-right" : "text-left", "px-1")}>
                     <span className="font-semibold">{contactName}</span> • {format(parseISO(comm.created_at), 'p')}
                </p>
             )}
            {comm.type === 'sms' ? renderMessageBubble(comm) : renderCallBubble(comm)}
        </div>
    </div>
  );

  if (isClickable) {
    const from = encodeURIComponent(comm.direction === 'inbound' ? comm.to : comm.from);
    const to = encodeURIComponent(comm.direction === 'inbound' ? comm.from : comm.to);
    const queryString = source === 'unread' ? `?source=unread` : '';
    return (
        <Link href={`/conversations/${from}/${to}${queryString}`} key={comm.id || `${comm.from}-${comm.to}`} className="block">
            <CardContent />
        </Link>
    );
  }

  return <CardContent />;
}

export default function CallLog({ calls: communications, onMakeCall, isClickable = true, source }: CallLogProps) {
  if (communications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-48 border-2 border-dashed rounded-lg m-6 p-4">
        <p className="text-lg font-medium">No activity yet</p>
        <p>Your history with this contact will appear here.</p>
      </div>
    );
  }
  
  const groupedCommunications = communications
    .filter(comm => comm.created_at || comm.latest_created_at) // Filter out items with no created_at date
    .reduce((acc, comm) => {
      const date = format(parseISO(comm.created_at || comm.latest_created_at!), 'yyyy-MM-dd');
      if (!acc[date]) {
          acc[date] = [];
      }
      acc[date].push(comm);
      return acc;
    }, {} as Record<string, Communication[]>);

  return (
    <div className="p-4 space-y-4">
      {Object.entries(groupedCommunications).map(([date, commsForDay]) => (
        <div key={date}>
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm flex items-center justify-center my-2">
                <div className="text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                    {format(parseISO(date), 'EEEE, d MMM yyyy')}
                </div>
            </div>
             <div className="space-y-1">
                {commsForDay.map((comm, index) => {
                    const prevComm = index > 0 ? commsForDay[index - 1] : null;
                    
                    const isFirstInGroup = !prevComm || 
                                           prevComm.type !== 'sms' || 
                                           comm.type !== 'sms' ||
                                           prevComm.direction !== comm.direction;

                    return (
                        <CommunicationCard 
                            comm={comm} 
                            key={comm.id || `${comm.from}-${comm.to}-${index}`} 
                            onMakeCall={onMakeCall} 
                            isClickable={isClickable} 
                            source={source}
                            isFirstInGroup={isFirstInGroup}
                        />
                    )
                })}
             </div>
        </div>
      ))}
    </div>
  );
}
