'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Phone } from 'lucide-react';
import CallHistoryShell from '@/components/call-history-shell';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { events } from '@/lib/events';
import {
  getPhoneCallHistory,
  type CallActivityEntry,
  type CallHistoryPagination,
  type CallHistorySummary,
} from '@/services/callLogService';
import type {
  CallHistoryDirectionFilter,
  CallHistoryStatusFilter,
} from '@/lib/call-history-filters';
import { findContactByPhone } from '@/services/contactService';
import type { Contact } from '@/types';
import { formatPhoneNumber } from '@/lib/utils';

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

function decodeRoutePhone(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default function PhoneCallHistoryPage() {
  const params = useParams<{ phone: string }>();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const phoneNumber = decodeRoutePhone(params.phone);

  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<Contact | null>(null);
  const [calls, setCalls] = useState<CallActivityEntry[]>([]);
  const [summary, setSummary] = useState<CallHistorySummary>(EMPTY_SUMMARY);
  const [pagination, setPagination] = useState<CallHistoryPagination>(DEFAULT_PAGINATION);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [directionFilter, setDirectionFilter] = useState<CallHistoryDirectionFilter>('all');
  const [statusFilter, setStatusFilter] = useState<CallHistoryStatusFilter>('all');
  const [dialerOpen, setDialerOpen] = useState(false);
  const [dialerInitialValue, setDialerInitialValue] = useState('');

  const fetchCalls = useCallback(async () => {
    if (!phoneNumber) return;

    setLoading(true);
    try {
      const details = await getPhoneCallHistory(phoneNumber, {
        page,
        perPage,
        direction: directionFilter,
        status: statusFilter,
      });
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
  }, [phoneNumber, page, perPage, directionFilter, statusFilter, toast]);

  useEffect(() => {
    if (!phoneNumber || !user?.company_id) return;
    let cancelled = false;

    findContactByPhone(user.company_id, phoneNumber)
      .then((matchedContact) => {
        if (!cancelled) setContact(matchedContact);
      })
      .catch(() => {
        if (!cancelled) setContact(null);
      });

    return () => {
      cancelled = true;
    };
  }, [phoneNumber, user?.company_id]);

  useEffect(() => {
    void fetchCalls();
  }, [fetchCalls]);

  useEffect(() => {
    setPage(1);
    setDirectionFilter('all');
    setStatusFilter('all');
    setContact(null);
  }, [phoneNumber]);

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
  };

  const handleLimitChange = (nextLimit: number) => {
    setPage(1);
    setPerPage(nextLimit);
  };

  const handleDirectionChange = (nextDirection: CallHistoryDirectionFilter) => {
    setPage(1);
    setDirectionFilter(nextDirection);
  };

  const handleStatusChange = (nextStatus: CallHistoryStatusFilter) => {
    setPage(1);
    setStatusFilter(nextStatus);
  };

  const handleCallClick = () => {
    setDialerInitialValue(phoneNumber.replace(/^\+1/, ''));
    setDialerOpen(true);
  };

  const handleMessageClick = () => {
    events.emit('openMessageDialog', { recipient: phoneNumber });
  };

  const title = contact?.name || formatPhoneNumber(phoneNumber);
  const subtitle = contact ? (
    <>
      {formatPhoneNumber(phoneNumber)}
      {contact.email ? ` · ${contact.email}` : ''}
      {' · '}All calls made to or from this contact
    </>
  ) : (
    <>All calls made to or from {formatPhoneNumber(phoneNumber)}</>
  );

  return (
    <CallHistoryShell
      user={user}
      logout={logout}
      title={title}
      subtitle={subtitle}
      icon={<Phone className="h-5 w-5" />}
      loading={loading}
      calls={calls}
      summary={summary}
      pagination={pagination}
      directionFilter={directionFilter}
      statusFilter={statusFilter}
      onDirectionChange={handleDirectionChange}
      onStatusChange={handleStatusChange}
      onPageChange={handlePageChange}
      onLimitChange={handleLimitChange}
      subjectPhone={phoneNumber}
      emptyMessage="No calls found for this number."
      onCallClick={handleCallClick}
      onMessageClick={handleMessageClick}
      dialerOpen={dialerOpen}
      onDialerOpenChange={setDialerOpen}
      dialerInitialValue={dialerInitialValue}
    />
  );
}
