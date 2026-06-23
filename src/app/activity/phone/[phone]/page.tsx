'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Phone } from 'lucide-react';
import CallHistoryShell from '@/components/call-history-shell';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getPhoneCallHistory } from '@/services/callLogService';
import { findContactByPhone } from '@/services/contactService';
import type { Contact } from '@/types';
import { formatPhoneNumber } from '@/lib/utils';
import type { CallActivityEntry } from '@/services/callLogService';

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

  useEffect(() => {
    if (!phoneNumber) return;

    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const [details, matchedContact] = await Promise.all([
          getPhoneCallHistory(phoneNumber),
          user?.company_id ? findContactByPhone(user.company_id, phoneNumber) : Promise.resolve(null),
        ]);

        if (cancelled) return;
        setCalls(details.calls);
        setContact(matchedContact);
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
  }, [phoneNumber, user?.company_id, toast]);

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
      subjectPhone={phoneNumber}
      emptyMessage="No calls found for this number."
    />
  );
}
