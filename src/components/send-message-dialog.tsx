'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Contact, Department, PhoneNumber } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import MessageComposer from '@/components/message-composer';
import { useToast } from '@/hooks/use-toast';
import { useUnusualDepartmentSmsGuard } from '@/hooks/use-unusual-department-sms-guard';
import { sendMms } from '@/services/twilioService';
import { searchContacts } from '@/services/contactService';
import { getPhoneNumberOptionLabel } from '@/lib/utils';
import { resolveOutboundContextForDepartment } from '@/lib/outbound-context';
import { resolveDefaultFromNumberForDepartment } from '@/lib/phone-numbers';
import { useAuth } from '@/context/AuthContext';

export type SendMessageDialogPayload = {
  departmentId?: string;
  recipient?: string;
};

type SendMessageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Department[];
  phoneNumbers: PhoneNumber[];
  contacts?: Contact[];
  loadingDepartments?: boolean;
  loadingNumbers?: boolean;
  payload?: SendMessageDialogPayload;
};

export default function SendMessageDialog({
  open,
  onOpenChange,
  departments,
  phoneNumbers,
  contacts = [],
  loadingDepartments = false,
  loadingNumbers = false,
  payload,
}: SendMessageDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedFromNumber, setSelectedFromNumber] = useState('');
  const [recipient, setRecipient] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const { confirmIfNeeded: confirmUnusualDepartmentSms, dialog: unusualDepartmentSmsDialog } =
    useUnusualDepartmentSmsGuard(departments);

  useEffect(() => {
    if (!open) return;

    const initialDepartmentId = payload?.departmentId ?? '';
    const initialRecipient = payload?.recipient ?? '';

    if (initialDepartmentId) {
      const context = resolveOutboundContextForDepartment(initialDepartmentId, phoneNumbers);
      setSelectedDepartmentId(context.departmentId ?? '');
      setSelectedFromNumber(context.fromNumber ?? '');
    } else {
      setSelectedDepartmentId('');
      setSelectedFromNumber('');
    }

    setRecipient(initialRecipient);
    setMessageBody('');
    setFilteredContacts([]);
  }, [open, payload?.departmentId, payload?.recipient, phoneNumbers]);

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

  useEffect(() => {
    const companyId = user?.company_id;
    if (!open || !companyId || recipient.length < 1) {
      setFilteredContacts([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void searchContacts(companyId, recipient, 25)
        .then((matches) => {
          if (!cancelled) {
            setFilteredContacts(matches);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setFilteredContacts([]);
          }
        });
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, recipient, user?.company_id]);

  const handleContactSelect = (contact: Contact) => {
    setRecipient(contact.phone_no);
    setFilteredContacts([]);
  };

  const handleSendMessage = async ({ body, mediaFiles, scheduledAt }: { body: string; mediaFiles: File[]; scheduledAt?: string }) => {
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
    if (!recipient) {
      toast({ title: 'Error', description: 'Please enter a recipient.', variant: 'destructive' });
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
      recipientPhone: recipient,
      selectedDepartmentId,
    });
    if (!confirmed) return;

    setIsSending(true);
    try {
      await sendMms(
        selectedFromNumber,
        recipient,
        body,
        mediaFiles.length ? mediaFiles : undefined,
        scheduledAt
      );
      toast({
        title: 'Success',
        description: scheduledAt
          ? 'Message scheduled.'
          : mediaFiles.length ? 'MMS sent successfully.' : 'Message sent successfully.',
      });
      onOpenChange(false);
      router.push(
        `/conversations/${encodeURIComponent(selectedFromNumber)}/${encodeURIComponent(recipient)}`
      );
    } finally {
      setIsSending(false);
    }
  };

  const canCompose = Boolean(selectedDepartmentId && selectedFromNumber);

  return (
    <>
      {unusualDepartmentSmsDialog}
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>
            {payload?.departmentId
              ? 'Send an SMS from this department. You can change the number if needed.'
              : 'Select a department before sending so messages go out from the correct line.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="send-message-department">Department</Label>
              <Select
                value={selectedDepartmentId}
                onValueChange={setSelectedDepartmentId}
                disabled={loadingDepartments}
              >
                <SelectTrigger id="send-message-department">
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="send-message-number">From number</Label>
              <Select
                value={selectedFromNumber}
                onValueChange={setSelectedFromNumber}
                disabled={loadingNumbers || !selectedDepartmentId}
              >
                <SelectTrigger id="send-message-number">
                  <SelectValue placeholder={selectedDepartmentId ? 'Select number' : 'Select department first'} />
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="send-message-recipient">To</Label>
            <div className="relative">
              <Input
                id="send-message-recipient"
                placeholder="Type a name or number"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
              />
              {filteredContacts.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full rounded-md border bg-background shadow-lg">
                  <ScrollArea className="max-h-48 overflow-y-auto">
                    {filteredContacts.map((contact) => (
                      <button
                        key={contact.id}
                        type="button"
                        onMouseDown={() => handleContactSelect(contact)}
                        className="block w-full p-2 text-left hover:bg-accent"
                      >
                        <p className="font-medium">{contact.name}</p>
                        <p className="text-xs text-muted-foreground">{contact.phone_no}</p>
                      </button>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>

          {!canCompose ? (
            <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
              Select a department and phone number to compose your message.
            </p>
          ) : (
            <MessageComposer
              messageBody={messageBody}
              onMessageBodyChange={setMessageBody}
              onSend={handleSendMessage}
              isSending={isSending}
              placeholder="Write your message..."
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
