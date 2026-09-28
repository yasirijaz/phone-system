'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { events } from '@/lib/events';
import { cn, formatScheduleRemaining, formatScheduledAt } from '@/lib/utils';
import { discardScheduledSms, sendScheduledSmsNow } from '@/services/twilioService';

type ScheduledSmsActionsProps = {
  smsId: number;
  scheduledAt: string;
  isMine?: boolean;
};

export default function ScheduledSmsActions({
  smsId,
  scheduledAt,
  isMine = true,
}: ScheduledSmsActionsProps) {
  const { toast } = useToast();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busy, setBusy] = useState<'send' | 'discard' | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = formatScheduleRemaining(scheduledAt, nowMs);

  const refreshThread = () => {
    events.emit('refreshConversation');
    events.emit('refreshCalls');
  };

  const handleSendNow = async () => {
    if (busy) return;
    setBusy('send');
    try {
      await sendScheduledSmsNow(smsId);
      toast({ title: 'Message sent' });
      refreshThread();
    } catch (error: any) {
      toast({
        title: 'Could not send',
        description: error?.response?.data?.message || 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleDiscard = async () => {
    if (busy) return;
    setBusy('discard');
    try {
      await discardScheduledSms(smsId);
      toast({ title: 'Scheduled message discarded' });
      refreshThread();
    } catch (error: any) {
      toast({
        title: 'Could not discard',
        description: error?.response?.data?.message || 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2 pt-1">
      <div className={cn('text-xs', isMine ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
        Scheduled {formatScheduledAt(scheduledAt)}
        {remaining ? ` · ${remaining}` : ''}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={isMine ? 'secondary' : 'default'}
          className="h-7 px-2 text-xs"
          disabled={busy !== null}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void handleSendNow();
          }}
        >
          {busy === 'send' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          Send now
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn(
            'h-7 px-2 text-xs',
            isMine && 'border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10'
          )}
          disabled={busy !== null}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void handleDiscard();
          }}
        >
          {busy === 'discard' ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          Discard
        </Button>
      </div>
    </div>
  );
}
