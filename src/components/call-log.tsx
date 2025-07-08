import type { Call } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PhoneIncoming, PhoneOutgoing, User, Clock, CalendarDays, Tag, NotebookText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';

interface CallLogProps {
  calls: Call[];
}

function CallCard({ call }: { call: Call }) {
  return (
    <Card className="mb-4 transition-all hover:shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {call.type === 'incoming' ? 
              <PhoneIncoming className="h-6 w-6 text-green-500" /> : 
              <PhoneOutgoing className="h-6 w-6 text-blue-500" />
            }
            <CardTitle className="text-lg">{call.contact}</CardTitle>
          </div>
          {call.category && <Badge variant="secondary">{call.category}</Badge>}
        </div>
        <CardDescription className="flex items-center gap-4 pt-2 text-xs">
          <span className="flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> {format(parseISO(call.dateTime), 'PP')}</span>
          <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {format(parseISO(call.dateTime), 'p')}</span>
          <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {call.duration} min</span>
        </CardDescription>
      </CardHeader>
      {call.notes && (
        <CardContent>
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <NotebookText className="h-4 w-4 mt-1 shrink-0" />
            <p className="whitespace-pre-wrap">{call.notes}</p>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export default function CallLog({ calls }: CallLogProps) {
  if (calls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-48 border-2 border-dashed rounded-lg">
        <p className="text-lg font-medium">No calls found</p>
        <p>Your call history is empty. Try clearing your filters or logging a new call.</p>
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
