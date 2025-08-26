
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getDepartments } from "@/services/departmentService";
import { getPhoneNumbers } from "@/services/phoneNumberService";
import { getContacts } from "@/services/contactService";
import type { Department, PhoneNumber, Contact } from "@/types";
import { useToast } from "@/hooks/use-toast";

import { InAppSidebar } from "@/components/in-app-sidebar";
import AppHeader from "@/components/app-header";
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Smile, Paperclip, Mic } from "lucide-react";
import { MessagesIllustration } from "@/components/messages.svg";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function MessagesPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [selectedFromNumber, setSelectedFromNumber] = useState<string>("");
  const [recipient, setRecipient] = useState("");
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!user?.company_id) return;
      setLoadingDepartments(true);
      try {
        const [depts, fetchedContacts] = await Promise.all([
            getDepartments(user.company_id),
            getContacts(user.company_id),
        ]);
        setDepartments(Array.isArray(depts) ? depts : []);
        setContacts(Array.isArray(fetchedContacts) ? fetchedContacts : []);
      } catch (error) {
        toast({ title: "Error", description: "Failed to load initial data.", variant: "destructive" });
      } finally {
        setLoadingDepartments(false);
      }
    };

    fetchInitialData();
  }, [user, toast]);

  const handleDepartmentChange = async (deptId: string) => {
    setSelectedDepartmentId(deptId);
    setLoadingNumbers(true);
    try {
        const numbers = await getPhoneNumbers(Number(deptId));
        setPhoneNumbers(numbers);
        if (numbers.length > 0) {
            setSelectedFromNumber(numbers[0].phone_no);
        } else {
            setSelectedFromNumber("");
        }
    } catch (error) {
        toast({ title: "Error", description: "Failed to load phone numbers.", variant: "destructive" });
    } finally {
        setLoadingNumbers(false);
    }
  };
  
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


  return (
    <SidebarProvider>
      <Sidebar>
        <InAppSidebar />
      </Sidebar>
      <SidebarInset>
        <div className="flex h-screen w-full bg-background text-foreground">
          <div className="flex flex-1 flex-col">
            <AppHeader user={user} logout={logout} />
            <main className="flex-1 flex flex-col bg-muted/40">
                <div className="p-4 border-b">
                    <h1 className="text-xl font-bold">New Message</h1>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground w-16">From:</span>
                            <Select onValueChange={handleDepartmentChange} disabled={loadingDepartments}>
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
                                    <SelectValue placeholder="Select Number" />
                                </SelectTrigger>
                                <SelectContent>
                                    {phoneNumbers.map((num) => (
                                        <SelectItem key={num.id} value={num.phone_no}>
                                            {num.phone_no} ({num.label})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2 relative">
                             <span className="text-sm font-medium text-muted-foreground w-16">To:</span>
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
                     <MessagesIllustration className="w-64 h-64" />
                     <h2 className="text-2xl font-bold mt-8">What's on your mind?</h2>
                     <p className="text-muted-foreground mt-2">Enter a name or number to start chatting</p>
                </div>
                <div className="p-4 border-t bg-background">
                    <div className="relative">
                        <Input placeholder="New message" className="pr-24" />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                           <Button variant="ghost" size="icon"><Paperclip className="h-5 w-5"/></Button>
                           <Button variant="ghost" size="icon"><Smile className="h-5 w-5"/></Button>
                           <Button variant="ghost" size="icon"><Mic className="h-5 w-5"/></Button>
                           <Button size="icon"><Send className="h-5 w-5"/></Button>
                        </div>
                    </div>
                </div>
            </main>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
