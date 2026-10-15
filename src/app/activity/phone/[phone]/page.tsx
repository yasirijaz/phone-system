'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, PanelRightClose, Phone, User } from 'lucide-react';
import AppHeader from '@/components/app-header';
import CallLog from '@/components/call-log';
import ContactProfile from '@/components/contact-profile';
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
import { buildThreadContactState } from '@/lib/contact-display';
import {
  resolveOutboundContextFromCommunicationEntry,
  resolveOutboundContextFromLastActivity,
} from '@/lib/department-selection';
import { canListAllCompanyDepartments } from '@/lib/roles';
import { cn, formatPhoneNumber, getPhoneNumberOptionLabel, phonesMatch } from '@/lib/utils';
import { resolveDefaultFromNumberForDepartment } from '@/lib/phone-numbers';
import {
  getPhoneCommunicationHistory,
  type CallHistoryPagination,
  type PhoneCommunicationEntry,
} from '@/services/callLogService';
import { findContactByPhone, getContacts } from '@/services/contactService';
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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isProfileSidebarOpen, setIsProfileSidebarOpen] = useState(false);
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
  const stickToBottomRef = useRef(true);

  const applyDepartmentContext = useCallback((context: OutboundContext) => {
    if (context.departmentId) {
      setSelectedDepartmentId(context.departmentId);
    }
    if (context.fromNumber) {
      setSelectedFromNumber(context.fromNumber);
    }
  }, []);

  const fetchCommunications = useCallback(async (options?: { silent?: boolean }) => {
    if (!phoneNumber) return;

    if (!options?.silent) setLoading(true);
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

    Promise.all([
      findContactByPhone(user.company_id, phoneNumber),
      getContacts(user.company_id),
    ])
      .then(([matchedContact, companyContacts]) => {
        if (cancelled) return;
        setContact(matchedContact);
        setContacts(Array.isArray(companyContacts) ? companyContacts : []);
      })
      .catch(() => {
        if (cancelled) return;
        setContact(null);
        setContacts([]);
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
    stickToBottomRef.current = true;
  }, [phoneNumber]);

  useEffect(() => {
    const refresh = (payload?: { from?: string; to?: string }) => {
      const hasParties = Boolean(payload?.from || payload?.to);
      const touchesThisContact =
        !hasParties ||
        phonesMatch(payload?.from, phoneNumber) ||
        phonesMatch(payload?.to, phoneNumber);
      if (!touchesThisContact) return;
      void fetchCommunications({ silent: true });
    };
    events.on('refreshConversation', refresh);
    return () => {
      events.off('refreshConversation', refresh);
    };
  }, [fetchCommunications, phoneNumber]);

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
      setSelectedFromNumber(resolveDefaultFromNumberForDepartment(phoneNumbers, selectedDepartmentId));
    }
  }, [selectedDepartmentId, filteredPhoneNumbers, selectedFromNumber]);

  const feedCommunications = useMemo(
    () => sortCommunicationsChronologically(communications).map(phoneEntryToCommunication),
    [communications]
  );

  const threadContact = useMemo(
    () => buildThreadContactState(feedCommunications, phoneNumber, contact),
    [feedCommunications, phoneNumber, contact]
  );

  const refreshContactState = useCallback(async () => {
    if (!phoneNumber || !user?.company_id) return;
    try {
      const [matchedContact, companyContacts] = await Promise.all([
        findContactByPhone(user.company_id, phoneNumber),
        getContacts(user.company_id),
      ]);
      setContact(matchedContact);
      setContacts(Array.isArray(companyContacts) ? companyContacts : []);
      await fetchCommunications();
    } catch {
      // Keep current UI if refresh fails.
    }
  }, [phoneNumber, user?.company_id, fetchCommunications]);

  const rememberScrollPosition = () => {
    const el = chatScrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  useEffect(() => {
    if (loading || !stickToBottomRef.current) return;
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
    scheduledAt,
    timezone,
  }: {
    body: string;
    mediaFiles: File[];
    scheduledAt?: string;
    timezone?: string;
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
        mediaFiles.length ? mediaFiles : undefined,
        scheduledAt,
        timezone
      );
      toast({
        title: 'Success',
        description: scheduledAt
          ? 'Message scheduled.'
          : mediaFiles.length ? 'MMS sent successfully.' : 'Message sent successfully.',
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

  const displayName = threadContact.name || formatPhoneNumber(phoneNumber);
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
        />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className={cn('flex min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground')}>
            <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur-sm md:px-8">
              <div className="flex min-w-0 items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                  <ArrowLeft />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Call Now"
                  className="text-left"
                  disabled={!phoneNumber || loadingSetup}
                  onClick={() => handleMakeCall(phoneNumber)}
                >
                  <Phone className="h-4 w-4" />
                </Button>
                <div className="relative min-w-0 flex-1">
                  <h1 className="truncate text-xl font-bold">{displayName}</h1>
                  {(threadContact.sublabel || phoneNumber) && (
                    <p className="truncate text-sm text-muted-foreground">
                      {[threadContact.sublabel, formatPhoneNumber(phoneNumber)]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsProfileSidebarOpen(!isProfileSidebarOpen)}
              >
                {isProfileSidebarOpen ? <PanelRightClose /> : <User />}
              </Button>
            </header>

            <main
              ref={chatScrollRef}
              onScroll={rememberScrollPosition}
              className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
            >
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
                    contacts={contacts}
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

          {isProfileSidebarOpen && (
            <aside className="h-full w-full max-w-[380px] border-l bg-background overflow-y-auto">
              <ContactProfile
                contact={threadContact}
                contacts={contacts}
                onContactUpdate={refreshContactState}
                onCollapse={() => setIsProfileSidebarOpen(false)}
              />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
