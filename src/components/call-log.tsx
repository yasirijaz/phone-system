

import type { Communication, Contact } from '@/types';
import { PhoneIncoming, PhoneOutgoing, Phone as PhoneIcon, Ear, Mic, Info, Loader2, MessageSquare, Video, Share2, ExternalLink, MoreHorizontal, ArrowUpRight } from 'lucide-react';
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
  contacts: Contact[];
  onMakeCall: (number: string) => void;
  isClickable?: boolean;
  source?: string;
}

function CommunicationCard({ 
    comm, 
    contacts,
    onMakeCall, 
    isClickable, 
    source, 
    isFirstInGroup 
}: { 
    comm: Communication, 
    contacts: Contact[],
    onMakeCall: (number: string) => void, 
    isClickable: boolean, 
    source?: string,
    isFirstInGroup: boolean
}) {
  const { user } = useAuth();
  const { toast } = useToast();

  const isMine = comm.direction === 'outbound' || (user && comm.user_id === user.id && comm.direction !== 'inbound');

  const findContact = (phone: string) => {
    return contacts.find(c => c.phone_no === phone);
  };
  
  // Always show the other party
  const otherPartyNumber = isMine ? comm.to : comm.from;
  const contact = findContact(otherPartyNumber);
  
  const otherParty = {
      name: contact?.name || otherPartyNumber,
      number: otherPartyNumber,
      initial: (contact?.name || otherPartyNumber || '?').charAt(0).toUpperCase()
  };

  const contactName = isFirstInGroup ? (isMine ? (user?.name || 'Me') : otherParty.name) : '';
  const contactInitial = isMine ? (user?.name || 'Me').charAt(0).toUpperCase() : otherParty.initial;
  const isMissed = comm.call_status === 'missed' || comm.call_status === 'no-answer' || comm.call_status === 'busy' || comm.call_status === 'canceled';
  
  const showAvatar = !isMine && isFirstInGroup;

  const renderMessageBubble = (c: Communication) => (
    <div className={cn("p-3 rounded-lg max-w-[80%]", isMine ? "bg-primary text-primary-foreground" : "bg-muted")}>
      <p>{c.body}</p>
    </div>
  );

  const renderCallBubble = (c: Communication) => {
    const title = isMine ? `You called ${otherParty.name}` : `${otherParty.name} called you`;
    const Icon = isMine ? PhoneOutgoing : PhoneIncoming;

    const fromNumberFormatted = c.from?.replace(/^\+1/, '');
    const toNumberFormatted = c.to?.replace(/^\+1/, '');
    
    const duration = c.duration ? `${c.duration} min` : 'Unanswered';
    const endTime = c.created_at ? format(parseISO(c.created_at), 'p') : '';

    return (
        <div className={cn("flex items-start gap-3 p-3 rounded-lg w-full max-w-sm", isMine ? "bg-primary/10" : "bg-muted")}>
            <Icon className={cn("h-5 w-5 mt-1", isMissed ? "text-destructive" : "text-muted-foreground")} />
            <div className="flex-1 text-sm space-y-1">
                <p className="font-semibold">{title}</p>
                <p className="text-muted-foreground text-xs">
                    {c.direction === 'inbound' ? 'Dialpad' : 'Other'} {fromNumberFormatted} &rarr; {c.direction === 'inbound' ? 'Other' : 'Dialpad'} {toNumberFormatted}
                </p>
                <p className="text-muted-foreground text-xs">
                    Lasted {duration} &bull; Ended at {endTime}
                </p>
                {c.recording_url && (
                   <AudioPlayer src={c.recording_url} type="Recording" />
                )}
            </div>
        </div>
    );
  };

  const CardContent = () => {
    // On the main listing page, we only want to show the external contact info
    const mainPageContactName = otherParty.name;
    const mainPageContactNumber = otherParty.number;
    const mainPageAvatarInitial = otherParty.initial;

    if (isClickable) {
       const from = encodeURIComponent(comm.direction === 'inbound' ? comm.to : comm.from);
       const to = encodeURIComponent(comm.direction === 'inbound' ? comm.from : comm.to);
       const queryString = source === 'unread' ? `?source=unread` : '';
       return (
            <div className="flex items-center p-4 gap-4 hover:bg-muted/50 rounded-lg group">
                <Link href={`/conversations/${from}/${to}${queryString}`} key={comm.id || `${comm.from}-${comm.to}`} className="flex-1 flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                        <AvatarFallback>{mainPageAvatarInitial}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <div className="flex justify-between items-center">
                            <p className={cn("font-semibold", !comm.is_read && "font-bold")}>{mainPageContactName}</p>
                            {comm.created_at && (
                                <p className={cn("text-xs text-muted-foreground", !comm.is_read && "text-primary font-semibold")}>
                                    {format(parseISO(comm.created_at), 'MMM d')}
                                </p>
                            )}
                        </div>
                         <p className={cn("text-sm text-muted-foreground truncate", !comm.is_read && "text-foreground")}>
                            {comm.type === 'sms' ? comm.body : `${comm.direction === 'inbound' ? 'Incoming' : 'Outgoing'} call`}
                         </p>
                    </div>
                </Link>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                        e.stopPropagation();
                        onMakeCall(mainPageContactNumber);
                    }}
                >
                    <PhoneIcon className="h-5 w-5" />
                </Button>
            </div>
       )
    }

    return (
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
    )
  };

  return <CardContent />;
}

export default function CallLog({ calls: communications, contacts, onMakeCall, isClickable = true, source }: CallLogProps) {
  if (communications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-48 border-2 border-dashed rounded-lg m-6 p-4">
        <p className="text-lg font-medium">No activity yet</p>
        <p>Your history with this contact will appear here.</p>
      </div>
    );
  }

  if(isClickable) {
    return (
        <div className="space-y-1">
            {communications.map((comm) => (
                <CommunicationCard
                    comm={comm}
                    contacts={contacts}
                    key={comm.id || `${comm.from}-${comm.to}`}
                    onMakeCall={onMakeCall}
                    isClickable={isClickable}
                    source={source}
                    isFirstInGroup={true}
                />
            ))}
        </div>
    )
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
                            contacts={contacts}
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
