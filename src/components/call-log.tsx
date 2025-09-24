

import type { Communication, Contact } from '@/types';
import { PhoneIncoming, PhoneOutgoing, Phone as PhoneIcon, User } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import AudioPlayer from './AudioPlayer';
import { ChevronDown } from 'lucide-react';

interface CallLogProps {
  calls: Communication[];
  contacts?: Contact[];
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
    isFirstInGroup,
    isLastInGroup,
    isMiddleOfGroup
}: { 
    comm: Communication, 
    contacts?: Contact[],
    onMakeCall: (number: string) => void, 
    isClickable: boolean, 
    source?: string,
    isFirstInGroup: boolean,
    isLastInGroup: boolean,
    isMiddleOfGroup: boolean | null
}) {
  const { user } = useAuth();

  const getInitials = (name: string) => {
    if (!name) return '?';
    const nameParts = name.split(' ').filter(Boolean);
    if (nameParts.length > 1) {
      return `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  const isMine = comm.direction === 'outbound' || (user && comm.user_id === user.id && comm.direction !== 'inbound');

  const findContact = (phone: string) => {
    if (!contacts || contacts.length === 0) return null;
    return contacts.find(c => c.phone_no === phone);
  };
  
  const otherPartyNumber = isMine ? comm.to : comm.from;
  const contact = findContact(otherPartyNumber);
  
  const otherParty = {
      name: contact?.name || otherPartyNumber,
      number: otherPartyNumber,
      initial: getInitials(contact?.name || otherPartyNumber)
  };
  const contactName = isFirstInGroup ? (isMine ? (user?.name || 'Me') : otherParty.name) : '';
  const contactInitial = getInitials(isMine ? (user?.name || 'Me') : otherParty.name);
  const isMissed = comm.call_status === 'missed' || comm.call_status === 'no-answer' || comm.call_status === 'busy' || comm.call_status === 'canceled';
  
  const showAvatar = !isMine && isFirstInGroup;

  const renderMessageBubble = (c: Communication) => (
     <div className={cn(
      "p-3 max-w-[80%] break-words",
      isMine ? "bg-primary text-primary-foreground" : "bg-muted",
      isFirstInGroup && (isMine ? "rounded-t-lg rounded-bl-lg" : "rounded-t-lg rounded-br-lg"),
      isLastInGroup && !isFirstInGroup && (isMine ? "rounded-b-lg rounded-l-lg" : "rounded-b-lg rounded-r-lg"),
      isMiddleOfGroup && (isMine ? "rounded-l-lg" : "rounded-r-lg"),
      !isFirstInGroup && !isLastInGroup && !isMiddleOfGroup && "rounded-lg"
    )}>
      <p className="text-sm">{c.body}</p>
    </div>
  );

  const renderCallBubble = (c: Communication) => {
    const title = isMine ? `You called ${otherParty.name}` : `${otherParty.name} called you`;
    const Icon = isMine ? PhoneOutgoing : PhoneIncoming;

    const fromNumberFormatted = c.from?.replace(/^\+1/, '');
    const toNumberFormatted = c.to?.replace(/^\+1/, '');
    
    const duration = c.duration ? `${c.duration} seconds` : 'Unanswered';
    const endTime = c.created_at ? format(parseISO(c.created_at), 'p') : '';

    return (
        <div className={cn("flex items-start gap-3 p-3 rounded-lg w-full", isMine ? "bg-primary/10" : "bg-muted")}>
            <Icon className={cn("h-5 w-5 mt-1", isMissed ? "text-destructive" : "text-muted-foreground")} />
            <div className="flex-1 flex items-center justify-between text-sm space-y-1">
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <p className="font-semibold">{title}</p>
                    </div>
                    <p className="text-muted-foreground text-xs">
                        {c.direction === 'inbound' ? 'Dialpad' : 'Other'} {fromNumberFormatted} &rarr; {c.direction === 'inbound' ? 'Other' : 'Dialpad'} {toNumberFormatted}
                    </p>
                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                        <span>{duration}</span>
                        <span className="mx-2">&bull;</span>
                        <span>{endTime}</span>
                    </div>
                </div>
                {c.recording_url && (
                    <AudioPlayer src={c.recording_url} type="Recording" />
                )}
            </div>
        </div>
    );
  };

  const CardContent = () => {
    const mainPageContactName = otherParty.name;
    const mainPageContactNumber = otherParty.number;
    const mainPageAvatarInitial = otherParty.initial;

    if (isClickable) {
       const from = encodeURIComponent(comm.direction === 'inbound' ? comm.to : comm.from);
       const to = encodeURIComponent(comm.direction === 'inbound' ? comm.from : comm.to);
       const queryString = source === 'unread' ? `?source=unread` : '';
  
       const callInfo = (comm.latest_type === 'call' || comm.type === 'sms')
        ? `${comm.direction === 'inbound' ? 'Inbound' : 'Outbound'} / ${comm.duration || '0'} seconds` 
        : (comm.direction || '') + ' / ' + (comm.body || '');

       return (
            <div className="flex items-center p-4 gap-4 hover:bg-muted/50 group border-b">
                <Link href={`/conversations/${from}/${to}${queryString}`} className="flex-1 flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                        <AvatarFallback>
                            {contact ? mainPageAvatarInitial : <User className="h-5 w-5 text-muted-foreground" />}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 grid grid-cols-3 items-center gap-4">
                        <p className={cn("font-semibold truncate", !comm.is_read && "font-bold")}>{mainPageContactName}</p>
                         <p className={cn("text-sm text-muted-foreground truncate", !comm.is_read && "text-foreground")}>
                           {callInfo}
                        </p>
                    </div>
                </Link>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                         <Button variant="outline" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <PhoneIcon className="h-4 w-4" />
                            <ChevronDown className="h-4 w-4 ml-1" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onMakeCall(mainPageContactNumber)}>
                            Call {mainPageContactNumber}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
       )
    }

    return (
        <div className={cn("flex items-start gap-3", isMine ? "justify-end" : "justify-start", !isFirstInGroup && "py-0.5", isFirstInGroup && "pt-2")}>
            {showAvatar && (
                <Avatar className="h-8 w-8">
                    <AvatarFallback>
                        {contact ? contactInitial : <User className="h-4 w-4 text-muted-foreground" />}
                    </AvatarFallback>
                </Avatar>
            )}
            {!showAvatar && !isMine && <div className="w-8" />}

            <div className={cn("flex flex-col gap-1 w-full", isMine ? 'items-end' : 'items-start')}>
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
  if (!communications || communications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-48 border-2 border-dashed rounded-lg m-6 p-4">
        <p className="text-lg font-medium">No activity yet</p>
        <p>Your history will appear here.</p>
      </div>
    );
  }

  const generateKey = (comm: Communication, index: number): string => {
    return `${comm.id || ''}-${comm.type || ''}-${comm.call_sid || ''}-${comm.created_at || ''}-${index}`;
  };

  if(isClickable) {
    return (
        <div className="space-y-1">
            {communications.map((comm, index) => (
                <CommunicationCard
                    comm={comm}
                    contacts={contacts}
                    key={generateKey(comm, index)}
                    onMakeCall={onMakeCall}
                    isClickable={isClickable}
                    source={source}
                    isFirstInGroup={true}
                    isLastInGroup={true}
                    isMiddleOfGroup={false}
                />
            ))}
        </div>
    )
  }
  
  const groupedByDay = communications
    .filter(comm => comm.created_at)
    .reduce((acc, comm) => {
      const date = format(parseISO(comm.created_at), 'yyyy-MM-dd');
      if (!acc[date]) {
          acc[date] = [];
      }
      acc[date].push(comm);
      return acc;
    }, {} as Record<string, Communication[]>);

  return (
    <div className="p-4 space-y-4">
      {Object.entries(groupedByDay).map(([date, commsForDay]) => (
        <div key={date}>
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm flex items-center justify-center my-2">
                <div className="text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                    {format(parseISO(date), 'EEEE, d MMM yyyy')}
                </div>
            </div>
             <div className="space-y-0">
                {commsForDay.map((comm, index) => {
                    const prevComm = index > 0 ? commsForDay[index - 1] : null;
                    const nextComm = index < commsForDay.length - 1 ? commsForDay[index + 1] : null;

                    const isSameSenderAsPrev = prevComm && prevComm.direction === comm.direction;
                    const isSameSenderAsNext = nextComm && nextComm.direction === comm.direction;

                    const isFirstInGroup = !isSameSenderAsPrev;
                    const isLastInGroup = !isSameSenderAsNext;
                    const isMiddleOfGroup = isSameSenderAsPrev && isSameSenderAsNext;

                    return (
                        <CommunicationCard 
                            comm={comm} 
                            contacts={contacts}
                            key={generateKey(comm, index)}
                            onMakeCall={onMakeCall} 
                            isClickable={isClickable} 
                            source={source}
                            isFirstInGroup={isFirstInGroup}
                            isLastInGroup={isLastInGroup}
                            isMiddleOfGroup={isMiddleOfGroup}
                        />
                    )
                })}
             </div>
        </div>
      ))}
    </div>
  );
}
