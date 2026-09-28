

import type { Communication, Contact, User as AppUser, PhoneNumber } from '@/types';
import { PhoneIncoming, PhoneOutgoing, Phone as PhoneIcon, Ear, Mic, Info, Loader2, MessageSquare, Video, Share2, ExternalLink, MoreHorizontal, ArrowUpRight, ChevronDown, User as UserIcon, Star, FileText } from 'lucide-react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { useAuth } from '@/context/AuthContext';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';
import { addParticipant } from '@/services/twilioService';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { markCommunicationField, markRead, setActivityReadState, updateActivityFollowUp } from '@/services/callLogService';
import { events } from '@/lib/events';
import React from 'react';
import { cn, formatPhoneNumber, getContactAvatarColorClass } from '@/lib/utils';
import { hasSupervisorAccess } from '@/lib/roles';
import {
  getCommunicationMediaContentTypes,
  getCommunicationMediaUrls,
  getMessagePreviewText,
  isAudioMediaUrl,
  isImageMediaUrl,
  isInlineImageBody,
  isVideoMediaUrl,
} from '@/lib/message-media';
import { getOtherPartyDisplay } from '@/lib/contact-display';
import {
  getCallAttendeeName,
  getCallAttendeeUser,
  formatCallTypeDurationLine,
  formatListingTimestamp,
  isCallThread,
  isMissedCall,
  isHungUpCall,
  isFailedCallRow,
} from '@/lib/call-attendee';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import AudioPlayer from './AudioPlayer';
import { getTranscriptionForAudio } from '@/app/actions';
import { saveTranscription } from '@/services/callLogService';
import {
  resolveOutboundContextFromCommunication,
  type OutboundContext,
} from '@/lib/outbound-context';
import { activityToneClass, followUpLabel, getActivityPresentation } from '@/lib/activity-display';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

function parseRecordingDurationSeconds(
  ...values: (string | undefined | null)[]
): number | undefined {
  for (const value of values) {
    if (!value) continue;
    const parsed = parseInt(String(value).replace(/\D/g, ''), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return undefined;
}

interface CallLogProps {
  calls: Communication[];
  contacts?: Contact[];
  companyUsers?: AppUser[];
  phoneNumbers?: PhoneNumber[];
  fallbackDepartmentId?: string;
  onMakeCall: (number: string, context?: OutboundContext) => void;
  isClickable?: boolean;
  onCommunicationSelect?: (comm: Communication) => void;
  source?: string;
  highlightFailedCalls?: boolean;
  showDepartment?: boolean;
}

function CommunicationCard({ 
    comm, 
    contacts,
    companyUsers,
    phoneNumbers,
    fallbackDepartmentId,
    onMakeCall, 
    isClickable,
    onCommunicationSelect,
    source,
    highlightFailedCalls,
    showDepartment,
    isFirstInGroup,
    isLastInGroup,
    isMiddleOfGroup
}: { 
    comm: Communication, 
    contacts?: Contact[],
    companyUsers?: AppUser[],
    phoneNumbers?: PhoneNumber[],
    fallbackDepartmentId?: string,
    onMakeCall: (number: string, context?: OutboundContext) => void, 
    isClickable: boolean,
    onCommunicationSelect?: (comm: Communication) => void,
    source?: string,
    highlightFailedCalls?: boolean,
    showDepartment?: boolean,
    isFirstInGroup: boolean,
    isLastInGroup: boolean,
    isMiddleOfGroup: boolean | null
}) {
  const { user } = useAuth();
  const isAdmin = hasSupervisorAccess(user?.role_id);
  const { toast } = useToast();
  const [isTogglingStar, setIsTogglingStar] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [isRead, setIsRead] = React.useState(!!comm.is_read);
  const [isTranscribing, setIsTranscribing] = React.useState(false);
  const [transcrib, setTranscrib] = React.useState('');
  const [showTranscript, setShowTranscript] = React.useState(false);


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
                      try { events.emitDebounced('refreshDepartmentsUnread', 2500); } catch(_) {}
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
        setTranscrib(result.transcription)
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

  const handleTranscribeClick = (audioUrl: string) => {
    if (!comm.transcribe_text && !transcrib) {
      handleTranscribe(audioUrl);
    } else {
      setShowTranscript(prev => !prev);
    }
  };

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

  const isMine = comm.direction === 'outbound';

  const findContact = (phone: string) => {
    if (!contacts || contacts.length === 0) return null;
    return contacts.find(c => c.phone_no === phone);
  };
  
  const otherPartyNumber = isMine ? comm.to : comm.from;
  const contact = findContact(otherPartyNumber);
  const otherParty = getOtherPartyDisplay(comm, contact);
  const contactName = isFirstInGroup ? (isMine ? (comm.user?.name || 'Me') : otherParty.displayName) : '';
  const contactInitial = getInitials(isMine ? (user?.name || 'Me') : (otherParty.displayName || otherParty.number));
  const isMissed = isMissedCall(comm);
  const isHungUp = isHungUpCall(comm);
  const isFailedCall = highlightFailedCalls && isFailedCallRow(comm);
  const isInProgress = comm.call_status === 'in_progress';

  const showAvatar = !isMine && isFirstInGroup;

  const renderMediaAttachment = (url: string, contentType?: string) => {
    if (isImageMediaUrl(url, contentType)) {
      return (
        <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
          <img
            src={url}
            alt="MMS attachment"
            className="max-h-56 max-w-xs rounded-md object-cover"
          />
        </a>
      );
    }

    if (isVideoMediaUrl(url, contentType)) {
      return (
        <video
          key={url}
          src={url}
          controls
          className="max-h-56 max-w-xs rounded-md"
          preload="metadata"
        />
      );
    }

    if (isAudioMediaUrl(url, contentType)) {
      return <audio key={url} src={url} controls className="w-full max-w-xs" preload="metadata" />;
    }

    return (
      <a
        key={url}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-sm underline underline-offset-2"
      >
        Download attachment
      </a>
    );
  };

  const handleCommunicationActivate = () => {
    onCommunicationSelect?.(comm);
  };

  const selectableBubbleProps = onCommunicationSelect && !isClickable
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick: handleCommunicationActivate,
        onKeyDown: (event: React.KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          handleCommunicationActivate();
        },
        className: 'cursor-pointer transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      }
    : {};

  const wrapSelectableBubble = (node: React.ReactNode) => {
    const wrapperClass = 'min-w-0 max-w-full';
    if (!onCommunicationSelect || isClickable) {
      return <div className={wrapperClass}>{node}</div>;
    }
    return (
      <div {...selectableBubbleProps} className={cn(selectableBubbleProps.className, wrapperClass)}>
        {node}
      </div>
    );
  };

  const renderMessageBubble = (c: Communication) => {
    const time = c.created_at ? format(parseISO(c.created_at), 'p') : '';
    const mediaUrls = getCommunicationMediaUrls(c);
    const contentTypes = getCommunicationMediaContentTypes(c);
    const showBody = Boolean(c.body?.trim()) && !isInlineImageBody(c.body) && !mediaUrls.includes(String(c.body).trim());
    const isUnreadSms = c.type === 'sms' && c.direction === 'inbound' && Number(c.is_read) === 0;

    return (
        <div className={cn(
            "p-3 group relative space-y-2 min-w-0 w-full max-w-full overflow-hidden box-border",
            isUnreadSms
            ? "bg-red-100 border border-red-200"
            : isMine ? "bg-primary text-primary-foreground" : "bg-muted",
            isFirstInGroup && (isMine ? "rounded-t-xl rounded-l-xl" : "rounded-t-xl rounded-r-xl"),
            isLastInGroup && !isFirstInGroup && (isMine ? "rounded-b-xl rounded-l-xl" : "rounded-b-xl rounded-r-xl"),
            isMiddleOfGroup && (isMine ? "rounded-l-xl" : "rounded-r-xl"),
            !isFirstInGroup && !isLastInGroup && !isMiddleOfGroup && "rounded-xl"
        )}>
            {mediaUrls.length > 0 && (
              <div className="flex flex-col gap-2">
                {mediaUrls.map((url, index) => renderMediaAttachment(url, contentTypes[index]))}
              </div>
            )}
            {showBody && (
              <p className="text-sm whitespace-pre-wrap break-all min-w-0 w-full [overflow-wrap:anywhere]">
                {c.body}
              </p>
            )}
            <div className={cn(
                "text-xs transition-opacity",
                c.status === 'scheduled' ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                isMine ? "text-primary-foreground/70" : "text-muted-foreground/70"
            )}>
                {c.status === 'scheduled' && c.scheduled_at
                  ? `Scheduled ${format(parseISO(c.scheduled_at), 'PPp')}`
                  : time}
            </div>
        </div>
    );
  };


  const renderCallBubble = (c: Communication) => {
    let title: React.ReactNode;

    const attendeeName = getCallAttendeeName(c, companyUsers);
    if (attendeeName) {
        if (isMine) {
            title = <>{attendeeName} called {otherParty.displayName}</>;
        } else {
            title = <>{otherParty.displayName} called <span className="font-normal text-muted-foreground">(received by {attendeeName})</span></>;
        }
    } else {
        title = isMine ? `You called ${otherParty.displayName}` : `${otherParty.displayName} called you`;
    }
    
    const Icon = isMine ? PhoneOutgoing : PhoneIncoming;

    const fromNumberFormatted = formatPhoneNumber(c.from);
    const toNumberFormatted = formatPhoneNumber(c.to);
    
    const duration = c.duration ? `${c.duration} seconds` : 'Unanswered';
    const endTime = c.created_at ? format(parseISO(c.created_at), 'p') : '';

    return (
        <div className={cn("flex items-start gap-3 p-3 rounded-lg w-full", isMine ? "bg-primary/10" : "bg-muted")}>
            <Icon className={cn("h-5 w-5 mt-1", (isMissed || isHungUp) ? "text-destructive" : "text-muted-foreground")} />
            <div className="flex-1 flex items-center justify-between text-sm space-y-1">
                <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{title}</p>
                        {comm.department?.name && (
                          <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                            {comm.department.name}
                          </Badge>
                        )}
                    </div>
                     {isInProgress ? (
                        <p className="flex items-center gap-2 text-xs text-green-600 font-semibold">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            Live Call
                        </p>
                    ) : (
                      <>
                        <p className="text-muted-foreground text-xs">
                            {c.direction === 'inbound' ? 'Other' : 'Voice'} {fromNumberFormatted} &rarr; {c.direction === 'inbound' ? 'Voice' : 'Other'} {toNumberFormatted}
                        </p>
                        <div className="flex items-center text-xs text-muted-foreground mt-1">
                            <span>{duration}</span>
                            <span className="mx-2">&bull;</span>
                            <span>{endTime}</span>
                        </div>
                        {c.classification?.label && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-sky-50 px-2 py-1 text-[10px] font-medium text-sky-900">
                              {c.classification.label}
                            </span>
                            {c.classification.note && (
                              <span className="text-xs text-muted-foreground">
                                Note: {c.classification.note}
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                    {isTranscribing && <p className="text-xs text-muted-foreground mt-2">Transcribing...</p>}
                    {(comm.transcribe_text || transcrib) && showTranscript && (
                      <blockquote className="mt-2 pl-3 border-l-2 text-xs">
                        {comm.transcribe_text || transcrib}
                      </blockquote>
                    )}
                </div>
                {isInProgress && isAdmin && !isClickable && (
                  <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={(e) => handleJoinCall(e, { silent: true })}>
                          <Ear className="mr-2 h-4 w-4" />
                          Listen
                      </Button>
                      <Button variant="outline" size="sm" onClick={(e) => handleJoinCall(e, { silent: false })}>
                          <Mic className="mr-2 h-4 w-4" />
                          Barge
                      </Button>
                  </div>
                )}
                {c.recording_url && (
                  <div className="flex items-center gap-2">
                    <AudioPlayer
                      src={c.recording_url}
                      type="Recording"
                      durationHint={parseRecordingDurationSeconds(c.call_duration, c.duration)}
                    />
                    <Button size="icon" variant="ghost" onClick={() => handleTranscribeClick(c.recording_url!)} disabled={isTranscribing} title="Transcribe">
                      {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin"/> : <FileText className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
                {c.voice_mail && (
                  <div className="flex items-center gap-2">
                    <AudioPlayer
                      src={c.voice_mail}
                      type="Voicemail"
                      durationHint={parseRecordingDurationSeconds(c.call_duration, c.duration)}
                    />
                    <Button size="icon" variant="ghost" onClick={() => handleTranscribeClick(c.voice_mail!)} disabled={isTranscribing} title="Transcribe">
                     {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin"/> : <FileText className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
            </div>
        </div>
    );
  };

  const CardContent = () => {
    const mainPageContactName = otherParty.displayName;
    const mainPageContactSublabel = otherParty.sublabel;
    const mainPageContactNumber = otherParty.number;
    const mainPageAvatarInitial = otherParty.initial;

    if (isClickable) {
       const from = encodeURIComponent(comm.direction === 'inbound' ? comm.to : comm.from);
       const to = encodeURIComponent(comm.direction === 'inbound' ? comm.from : comm.to);
       const queryString = source === 'unread' ? `?source=unread` : '';
       const isSms = comm.type === 'sms' || comm.latest_type === 'sms';
       const attendee = isCallThread(comm) ? getCallAttendeeUser(comm, companyUsers) : null;
       const attendeeInitials = attendee?.name ? getInitials(attendee.name) : '';
       const listingTime = formatListingTimestamp(comm.latest_created_at || comm.created_at);
       const callTypeLine = isSms
         ? (getMessagePreviewText(comm) || formatCallTypeDurationLine(comm))
         : formatCallTypeDurationLine(comm);
       const failedCallLabel = isHungUp ? 'Hung up' : isMissed ? 'Missed' : null;
       const contactColorClass = getContactAvatarColorClass(
         otherParty.hasContactName ? mainPageContactName : mainPageContactNumber
       );
       const isUnread = Number(comm.is_read) === 0 && comm.direction === 'inbound';
       const activity = getActivityPresentation(comm);
       const departmentLabel = comm.department?.name || comm.department_name;
       const followUp = followUpLabel(comm.follow_up?.status);
       const agentName = comm.user_name || attendee?.name || null;
       const systemAgent = Boolean((comm.meta_data as { automated?: boolean; system?: boolean } | null)?.automated
         || (comm.meta_data as { system?: boolean } | null)?.system);
       const departmentQuery = comm.department_id ? `${queryString ? '&' : '?'}departmentId=${comm.department_id}` : '';

      return (
           <div
             className={cn(
               'flex items-center gap-3 px-4 py-3 group transition-colors',
               isUnread
                ? 'bg-[#6D28D9]/10 hover:bg-[#6D28D9]/15'
                : 'hover:bg-muted/40'
             )}
           >
                <Link
                  href={`/conversations/${from}/${to}${queryString}${departmentQuery}`}
                  key={comm.id || `${comm.from}-${comm.to}-${comm.department_id || ''}`}
                  className={cn(
                    'grid flex-1 items-center gap-x-4 min-w-0',
                    showDepartment
                      ? 'grid-cols-[36px_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_88px]'
                      : 'grid-cols-[36px_minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_88px]'
                  )}
                >
                    <Avatar className="h-9 w-9">
                        <AvatarFallback
                          className={cn(
                            'text-xs font-medium',
                            otherParty.hasContactName || contact
                                ? contactColorClass
                                : 'bg-muted text-muted-foreground'
                          )}
                        >
                            {otherParty.hasContactName || contact ? mainPageAvatarInitial : <UserIcon className="h-4 w-4" />}
                        </AvatarFallback>
                    </Avatar>

                    <div className="flex min-w-0 flex-col">
                      <span
                        className={cn(
                          'truncate text-sm text-foreground',
                          isUnread ? 'font-bold' : 'font-medium'
                        )}
                      >
                        {mainPageContactName}
                      </span>
                      {mainPageContactSublabel && (
                        <span className="truncate text-xs text-muted-foreground">
                          {mainPageContactSublabel}
                        </span>
                      )}
                    </div>

                    <div className="flex min-w-0 items-center gap-2">
                      <span className={cn('inline-flex max-w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium', activityToneClass(activity.tone))}>
                        {activity.icon === 'message' ? <MessageSquare className="h-3.5 w-3.5 shrink-0" /> : activity.icon === 'voicemail' ? <FileText className="h-3.5 w-3.5 shrink-0" /> : <PhoneIcon className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate">{activity.label}</span>
                      </span>
                      {comm.classification?.label && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="shrink-0 rounded-md bg-sky-50 px-2 py-1 text-[10px] font-medium text-sky-900">
                                {comm.classification.label}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {comm.classification.note
                                ? `Note: ${comm.classification.note}`
                                : `Classified as ${comm.classification.label}${comm.classification.user_name ? ` by ${comm.classification.user_name}` : ''}`}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {followUp && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={cn(
                                'shrink-0 rounded-md px-2 py-1 text-[10px] font-medium',
                                comm.follow_up?.status === 'completed' ? 'bg-green-50 text-[#166534]' : 'bg-amber-50 text-[#92400E]'
                              )}>
                                {followUp}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {comm.follow_up?.status === 'completed'
                                ? `Completed${comm.follow_up.completed_by ? ` by ${comm.follow_up.completed_by}` : ''}${comm.follow_up.completed_at ? ` at ${comm.follow_up.completed_at}` : ''}${comm.follow_up.note ? `. ${comm.follow_up.note}` : ''}`
                                : comm.follow_up?.status === 'in_progress'
                                  ? `Claimed${comm.follow_up.claimed_by ? ` by ${comm.follow_up.claimed_by}` : ''}`
                                  : 'This item still needs a callback or reply. Reading it does not complete follow-up.'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>

                    {showDepartment && (
                      <span className="truncate text-sm text-foreground">{departmentLabel || 'Not available'}</span>
                    )}

                    <div className="flex items-center gap-2 min-w-0">
                      {systemAgent ? (
                        <span className="truncate text-sm text-foreground">System</span>
                      ) : agentName ? (
                        <span className="truncate text-sm text-foreground">{agentName}</span>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate text-sm text-muted-foreground">Not available</span>
                            </TooltipTrigger>
                            <TooltipContent>This activity has no agent recorded. Nothing is guessed.</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>

                    <span className="text-right text-sm text-muted-foreground tabular-nums">
                      {listingTime}
                    </span>
                </Link>

                {(isInProgress && isClickable) && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex h-2.5 w-2.5 shrink-0">
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                    </span>
                    {isAdmin && (
                      <>
                        <Button variant="outline" size="sm" onClick={(e) => handleJoinCall(e, { silent: true })}>
                          <Ear className="mr-2 h-4 w-4" />
                          Listen
                        </Button>
                        <Button variant="outline" size="sm" onClick={(e) => handleJoinCall(e, { silent: false })}>
                          <Mic className="mr-2 h-4 w-4" />
                          Barge
                        </Button>
                      </>
                    )}
                  </div>
                )}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                         <Button
                           variant="ghost"
                           size="icon"
                           className="h-9 w-9 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                         >
                            <PhoneIcon className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                            const context = phoneNumbers?.length
                              ? resolveOutboundContextFromCommunication(comm, phoneNumbers, fallbackDepartmentId)
                              : comm.department_id
                                ? { departmentId: String(comm.department_id) }
                                : fallbackDepartmentId
                                ? { departmentId: fallbackDepartmentId }
                                : undefined;
                            onMakeCall(mainPageContactNumber, context);
                        }}>
                            Call back
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/conversations/${from}/${to}${queryString}${departmentQuery}`}>
                            {isSms ? 'Reply' : 'View details'}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          const itemType = isSms ? 'sms' : 'call';
                          void setActivityReadState(comm.id, itemType, Number(comm.is_read) !== 0 ? false : true).then(() => {
                            events.emit('refreshCalls');
                            events.emit('refreshDepartmentsUnread');
                          });
                        }}>
                          {Number(comm.is_read) === 0 ? 'Mark as read' : 'Mark as unread'}
                        </DropdownMenuItem>
                        {comm.follow_up && (
                          <>
                            <DropdownMenuItem onClick={() => void updateActivityFollowUp(comm.id, isSms ? 'sms' : 'call', 'in_progress').then(() => events.emit('refreshCalls'))}>
                              Claim follow-up
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              const note = window.prompt('Completion note') || undefined;
                              void updateActivityFollowUp(comm.id, isSms ? 'sms' : 'call', 'completed', note).then(() => events.emit('refreshCalls'));
                            }}>
                              Complete follow-up
                            </DropdownMenuItem>
                          </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
       )
    }

    return (
        <div ref={cardRef} data-is-read={isRead ? '1' : '0'} className={cn("flex w-full min-w-0 items-start gap-3", isMine ? "justify-end" : "justify-start", !isFirstInGroup && "py-0.5", isFirstInGroup && "pt-2")}>
            {showAvatar && (
                <Avatar className="h-8 w-8">
                    <AvatarFallback>
                        {contact ? contactInitial : <UserIcon className="h-4 w-4 text-muted-foreground" />}
                    </AvatarFallback>
                </Avatar>
            )}
            {!showAvatar && !isMine && <div className="w-8" />}

            <div className={cn("flex min-w-0 max-w-[75%] flex-col gap-1", isMine ? 'items-end' : 'items-start')}>
                {isFirstInGroup && comm.created_at && (
                    <div className={cn("px-1", isMine ? "text-right" : "text-left")}>
                      <p className="text-xs font-semibold text-muted-foreground">{contactName}</p>
                      {comm.department?.name && (
                        <p className="text-[11px] font-medium text-muted-foreground/80">{comm.department.name}</p>
                      )}
                      {!isMine && otherParty.sublabel && (
                        <p className="text-[11px] text-muted-foreground/80">{otherParty.sublabel}</p>
                      )}
                    </div>
                )}
                <div className={cn("flex min-w-0 max-w-full items-start gap-2", isMine ? 'flex-row-reverse' : 'flex-row')}>
                    {wrapSelectableBubble(
                      comm.type === 'sms' ? renderMessageBubble(comm) : renderCallBubble(comm)
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        className="h-7 w-7 shrink-0"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleStar(); }}
                        disabled={isTogglingStar}
                        aria-label={comm.is_starred ? 'Unstar' : 'Star'}
                        aria-pressed={comm.is_starred}
                        title={comm.is_starred ? 'Unstar' : 'Star'}
                    >
                        {isTogglingStar ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Star className={cn("h-4 w-4", comm.is_starred ? "text-yellow-500" : "text-muted-foreground")} fill={comm.is_starred ? 'currentColor' : 'none'} />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
  };

  return <CardContent />;
}

export default function CallLog({
  calls: communications,
  contacts,
  companyUsers,
  phoneNumbers,
  fallbackDepartmentId,
  onMakeCall,
  isClickable = true,
  onCommunicationSelect,
  source,
  highlightFailedCalls = false,
  showDepartment = false,
}: CallLogProps) {
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
        <div className="divide-y divide-border/60">
            <div className="hidden items-center gap-3 px-4 py-2 md:flex">
            <div className={cn(
              'grid flex-1 items-center gap-x-4 text-xs font-medium uppercase tracking-wide text-muted-foreground',
              showDepartment
                ? 'grid-cols-[36px_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_88px]'
                : 'grid-cols-[36px_minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_88px]'
            )}>
              <span />
              <span>Contact</span>
              <span>Activity</span>
              {showDepartment && <span>Department</span>}
              <span>Agent</span>
              <span className="text-right">Time</span>
            </div>
            <span className="w-9 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Act</span>
            </div>
            {communications.map((comm, index) => {
                const stableKey = generateKey(comm, index);
                return (
                    <CommunicationCard
                        comm={comm}
                        contacts={contacts}
                        companyUsers={companyUsers}
                        phoneNumbers={phoneNumbers}
                        fallbackDepartmentId={fallbackDepartmentId}
                        key={stableKey}
                        onMakeCall={onMakeCall}
                        isClickable={isClickable}
                        onCommunicationSelect={onCommunicationSelect}
                        source={source}
                        highlightFailedCalls={highlightFailedCalls}
                        showDepartment={showDepartment}
                        isFirstInGroup={true}
                        isLastInGroup={true}
                        isMiddleOfGroup={false}
                    />
                )
            })}
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
    <div className="min-w-0 overflow-x-hidden p-4 space-y-4">
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

                    const isSameGroupable = (c1: Communication, c2: Communication) => {
                        return c1.type === c2.type && c1.direction === c2.direction;
                    };
                    
                    const isSameSenderAsPrev = prevComm && isSameGroupable(comm, prevComm);
                    
                    const isFirstInGroup = !isSameSenderAsPrev;
                    
                    const isLastInGroup = !nextComm || !isSameGroupable(comm, nextComm);
                    const isMiddleOfGroup = isSameSenderAsPrev && !isLastInGroup;

                    const stableKey = generateKey(comm, index);

                    return (
                        <CommunicationCard 
                            comm={comm} 
                            contacts={contacts}
                            companyUsers={companyUsers}
                            phoneNumbers={phoneNumbers}
                            fallbackDepartmentId={fallbackDepartmentId}
                            key={stableKey} 
                            onMakeCall={onMakeCall} 
                            isClickable={isClickable}
                            onCommunicationSelect={onCommunicationSelect}
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

function isSameGroupedWithNext(comms: Communication[], currentIndex: number): boolean {
    if (currentIndex >= comms.length - 1) return false;
    const current = comms[currentIndex];
    if (current.type !== 'sms') return false;

    for (let i = currentIndex + 1; i < comms.length; i++) {
        const next = comms[i];
        if (next.direction === current.direction && next.type === 'sms') {
            return true;
        }
        if (next.type !== 'sms' || next.direction !== current.direction) {
            return false;
        }
    }
    return false;
}


    
