'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { UserRound } from 'lucide-react';
import CallHistoryShell from '@/components/call-history-shell';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  getUserCallHistory,
  type CallActivityEntry,
  type CallHistoryPagination,
  type CallHistorySummary,
} from '@/services/callLogService';
import type { CallHistoryFilter } from '@/lib/call-history-filters';

const EMPTY_SUMMARY: CallHistorySummary = {
  total: 0,
  completed: 0,
  missed: 0,
  in_progress: 0,
  rejected: 0,
};

const DEFAULT_PAGINATION: CallHistoryPagination = {
  currentPage: 1,
  totalPages: 1,
  totalRecords: 0,
  perPage: 10,
};

export default function UserCallHistoryPage() {
  const params = useParams<{ userId: string }>();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const userId = Number(params.userId);

  const [loading, setLoading] = useState(true);
  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [calls, setCalls] = useState<CallActivityEntry[]>([]);
  const [summary, setSummary] = useState<CallHistorySummary>(EMPTY_SUMMARY);
  const [pagination, setPagination] = useState<CallHistoryPagination>(DEFAULT_PAGINATION);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [filter, setFilter] = useState<CallHistoryFilter>('all');

  const fetchCalls = useCallback(async () => {
    if (!userId || Number.isNaN(userId)) return;

    setLoading(true);
    try {
      const details = await getUserCallHistory(userId, { page, perPage, filter });
      setAgentName(details.user.name);
      setAgentEmail(details.user.email);
      setCalls(details.calls);
      setSummary(details.summary);
      setPagination(details.pagination);
    } catch {
      toast({
        title: 'Unable to load call history',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [userId, page, perPage, filter, toast]);

  useEffect(() => {
    void fetchCalls();
  }, [fetchCalls]);

  useEffect(() => {
    setPage(1);
    setFilter('all');
    setAgentName('');
    setAgentEmail('');
  }, [userId]);

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
  };

  const handleLimitChange = (nextLimit: number) => {
    setPage(1);
    setPerPage(nextLimit);
  };

  const handleFilterChange = (nextFilter: CallHistoryFilter) => {
    setPage(1);
    setFilter(nextFilter);
  };

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
      summary={summary}
      pagination={pagination}
      filter={filter}
      onFilterChange={handleFilterChange}
      onPageChange={handlePageChange}
      onLimitChange={handleLimitChange}
      emptyMessage="No calls found for this agent."
    />
  );
}
