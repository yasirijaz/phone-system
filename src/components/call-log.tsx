
import type { Call } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PhoneIncoming, PhoneOutgoing, User, Clock, CalendarDays, NotebookText, Voicemail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';

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

  const contact = getContactName();
  const contactNumber = getContactNumber();
  const isVoicemail = !!call.recording_url;

  const getIcon = () => {
    if (isVoicemail) {
      return <Voicemail className="h-6 w-6 text-purple-500" />;
    }
    if (call.direction === 'inbound') {
      return <PhoneIncoming className="h-6 w-6 text-green-500" />;
    }
    return <PhoneOutgoing className="h-6 w-6 text-blue-500" />;
  }

  return (
    <Link href={`/conversations/${encodeURIComponent(contactNumber)}`} className="block">
        <Card className="mb-4 transition-all hover:shadow-lg">
        <CardHeader>
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                {getIcon()}
                <CardTitle className="text-lg">{isVoicemail ? 'Voicemail' : contact}</CardTitle>
                <span className="text-sm text-muted-foreground">{isVoicemail ? `from ${contact}`: ''}</span>
            </div>
            <div className='flex items-center gap-2'>
                {call.call_status && <Badge variant="outline">{call.call_status}</Badge>}
                {call.category && <Badge variant="secondary">{call.category}</Badge>}
            </div>
            </div>
            <CardDescription className="flex items-center flex-wrap gap-x-4 gap-y-1 pt-2 text-xs">
            {call.created_at && (
                <>
                <span className="flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> {format(parseISO(call.created_at), 'PP')}</span>
                <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {format(parseISO(call.created_at), 'p')}</span>
                </>
            )}
            <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {call.duration} min</span>
            </CardDescription>
        </CardHeader>
        
        {isVoicemail && (
            <CardContent>
                <audio controls src={call.recording_url} className="w-full h-10" onClick={(e) => e.preventDefault()}></audio>
            </CardContent>
        )}

        {call.notes && (
            <CardContent>
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <NotebookText className="h-4 w-4 mt-1 shrink-0" />
                <p className="whitespace-pre-wrap">{call.notes}</p>
            </div>
            </CardContent>
        )}
        </Card>
    </Link>
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

  return (
    <div className="space-y-4">
      {calls.map((call) => (
        <CallCard key={call.id} call={call} />
      ))}
    </div>
  );
}
