

import type { Communication, Contact } from '@/types';
import { PhoneIncoming, PhoneOutgoing, Phone as PhoneIcon, Ear, Mic, Info, Loader2, MessageSquare, Video, Share2, ExternalLink, MoreHorizontal, ArrowUpRight, ChevronDown, User, Star, FileText } from 'lucide-react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import Link from 'next/link';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { useAuth } from '@/context/AuthContext';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';
import { addParticipant } from '@/services/twilioService';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { markCommunicationField, markRead, saveTranscription } from '@/services/callLogService';
import { events } from '@/lib/events';
import React from 'react';
import { cn, formatPhoneNumber } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import AudioPlayer from './AudioPlayer';
import { getTranscriptionForAudio } from '@/app/actions';


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
    source 
}: { 
    comm: Communication, 
    contacts?: Contact[],
    onMakeCall: (number: string) => void, 
    isClickable: boolean, 
    source?: string 
}) {
  const { user } = useAuth();
  const isAdmin = user?.role_id === 1 || user?.role_id === 2;
  const { toast } = useToast();
  const [isTogglingStar, setIsTogglingStar] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [isRead, setIsRead] = React.useState(!!comm.is_read);
  const [isTranscribing, setIsTranscribing] = React.useState(false);

  React.useEffect(() => {
    setIsRead(!!comm.is_read);
  }, [comm.is_read, comm.id]);

  React.useEffect(() => {
    if (!cardRef.current || isRead || isClickable) {
        return;
    }

    const observer = new IntersectionObserver(
        ([entry]) => {
            if (entry.isIntersecting) {
                if (comm.id && comm.type) {
                  setIsRead(true);
                  markRead(String(comm.id), comm.type)
                    .then(() => {
                      try { events.emit('refreshDepartmentsUnread'); } catch(_) {}
                    })
                    .catch(() => setIsRead(false)); // revert on failure
                }
                observer.disconnect();
            }
        },
        { threshold: 0.5 }
    );
    
    observer.observe(cardRef.current);

    return () => {
        observer.disconnect();
    };
  }, [comm.id, comm.type, isRead, isClickable]);

  const handleToggleStar = async () => {
    if (!comm?.id) return;
    const next = !comm.is_starred;
    setIsTogglingStar(true);
    try {
      await markCommunicationField(comm.id, comm.type, 'is_starred', next);
      toast({ title: 'Success', description: `Communication ${next ? 'starred' : 'unstarred'}.` });
      events.emit('refreshCalls');
    } catch (e) {
      toast({ title: 'Failed', description: 'Could not update star. Try again.', variant: 'destructive' });
    } finally {
      setIsTogglingStar(false);
    }
  };

  const handleTranscribe = async (audioUrl: string) => {
    if (!comm.id) return;
    setIsTranscribing(true);
    try {
      const result = await getTranscriptionForAudio(audioUrl, comm.id);
      if(result.transcription) {
        await saveTranscription(comm.id, result.transcription);
        toast({ title: "Transcription successful" });
        events.emit('refreshCalls');
      } else {
        throw new Error(result.error || "Unknown error");
      }
    } catch(e: any) {
      toast({ title: "Transcription Failed", description: e.message || "Could not transcribe audio.", variant: "destructive"});
    } finally {
      setIsTranscribing(false);
    }
  }

  const getInitials = (name: string) => {
    if (!name) return '?';
    const nameParts = name.split(' ').filter(Boolean);
    if (nameParts.length > 1) {
      return `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

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

  const findContact = (phone: string) => {
    if (!contacts || contacts.length === 0) return null;
    return contacts.find(c => c.phone_no === phone);
  };
  
  const otherPartyNumber = comm.direction === 'outbound' ? comm.to : comm.from;
  const contact = findContact(otherPartyNumber);
  
  const otherParty = {
      name: contact?.name || formatPhoneNumber(otherPartyNumber),
      number: otherPartyNumber,
      initial: getInitials(contact?.name || otherPartyNumber)
  };
  
  const contactName = comm.direction === 'outbound' ? (user?.name || 'Me') : otherParty.name;
  const contactInitial = getInitials(comm.direction === 'outbound' ? (user?.name || 'Me') : otherParty.name);
  const isMissed = comm.call_status === 'missed' || comm.call_status === 'no-answer' || comm.call_status === 'busy' || comm.call_status === 'canceled';
  const isInProgress = comm.call_status === 'in_progress';

  const CardContent = () => {
    const mainPageContactName = otherParty.name;
    const mainPageContactNumber = otherParty.number;
    const mainPageAvatarInitial = otherParty.initial;

    if (isClickable) {
       const from = encodeURIComponent(comm.direction === 'inbound' ? comm.to : comm.from);
       const to = encodeURIComponent(comm.direction === 'inbound' ? comm.from : comm.to);
       const queryString = source === 'unread' ? `?source=unread` : '';
  
       const getCallInfo = () => {
        if (comm.type === 'sms' || comm.latest_type === 'sms') {
          return (
            <div className="flex items-center gap-1">
              {comm.direction === 'inbound' ? <PhoneIncoming className="h-4 w-4 text-green-500" /> : <PhoneOutgoing className="h-4 w-4 text-blue-500" />}
              {comm.body}
            </div>
          );
        }
        if (comm.type === 'call' || comm.latest_type === 'call') {
          return (
            <div className="flex items-center gap-1">
              {comm.direction === 'inbound' ? <PhoneIncoming className="h-4 w-4 text-green-500" /> : <PhoneOutgoing className="h-4 w-4 text-blue-500" />}
              {comm.duration || '0'} seconds
            </div>
          );
        }
        return `${comm.direction || ''} / ${comm.body || ''}`;
      };

      return (
           <div className="flex items-center p-2 hover:bg-muted/50 group border-b">
                <Link href={`/conversations/${from}/${to}${queryString}`} key={comm.id || `${comm.from}-${comm.to}`} className="flex-1 flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                        <AvatarFallback>
                            {contact ? mainPageAvatarInitial : <User className="h-5 w-5 text-muted-foreground" />}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                        <p className={cn("font-semibold truncate", !comm.is_read && "font-bold")}>{mainPageContactName}</p>
                        <div className={cn("text-sm text-muted-foreground truncate", !comm.is_read && "text-foreground")}>
                          {getCallInfo()}
                        </div>
                    </div>
                </Link>
                {(isInProgress && isClickable) && (
                  <div className="flex items-center gap-2">
                    <span className="flex h-3 w-3 shrink-0">
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>

                    {isAdmin && (
                      <>
                        <Button variant="outline" size="sm" onClick={(e) => handleJoinCall(e, { silent: true })}>
                          <Ear className="mr-2 h-4 w-4" />
                          Silently Listen
                        </Button>
                        <Button variant="outline" size="sm" onClick={(e) => handleJoinCall(e, { silent: false })}>
                          <Mic className="mr-2 h-4 w-4" />
                          Barge In
                        </Button>
                      </>
                    )}
                  </div>
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                         <Button variant="outline" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <PhoneIcon className="h-4 w-4" />
                            <ChevronDown className="h-4 w-4 ml-1" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onMakeCall(mainPageContactNumber)}>
                            Call {formatPhoneNumber(mainPageContactNumber)}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
       )
    }

    return (
        <div ref={cardRef} data-is-read={isRead ? '1' : '0'} className="flex items-start gap-4 p-4 border-b">
            <Avatar className="h-10 w-10">
                <AvatarFallback>
                    {contact ? contactInitial : <User className="h-5 w-5 text-muted-foreground" />}
                </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                    <div className="font-semibold">{contactName}</div>
                    <div className="text-xs text-muted-foreground">
                        {comm.created_at ? format(parseISO(comm.created_at), 'p') : ''}
                    </div>
                </div>
                {comm.type === 'sms' && <p className="text-sm text-muted-foreground">{comm.body}</p>}
                {comm.type === 'call' && (
                  <div className="text-sm flex items-center gap-2">
                    {comm.direction === 'inbound' ? <PhoneIncoming className={cn("h-4 w-4", isMissed ? "text-destructive" : "text-muted-foreground")} /> : <PhoneOutgoing className={cn("h-4 w-4", isMissed ? "text-destructive" : "text-muted-foreground")} />}
                    <span>{comm.duration ? `${comm.duration} seconds` : (isMissed ? 'Missed call' : 'Unanswered')}</span>
                  </div>
                )}
                 {isTranscribing && <p className="text-xs text-muted-foreground mt-2">Transcribing...</p>}
                 {comm.transcribe_text && <blockquote className="mt-2 pl-3 border-l-2 text-xs">{comm.transcribe_text}</blockquote>}
                {comm.category && <Badge variant="secondary" className="mt-2">{comm.category}</Badge>}
            </div>
            <div className="flex items-center gap-1 self-start">
               {comm.recording_url && (
                    <div className="flex items-center gap-1">
                        <AudioPlayer src={comm.recording_url} type="Recording"/>
                        <Button size="icon" variant="ghost" onClick={() => handleTranscribe(comm.recording_url!)} disabled={isTranscribing} title="Transcribe">
                            {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin"/> : <FileText className="h-4 w-4" />}
                        </Button>
                    </div>
                )}
                {comm.voice_mail && (
                     <div className="flex items-center gap-1">
                        <AudioPlayer src={comm.voice_mail} type="Voicemail"/>
                        <Button size="icon" variant="ghost" onClick={() => handleTranscribe(comm.voice_mail!)} disabled={isTranscribing} title="Transcribe">
                            {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin"/> : <FileText className="h-4 w-4" />}
                        </Button>
                    </div>
                )}
                {isClickable && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-1">
                           <DropdownMenuItem onClick={() => onMakeCall(otherParty.number)}>Call {otherParty.name}</DropdownMenuItem>
                        </PopoverContent>
                    </Popover>
                )}
                 <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleStar(); }}
                    disabled={isTogglingStar}
                    aria-label={comm.is_starred ? 'Unstar' : 'Star'}
                    aria-pressed={!!comm.is_starred}
                >
                    {isTogglingStar ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Star className={cn("h-4 w-4", comm.is_starred ? "text-yellow-500" : "text-muted-foreground")} fill={comm.is_starred ? 'currentColor' : 'none'} />
                    )}
                </Button>
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

  const generateKey = (comm: Communication, index: number): string => {
    return `${comm.id || ''}-${comm.type || ''}-${comm.call_sid || ''}-${comm.created_at || ''}-${index}`;
  };

  return (
    <div className="p-4 space-y-4">
      {Object.entries(groupedByDay).map(([date, commsForDay]) => (
        <div key={date}>
          <div className="flex items-center justify-center my-2">
              <div className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  {format(parseISO(date), 'EEEE, d MMM yyyy')}
              </div>
          </div>
          {commsForDay.map((comm, index) => (
            <CommunicationCard 
                comm={comm} 
                contacts={contacts}
                key={generateKey(comm, index)} 
                onMakeCall={onMakeCall} 
                isClickable={isClickable} 
                source={source} 
            />
          ))}
        </div>
      ))}
    </div>
  );
}
