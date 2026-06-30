'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, MessageSquare, Phone } from 'lucide-react';
import AppHeader from '@/components/app-header';
import CallLog from '@/components/call-log';
import MessageComposer from '@/components/message-composer';
import PaginationControls from '@/components/pagination-controls';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { useTwilio } from '@/context/TwilioContext';
import { useToast } from '@/hooks/use-toast';
import { useUnusualDepartmentSmsGuard } from '@/hooks/use-unusual-department-sms-guard';
import { events } from '@/lib/events';
import {
  phoneEntryToCommunication,
  sortCommunicationsChronologically,
} from '@/lib/contact-activity';
import {
  resolveOutboundContextFromCommunicationEntry,
  resolveOutboundContextFromLastActivity,
} from '@/lib/department-selection';
import { canListAllCompanyDepartments } from '@/lib/roles';
import { formatPhoneNumber, getPhoneNumberOptionLabel } from '@/lib/utils';
import {
  getPhoneCommunicationHistory,
  type CallHistoryPagination,
  type PhoneCommunicationEntry,
} from '@/services/callLogService';
import { findContactByPhone } from '@/services/contactService';
import { getDepartments } from '@/services/departmentService';
import { getCompanyPhoneNumbers } from '@/services/phoneNumberService';
import { sendMms } from '@/services/twilioService';
import { getUserDepartments } from '@/services/userService';
import type { Communication, Contact, Department, PhoneNumber } from '@/types';
import type { OutboundContext } from '@/lib/outbound-context';

const DEFAULT_PAGINATION: CallHistoryPagination = {
  currentPage: 1,
  totalPages: 1,
  totalRecords: 0,
  perPage: 50,
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
  const router = useRouter();
  const { user, logout } = useAuth();
  const { device, isDeviceReady } = useTwilio();
  const { toast } = useToast();
  const phoneNumber = decodeRoutePhone(params.phone);

  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<Contact | null>(null);
  const [communications, setCommunications] = useState<PhoneCommunicationEntry[]>([]);
  const [pagination, setPagination] = useState<CallHistoryPagination>(DEFAULT_PAGINATION);
  const [totalCalls, setTotalCalls] = useState(0);
  const [totalSms, setTotalSms] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [dialerOpen, setDialerOpen] = useState(false);
  const [dialerInitialValue, setDialerInitialValue] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedFromNumber, setSelectedFromNumber] = useState('');
  const [loadingSetup, setLoadingSetup] = useState(true);
  const { confirmIfNeeded: confirmUnusualDepartmentSms, dialog: unusualDepartmentSmsDialog } =
    useUnusualDepartmentSmsGuard(departments);

  const chatScrollRef = useRef<HTMLElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const applyDepartmentContext = useCallback((context: OutboundContext) => {
    if (context.departmentId) {
      setSelectedDepartmentId(context.departmentId);
    }
    if (context.fromNumber) {
      setSelectedFromNumber(context.fromNumber);
    }
  }, []);

  const fetchCommunications = useCallback(async () => {
    if (!phoneNumber) return;

    setLoading(true);
    try {
      const details = await getPhoneCommunicationHistory(phoneNumber, {
        page,
        perPage,
      });
      setCommunications(details.communications);
      setPagination(details.pagination);
      setTotalCalls(details.total_calls);
      setTotalSms(details.total_sms);
    } catch {
      toast({
        title: 'Unable to load communication history',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [phoneNumber, page, perPage, toast]);

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
    if (!user) return;

    let cancelled = false;
    setLoadingSetup(true);

    const loadSetup = async () => {
      try {
        const canFetchAllDepts = canListAllCompanyDepartments(user.role_id);
        const [fetchedDepts, companyNumbers] = await Promise.all([
          canFetchAllDepts && user.company_id
            ? getDepartments(user.company_id)
            : getUserDepartments(user.id),
          user.company_id ? getCompanyPhoneNumbers(user.company_id) : Promise.resolve([]),
        ]);

        if (cancelled) return;

        setDepartments(Array.isArray(fetchedDepts) ? fetchedDepts : []);
        setPhoneNumbers(Array.isArray(companyNumbers) ? companyNumbers : []);
      } finally {
        if (!cancelled) setLoadingSetup(false);
      }
    };

    void loadSetup();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    void fetchCommunications();
  }, [fetchCommunications]);

  useEffect(() => {
    setPage(1);
    setSelectedDepartmentId('');
    setSelectedFromNumber('');
    setContact(null);
  }, [phoneNumber]);

  useEffect(() => {
    if (!phoneNumbers.length || !communications.length || selectedDepartmentId) return;

    const context = resolveOutboundContextFromLastActivity(communications, phoneNumbers);
    applyDepartmentContext(context);
  }, [communications, phoneNumbers, selectedDepartmentId, applyDepartmentContext]);

  const filteredPhoneNumbers = selectedDepartmentId
    ? phoneNumbers.filter(
        (num) => num.department_id != null && String(num.department_id) === selectedDepartmentId
      )
    : [];

  useEffect(() => {
    if (!selectedDepartmentId) {
      setSelectedFromNumber('');
      return;
    }

    const hasSelectedNumber = filteredPhoneNumbers.some((num) => num.phone_no === selectedFromNumber);
    if (!hasSelectedNumber) {
      setSelectedFromNumber(filteredPhoneNumbers[0]?.phone_no ?? '');
    }
  }, [selectedDepartmentId, filteredPhoneNumbers, selectedFromNumber]);

  const feedCommunications = useMemo(
    () => sortCommunicationsChronologically(communications).map(phoneEntryToCommunication),
    [communications]
  );

  useEffect(() => {
    if (loading) return;
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, [feedCommunications, loading]);

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
  };

  const handleLimitChange = (nextLimit: number) => {
    setPage(1);
    setPerPage(nextLimit);
  };

  const handleCommunicationSelect = useCallback(
    (comm: Communication) => {
      applyDepartmentContext(resolveOutboundContextFromCommunicationEntry(comm, phoneNumbers));
    },
    [applyDepartmentContext, phoneNumbers]
  );

  const handleMakeCall = (number: string, context?: OutboundContext) => {
    if (!device || !isDeviceReady) {
      toast({
        title: 'Twilio Error',
        description: 'Twilio Device not ready.',
        variant: 'destructive',
      });
      return;
    }

    const outboundContext = context ?? {
      departmentId: selectedDepartmentId || undefined,
      fromNumber: selectedFromNumber || undefined,
    };

    if (outboundContext.departmentId || outboundContext.fromNumber) {
      events.emit('setOutboundContext', outboundContext);
    }
    setDialerInitialValue(number.replace(/^\+1/, ''));
    setDialerOpen(true);
  };

  const handleSendMessage = async ({
    body,
    mediaFiles,
  }: {
    body: string;
    mediaFiles: File[];
  }) => {
    if (!selectedDepartmentId) {
      toast({
        title: 'Select a department',
        description: 'Choose which department this message should be sent from.',
        variant: 'destructive',
      });
      return;
    }
    if (!selectedFromNumber) {
      toast({
        title: 'Select a number',
        description: 'Choose a phone number for the selected department.',
        variant: 'destructive',
      });
      return;
    }
    if (!phoneNumber) {
      toast({
        title: 'Error',
        description: 'Could not determine recipient.',
        variant: 'destructive',
      });
      return;
    }
    if (!body && mediaFiles.length === 0) {
      toast({
        title: 'Error',
        description: 'Add a message or media attachment to send.',
        variant: 'destructive',
      });
      return;
    }

    const confirmed = await confirmUnusualDepartmentSms({
      recipientPhone: phoneNumber,
      selectedDepartmentId,
      communications,
    });
    if (!confirmed) return;

    setIsSending(true);
    try {
      await sendMms(
        selectedFromNumber,
        phoneNumber,
        body,
        mediaFiles.length ? mediaFiles : undefined
      );
      toast({
        title: 'Success',
        description: mediaFiles.length ? 'MMS sent successfully.' : 'Message sent successfully.',
      });
      setMessageBody('');
      await fetchCommunications();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to send message.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const displayName = contact?.name || formatPhoneNumber(phoneNumber);
  const hasAnyRecords = totalCalls + totalSms > 0;
  const canCompose = Boolean(selectedDepartmentId && selectedFromNumber);

  return (
    <div className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-background text-foreground">
      {unusualDepartmentSmsDialog}
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          user={user}
          logout={logout}
          dialerOpen={dialerOpen}
          dialerInitialValue={dialerInitialValue}
          onDialerOpenChange={setDialerOpen}
          outboundContext={{
            departmentId: selectedDepartmentId || undefined,
            fromNumber: selectedFromNumber || undefined,
          }}
        />

        <header className="z-20 flex shrink-0 border-b bg-background/95 backdrop-blur-sm">
          <div className="flex h-16 w-full items-center justify-between gap-3 px-4 md:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold">{displayName}</h1>
                <p className="truncate text-sm text-muted-foreground">
                  Other: {formatPhoneNumber(phoneNumber)}
                  {contact?.email ? ` · ${contact.email}` : ''}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                title="Send message"
                onClick={() =>
                  events.emit('openMessageDialog', {
                    recipient: phoneNumber,
                    departmentId: selectedDepartmentId || undefined,
                  })
                }
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button
                title="Call"
                onClick={() => handleMakeCall(phoneNumber)}
                disabled={loadingSetup}
              >
                <Phone className="mr-2 h-4 w-4" />
                Call
              </Button>
            </div>
          </div>
        </header>

        <main ref={chatScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading communication history...
            </div>
          ) : !hasAnyRecords ? (
            <div className="py-24 text-center text-sm text-muted-foreground">
              No calls or messages found for this contact.
            </div>
          ) : (
            <>
              {pagination.totalPages > 1 ? (
                <div className="border-b bg-muted/20 px-4 py-3 md:px-8">
                  <PaginationControls
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    totalRecords={pagination.totalRecords}
                    limit={pagination.perPage}
                    onPageChange={handlePageChange}
                    onLimitChange={handleLimitChange}
                    isLoading={loading}
                    className="mb-0"
                  />
                </div>
              ) : null}
              <CallLog
                calls={feedCommunications as Communication[]}
                phoneNumbers={phoneNumbers}
                onMakeCall={handleMakeCall}
                isClickable={false}
                onCommunicationSelect={handleCommunicationSelect}
              />
            </>
          )}
          <div ref={messagesEndRef} />
        </main>

        <footer className="shrink-0 space-y-2 border-t bg-background p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Select
              value={selectedDepartmentId}
              onValueChange={setSelectedDepartmentId}
              disabled={loadingSetup || departments.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={String(dept.id)}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={selectedFromNumber}
              onValueChange={setSelectedFromNumber}
              disabled={loadingSetup || !selectedDepartmentId || filteredPhoneNumbers.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    selectedDepartmentId ? 'Select number' : 'Select department first'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {filteredPhoneNumbers.map((num) => (
                  <SelectItem key={num.id} value={num.phone_no}>
                    {getPhoneNumberOptionLabel(num)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <MessageComposer
            messageBody={messageBody}
            onMessageBodyChange={setMessageBody}
            onSend={handleSendMessage}
            isSending={isSending}
            placeholder={canCompose ? 'New message' : 'Select a department to send a message'}
          />
        </footer>
      </div>
    </div>
  );
}
