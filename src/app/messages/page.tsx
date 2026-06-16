
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getCompanyPhoneNumbers } from "@/services/phoneNumberService";
import { getContacts } from "@/services/contactService";
import type { PhoneNumber, Contact } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { sendMms } from "@/services/twilioService";
import { useRouter } from 'next/navigation';

import AppHeader from "@/components/app-header";
import MessageComposer from "@/components/message-composer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getPhoneNumberOptionLabel } from "@/lib/utils";

export default function MessagesPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingNumbers, setLoadingNumbers] = useState(true);
  
  const [selectedFromNumber, setSelectedFromNumber] = useState<string>("");
  const [recipient, setRecipient] = useState("");
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [messageBody, setMessageBody] = useState("");
  const [isSending, setIsSending] = useState(false);


  useEffect(() => {
    const fetchInitialData = async () => {
      if (!user?.company_id) return;
      setLoadingNumbers(true);
      try {
        const [fetchedContacts, numbers] = await Promise.all([
            getContacts(user.company_id),
            getCompanyPhoneNumbers(user.company_id),
        ]);
        setContacts(Array.isArray(fetchedContacts) ? fetchedContacts : []);
        const companyNumbers = Array.isArray(numbers) ? numbers : [];
        setPhoneNumbers(companyNumbers);
        if (companyNumbers.length > 0) {
          setSelectedFromNumber(companyNumbers[0].phone_no);
        }
      } catch (error) {
        toast({ title: "Error", description: "Failed to load initial data.", variant: "destructive" });
      } finally {
        setLoadingNumbers(false);
      }
    };

    fetchInitialData();
  }, [user, toast]);
  
  useEffect(() => {
    if (recipient.length > 2) {
        const searchTerm = recipient.toLowerCase();
        const matchingContacts = contacts.filter(contact => 
            contact.name.toLowerCase().includes(searchTerm) ||
            contact.phone_no.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, ''))
        );
        setFilteredContacts(matchingContacts);
    } else {
        setFilteredContacts([]);
    }
}, [recipient, contacts]);

  const handleContactSelect = (contact: Contact) => {
      setRecipient(contact.phone_no);
      setFilteredContacts([]);
  };

  const handleSendMessage = async ({ body, mediaFiles }: { body: string; mediaFiles: File[] }) => {
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
          <div className="flex flex-1 flex-col">
            <AppHeader user={user} logout={logout} />
            <main className="flex-1 flex flex-col bg-muted/40">
                <div className="p-4 border-b space-y-2">
                    <Select onValueChange={setSelectedFromNumber} value={selectedFromNumber} disabled={loadingNumbers}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select Number" />
                        </SelectTrigger>
                        <SelectContent>
                            {phoneNumbers.map((num) => (
                                <SelectItem key={num.id} value={num.phone_no}>
                                    {getPhoneNumberOptionLabel(num)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="relative flex items-center gap-2">
                         <div className="relative flex-1">
                             <Input 
                                placeholder="Type a name or number" 
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                             />
                             {filteredContacts.length > 0 && (
                                <div className="absolute z-10 top-full mt-1 w-full bg-background border rounded-md shadow-lg">
                                    <ScrollArea className="max-h-60">
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
                     <h2 className="text-2xl font-bold mt-8">What's on your mind?</h2>
                     <p className="text-muted-foreground mt-2">Enter a name or number to start chatting</p>
                </div>
                <div className="p-4 border-t bg-background">
                    <MessageComposer
                        messageBody={messageBody}
                        onMessageBodyChange={setMessageBody}
                        onSend={handleSendMessage}
                        isSending={isSending}
                        placeholder="New message"
                    />
                </div>
            </main>
          </div>
        </div>
  );
}
