
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

function CommunicationCard({ comm, onMakeCall, isClickable, source }: { comm: Communication, onMakeCall: (number: string) => void, isClickable: boolean, source?: string }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const contactName = comm.direction === 'inbound' 
                        ? (comm.from_name?.name || comm.user?.name || comm.from) 
                        : (comm.to_name?.name || comm.user?.name || comm.to);
                        
  const contactInitial = contactName ? contactName.charAt(0).toUpperCase() : '?';

  const isMissed = comm.call_status === 'missed' || comm.call_status === 'no-answer' || comm.call_status === 'busy' || comm.call_status === 'canceled';
  const isInProgress = comm.call_status === 'in_progress';

  const contactDisplayNumber = (comm.direction === 'inbound' || (comm.latest_type || comm.type) === 'sms') ? comm.from : comm.to;
  const handleCallClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onMakeCall(contactDisplayNumber);
  }

  const handleJoinCall = async (e: React.MouseEvent, options: { silent?: boolean, coach?: boolean }) => {
    e.stopPropagation();
    e.preventDefault();
 
    if (!user || !comm.conference_sid) {
      toast({ title: "Error", description: "Cannot join call. Required information is missing.", variant: "destructive" });
      return;
    }
    
    try {
      await addParticipant(comm.conference_sid, comm.from, String(user.id), undefined, { coach: true, silent: options.silent });
      toast({ title: "Success", description: "You have joined the call." });
    } catch(error) {
       toast({ title: "Error", description: "Failed to join the call.", variant: "destructive" });
    }
  }

  const renderIcon = () => {
    const type = comm.latest_type || comm.type;
    const iconClasses = "h-4 w-4";

    if (type === 'sms') {
      return <MessageSquare className={cn(iconClasses, "text-blue-500")} />;
    }
    if(isMissed) {
        return comm.direction === 'inbound' ? <PhoneIncoming className={cn(iconClasses, "text-red-500")} /> : <PhoneOutgoing className={cn(iconClasses, "text-red-500")} />;
    }
    return comm.direction === 'inbound' ? <PhoneIncoming className={cn(iconClasses, "text-gray-500")} /> : <PhoneOutgoing className={cn(iconClasses, "text-gray-500")} />;
  }

  const renderTimestamp = () => {
      const date = parseISO(comm.created_at || comm.latest_created_at!);
      if(isToday(date)) return format(date, 'p');
      if(isYesterday(date)) return 'Yesterday';
      return format(date, 'd MMM');
  }

  const CardContent = () => (
     <div className={cn(
            "flex items-center gap-4 px-4 py-3 hover:bg-muted/50",
            (comm.is_read === false || comm.is_read === 0) && "bg-primary/5 border-l-2 border-primary"
        )}>
        <Avatar className="h-9 w-9">
            <AvatarImage src={`https://placehold.co/100x100.png?text=${contactInitial}`} alt={contactName} />
            <AvatarFallback>{contactInitial}</AvatarFallback>
        </Avatar>
        <div className="flex-1 overflow-hidden">
            <div className="flex justify-between items-center">
                <p className={cn("font-semibold truncate", isMissed && "text-red-500")}>{contactName}</p>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>{renderTimestamp()}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCallClick}>
                        <PhoneIcon className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                {renderIcon()}
                <span className="truncate">
                    {(comm.latest_type || comm.type) === 'sms' 
                        ? comm.body 
                        : `${comm.direction === 'inbound' ? 'Incoming' : 'Outgoing'} call ${comm.duration ? `(${comm.duration} min)` : ''}`
                    }
                </span>
                 {!!comm.recording_url && <AudioPlayer src={comm.recording_url} type='Recording' />}
                 {!!comm.voice_mail && <AudioPlayer src={comm.voice_mail} type='VoiceMail' />}
            </div>
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
      <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-48 border-2 border-dashed rounded-lg m-6">
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
    <div>
      {Object.entries(groupedCommunications).map(([date, commsForDay]) => (
        <div key={date}>
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm flex items-center justify-center my-2">
                <div className="text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                    {format(parseISO(date), 'EEEE, d MMM yyyy')}
                </div>
            </div>
             <div>
                {commsForDay.map((comm) => (
                    <CommunicationCard comm={comm} key={comm.id || `${comm.from}-${comm.to}`} onMakeCall={onMakeCall} isClickable={isClickable} source={source} />
                ))}
             </div>
        </div>
      ))}
    </div>
  );
}
