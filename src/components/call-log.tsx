
import type { Communication, User } from '@/types';
import { PhoneIncoming, PhoneOutgoing, Phone as PhoneIcon, Ear, Mic, Info, Loader2, MessageSquare, Play, Pause } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { useAuth } from '@/context/AuthContext';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';
import { addParticipant } from '@/services/twilioService';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import React from 'react';

interface CallLogProps {
  calls: Communication[];
  onMakeCall: (number: string) => void;
  isClickable?: boolean;
}

function CommunicationCard({ comm, onMakeCall, isClickable }: { comm: Communication, onMakeCall: (number: string) => void, isClickable: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role_id === 1 || user?.role_id === 2;

  const contactName = comm.direction === 'inbound' 
                        ? (comm.from_name?.name || comm.user?.name || comm.from) 
                        : (comm.to_name?.name || comm.user?.name || comm.to);
                        
  const contactInitial = contactName ? contactName.charAt(0).toUpperCase() : '?';

  const isMissed = comm.call_status === 'missed' || comm.call_status === 'no-answer' || comm.call_status === 'busy' || comm.call_status === 'canceled';
  const isInProgress = comm.call_status === 'in_progress';
  const hasRecording = !!comm.recording_url;
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  
  const cardBg = isInProgress
    ? 'bg-orange-300 border-orange-300 dark:bg-orange-950/20 dark:border-orange-800'
    : isMissed
    ? 'bg-red-50 dark:bg-red-950/20'
    : 'bg-background';

  const contactDisplayNumber = comm.direction === 'inbound' ? comm.from : comm.to;
  
  const handleCallClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onMakeCall(contactDisplayNumber);
  }

    const togglePlay = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (audioRef.current) {
          if (isPlaying) {
              audioRef.current.pause();
          } else {
              audioRef.current.play();
          }
      }
  };

  React.useEffect(() => {
    const audioElement = audioRef.current;
    if (audioElement) {
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleEnded = () => setIsPlaying(false);

        audioElement.addEventListener('play', handlePlay);
        audioElement.addEventListener('pause', handlePause);
        audioElement.addEventListener('ended', handleEnded);

        return () => {
            audioElement.removeEventListener('play', handlePlay);
            audioElement.removeEventListener('pause', handlePause);
            audioElement.removeEventListener('ended', handleEnded);
        };
    }
  }, [audioRef]);
  
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


  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    switch (status) {
        case 'completed': return <Badge variant="default">Completed</Badge>;
        case 'in_progress':
        return (
          <Badge className="bg-orange-600 text-white font-semibold flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            In Progress
          </Badge>
        );
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
  
  const hasAssignments = Array.isArray(comm.task_assignments) && comm.task_assignments.length > 0;

  const renderIcon = () => {
    const type = comm.latest_type || comm.type;
    if (type === 'sms') {
      return <MessageSquare className="h-4 w-4" />;
    }
    return comm.direction === 'inbound' ? <PhoneIncoming className="h-4 w-4" /> : <PhoneOutgoing className="h-4 w-4" />;
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
                       {renderIcon()}
                       <span>{(comm.latest_type || comm.type || '').charAt(0).toUpperCase() + (comm.latest_type || comm.type || '').slice(1)}</span>
                       {comm.type === 'call' && getStatusBadge(comm.call_status)}
                       {comm.type === 'call' && comm.duration && <span>({comm.duration} min)</span>}
                  </div>
                   <div className="flex items-center">
                        {hasAssignments && !isClickable && (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <Info className="h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80">
                                    <div className="grid gap-1">
                                        <div className="space-y-1">
                                            <h4 className="font-medium leading-none">Task Assignments</h4>
                                            <p className="text-sm text-muted-foreground">
                                                Status of assigned workers for this call.
                                            </p>
                                        </div>
                                        <div className="grid gap-1">
                                            {comm.task_assignments?.map((assignment: any) => (
                                                <div key={assignment.worker_sid} className="flex items-center justify-between">
                                                    <span>{assignment.user?.name || assignment.worker_name || 'Unknown Worker'}</span>
                                                    <Badge variant={assignment.status === 'completed' ? 'default' : 'destructive'}>{assignment.status}</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}
                        <Button variant="ghost" size="icon" onClick={handleCallClick}>
                            <PhoneIcon className="h-4 w-4" />
                        </Button>
                   </div>
                </div>
                <div className="text-sm mt-2 space-y-1 text-muted-foreground">
                    <p className="text-foreground"><strong>From:</strong> {comm.from_name?.name || comm.from}</p>
                    <p><strong>To:</strong> {comm.to_name?.name || comm.to}</p>
                    {comm.type === 'sms' && <p className="pt-2 text-foreground">{comm.body}</p>}
                </div>
                 {isInProgress && isAdmin && (
                    <div className="mt-4 flex gap-2 border-t pt-2">
                        <Button variant="outline" size="sm" onClick={(e) => handleJoinCall(e, { silent: true, coach: true })}>
                            <Ear className="mr-2 h-4 w-4" />
                            Silently Listen
                        </Button>
                        <Button variant="outline" size="sm" onClick={(e) => handleJoinCall(e, { silent: true, coach: false })}>
                            <Mic className="mr-2 h-4 w-4" />
                            Barge In
                        </Button>
                    </div>
                 )}
                 {hasRecording && (
                    <div className="mt-2 flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={togglePlay}>
                            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <audio ref={audioRef} src={comm.recording_url} className="hidden" preload="none" />
                        <span className="text-xs text-muted-foreground">Play Recording</span>
                    </div>
                )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{format(parseISO(comm.created_at || comm.latest_created_at!), 'p')}</p>
        </div>
    </div>
  );

  if (isClickable) {
    const from = encodeURIComponent(comm.from);
    const to = encodeURIComponent(comm.to);
    return (
        <Link href={`/conversations/${from}/${to}`} key={comm.id || `${comm.from}-${comm.to}`} className="block">
            <CardContent />
        </Link>
    );
  }

  return <CardContent />;
}

export default function CallLog({ calls: communications, onMakeCall, isClickable = true }: CallLogProps) {
  if (communications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-48 border-2 border-dashed rounded-lg">
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
    <div className="space-y-6">
      {Object.entries(groupedCommunications).map(([date, commsForDay]) => (
        <div key={date}>
            <div className="flex items-center justify-center my-4">
                <div className="text-xs text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                    {format(parseISO(date), 'EEEE, d MMM yyyy')}
                </div>
            </div>
             <div className="space-y-4">
                {commsForDay.map((comm) => (
                    <CommunicationCard comm={comm} key={comm.id || `${comm.from}-${comm.to}`} onMakeCall={onMakeCall} isClickable={isClickable} />
                ))}
             </div>
        </div>
      ))}
    </div>
  );
}
