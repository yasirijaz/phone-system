'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { UserRound } from 'lucide-react';
import CallHistoryShell from '@/components/call-history-shell';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getUserCallHistory, type CallActivityEntry } from '@/services/callLogService';

export default function UserCallHistoryPage() {
  const params = useParams<{ userId: string }>();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const userId = Number(params.userId);

  const [loading, setLoading] = useState(true);
  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [calls, setCalls] = useState<CallActivityEntry[]>([]);

  useEffect(() => {
    if (!userId || Number.isNaN(userId)) return;

    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const details = await getUserCallHistory(userId);
        if (cancelled) return;
        setAgentName(details.user.name);
        setAgentEmail(details.user.email);
        setCalls(details.calls);
      } catch {
        if (!cancelled) {
          toast({
            title: 'Unable to load call history',
            description: 'Please try again in a moment.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, toast]);

  return (
    <CallHistoryShell
      user={user}
      logout={logout}
      title={agentName || 'Agent call history'}
      subtitle={
        agentEmail
          ? `${agentEmail} · All calls dialed or received by this agent`
          : 'All calls dialed or received by this agent'
      }
      icon={<UserRound className="h-5 w-5" />}
      loading={loading}
      calls={calls}
      emptyMessage="No calls found for this agent."
    />
  );
}
