
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getCompanyPhoneNumbers } from "@/services/phoneNumberService";
import { searchContacts } from "@/services/contactService";
import { getDepartments } from "@/services/departmentService";
import type { PhoneNumber, Contact, Department } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useUnusualDepartmentSmsGuard } from "@/hooks/use-unusual-department-sms-guard";
import { sendMms } from "@/services/twilioService";
import { useRouter, useSearchParams } from 'next/navigation';

import AppHeader from "@/components/app-header";
import MessageComposer from "@/components/message-composer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getPhoneNumberOptionLabel } from "@/lib/utils";
import { resolveDefaultFromNumberForDepartment } from "@/lib/phone-numbers";
import {
  resolveOutboundContextForDepartment,
  type OutboundContext,
} from "@/lib/outbound-context";

export default function MessagesPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingNumbers, setLoadingNumbers] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [selectedFromNumber, setSelectedFromNumber] = useState<string>("");
  const [recipient, setRecipient] = useState("");
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [messageBody, setMessageBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { confirmIfNeeded: confirmUnusualDepartmentSms, dialog: unusualDepartmentSmsDialog } =
    useUnusualDepartmentSmsGuard(departments);


  useEffect(() => {
    const fetchInitialData = async () => {
      if (!user?.company_id) return;
      setLoadingNumbers(true);
      setLoadingDepartments(true);
      try {
        const [numbers, fetchedDepartments] = await Promise.all([
            getCompanyPhoneNumbers(user.company_id),
            getDepartments(user.company_id),
        ]);
        const depts = Array.isArray(fetchedDepartments) ? fetchedDepartments : [];
        setDepartments(depts);
        const companyNumbers = Array.isArray(numbers) ? numbers : [];
        setPhoneNumbers(companyNumbers);

        const requestedDepartmentId = searchParams.get('departmentId');
        if (requestedDepartmentId && depts.some((dept) => String(dept.id) === requestedDepartmentId)) {
          const initialContext = resolveOutboundContextForDepartment(requestedDepartmentId, companyNumbers);
          if (initialContext.departmentId) {
            setSelectedDepartmentId(initialContext.departmentId);
          }
          if (initialContext.fromNumber) {
            setSelectedFromNumber(initialContext.fromNumber);
          }
        }
      } catch (error) {
        toast({ title: "Error", description: "Failed to load initial data.", variant: "destructive" });
      } finally {
        setLoadingNumbers(false);
        setLoadingDepartments(false);
      }
    };

    fetchInitialData();
  }, [user, toast, searchParams]);
  
  useEffect(() => {
    const to = searchParams.get('to');
    if (to) {
      setRecipient(to);
    }
  }, [searchParams]);

  useEffect(() => {
    const companyId = user?.company_id;
    if (!companyId || recipient.length < 1) {
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
  }, [recipient, user?.company_id]);

  const filteredPhoneNumbers = selectedDepartmentId
    ? phoneNumbers.filter(
        (num) => num.department_id != null && String(num.department_id) === selectedDepartmentId
      )
    : [];

  useEffect(() => {
    if (!selectedDepartmentId) return;
    const hasSelectedNumber = filteredPhoneNumbers.some((num) => num.phone_no === selectedFromNumber);
    if (!hasSelectedNumber) {
      setSelectedFromNumber(resolveDefaultFromNumberForDepartment(phoneNumbers, selectedDepartmentId));
    }
  }, [selectedDepartmentId, filteredPhoneNumbers, selectedFromNumber]);

  const handleContactSelect = (contact: Contact) => {
      setRecipient(contact.phone_no);
      setFilteredContacts([]);
  };

  const handleSendMessage = async ({ body, mediaFiles }: { body: string; mediaFiles: File[] }) => {
    if (!selectedDepartmentId) {
        toast({ title: "Select a department", description: "Choose which department this message should be sent from.", variant: "destructive" });
        return;
    }
    if (!selectedFromNumber) {
        toast({ title: "Error", description: "Please select a 'from' number.", variant: "destructive" });
        return;
    }
    if (!recipient) {
        toast({ title: "Error", description: "Please enter a recipient.", variant: "destructive" });
        return;
    }
    if (!body && mediaFiles.length === 0) {
        toast({ title: "Error", description: "Add a message or media attachment to send.", variant: "destructive" });
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
            mediaFiles.length ? mediaFiles : undefined
        );
        toast({ title: "Success", description: mediaFiles.length ? "MMS sent successfully." : "Message sent successfully." });
        setMessageBody("");
        router.push(`/conversations/${encodeURIComponent(selectedFromNumber)}/${encodeURIComponent(recipient)}`);
    } finally {
        setIsSending(false);
    }
  };


  return (
        <div className="flex h-full min-h-0 w-full bg-background text-foreground">
          {unusualDepartmentSmsDialog}
          <div className="flex flex-1 flex-col">
            <AppHeader user={user} logout={logout} />
            <main className="flex-1 flex flex-col bg-muted/40">
                <div className="p-4 border-b space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <Select
                          onValueChange={setSelectedDepartmentId}
                          value={selectedDepartmentId}
                          disabled={loadingDepartments}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Department" />
                            </SelectTrigger>
                            <SelectContent>
                                {departments.map((dept) => (
                                    <SelectItem key={dept.id} value={String(dept.id)}>
                                        {dept.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select onValueChange={setSelectedFromNumber} value={selectedFromNumber} disabled={loadingNumbers || !selectedDepartmentId}>
                            <SelectTrigger>
                                <SelectValue placeholder={selectedDepartmentId ? "Select Number" : "Select department first"} />
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
                    <div className="relative flex items-center gap-2">
                         <div className="relative flex-1">
                             <Input 
                                placeholder="Type a name or number" 
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                             />
                             {filteredContacts.length > 0 && (
                                <div className="absolute z-10 top-full mt-1 w-full bg-background border rounded-md shadow-lg">
                                    <ScrollArea className="overflow-y-auto max-h-60">
                                        {filteredContacts.map(contact => (
                                            <div 
                                                key={contact.id}
                                                onMouseDown={() => handleContactSelect(contact)}
                                                className="p-2 hover:bg-accent cursor-pointer"
                                            >
                                                <p className="font-medium">{contact.name}</p>
                                                <p className="text-xs text-muted-foreground">{contact.phone_no}</p>
                                            </div>
                                        ))}
                                    </ScrollArea>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                     <h2 className="text-2xl font-bold mt-8">
                       {selectedDepartmentId ? "What's on your mind?" : 'Choose a department'}
                     </h2>
                     <p className="text-muted-foreground mt-2">
                       {selectedDepartmentId
                         ? 'Enter a name or number to start chatting'
                         : 'Select a department and phone number before sending a message.'}
                     </p>
                </div>
                <div className="p-4 border-t bg-background">
                    {selectedDepartmentId && selectedFromNumber ? (
                      <MessageComposer
                        messageBody={messageBody}
                        onMessageBodyChange={setMessageBody}
                        onSend={handleSendMessage}
                        isSending={isSending}
                        placeholder="New message"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Select a department and phone number to compose your message.
                      </p>
                    )}
                </div>
            </main>
          </div>
        </div>
  );
}
