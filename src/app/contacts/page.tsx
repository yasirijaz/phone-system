
"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Contact, Department, PhoneNumber, Call } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { getContacts, createContact, updateContact, deleteContact } from "@/services/contactService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Hash, Inbox, MessageSquare, Users, Edit, Trash2, Search, Phone, Video, Settings, LogOut } from "lucide-react";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import Link from "next/link";
import { Logo } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getDepartments } from "@/services/departmentService";
import { getUserDepartments } from "@/services/userService";
import { getPhoneNumbers } from "@/services/phoneNumberService";
import { useTwilio } from "@/context/TwilioContext";
import Dialer from "@/components/dialer";
import NewMessageForm from "@/components/new-message-form";
import HardwareSettings from "@/components/hardware-settings";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getCallLogs } from "@/services/callLogService";

const contactSchema = z.object({
  name: z.string().min(2, "Name is required."),
  email: z.string().email("Invalid email address.").optional().or(z.literal('')),
  phone_no: z.string().min(10, "Phone number is required."),
  phone_type: z.string().min(1, "Phone type is required."),
});

function AppLayout({ children, calls }: { children: React.ReactNode, calls: Call[] }) {
    const getContactName = (call: Call) => {
        if (call.direction === 'inbound') {
            return call.meta_data?.from_name || call.from;
        }
        return call.meta_data?.to_name || call.to;
    };

    const getUniqueRecentCalls = (calls: Call[]) => {
        const uniqueContacts: { [key: string]: Call } = {};
        calls.forEach(call => {
            const contactIdentifier = getContactName(call);
            if (!uniqueContacts[contactIdentifier]) {
                uniqueContacts[contactIdentifier] = call;
            }
        });
        return Object.values(uniqueContacts);
    };

    const recentCalls = getUniqueRecentCalls(calls);

    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarContent className="p-0 flex flex-col">
                    <div className="p-4 flex items-center justify-between h-16 border-b shrink-0">
                       <Link href="/dashboard/ecommerce" className="flex items-center gap-2">
                           <Logo className="h-8 w-8 text-primary" />
                           <span className="text-xl font-bold text-foreground">
                                CallSync
                           </span>
                       </Link>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <div className="p-4">
                          <Button variant="ghost" className="w-full justify-start text-lg h-12" asChild>
                             <Link href="/app">
                                <Inbox className="mr-3 h-5 w-5" />
                                Inbox
                            </Link>
                          </Button>
                        </div>
                        <nav className="space-y-2 px-4 py-4">
                          <Button variant="ghost" className="w-full justify-start h-10 bg-primary/10 text-primary" asChild>
                            <Link href="/contacts">
                                <Users className="mr-3 h-5 w-5" />
                                Contacts
                            </Link>
                          </Button>
                          <Button variant="ghost" className="w-full justify-start h-10">
                            <Hash className="mr-3 h-5 w-5" />
                            All Channels
                          </Button>
                          <Button variant="ghost" className="w-full justify-start h-10">
                            <MessageSquare className="mr-3 h-5 w-5" />
                            Threads
                          </Button>
                        </nav>
                        <div className="flex flex-col min-h-0">
                          <h3 className="px-4 text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">
                            Recents
                          </h3>
                           <div className="flex-1 overflow-y-auto px-2">
                                {recentCalls.slice(0, 15).map((call) => {
                                    const contactName = getContactName(call);
                                    const initial = contactName ? contactName.charAt(0).toUpperCase() : '?';
                                    return (
                                        <div
                                            key={call.id}
                                            className="flex items-center gap-3 p-2 rounded-md hover:bg-muted"
                                        >
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback>
                                                    {initial}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 truncate">
                                                <p className="text-sm font-medium">{contactName}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </SidebarContent>
            </Sidebar>
            <SidebarInset>
                {children}
            </SidebarInset>
        </SidebarProvider>
    )
}

export default function ContactsPage() {
  const { user, logout } = useAuth();
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : '?';
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const { toast } = useToast();

  const [isSmsOpen, setIsSmsOpen] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  const { device, isDeviceReady } = useTwilio();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [callLogs, setCallLogs] = useState<Call[]>([]);


  const form = useForm<z.infer<typeof contactSchema>>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", phone_no: "", phone_type: "mobile" },
  });

  useEffect(() => {
    if (user?.company_id) {
      fetchContacts();
    }
  }, [user]);

  const fetchContacts = async () => {
    if (!user?.company_id) return;
    setLoading(true);
    try {
      const data = await getContacts(user.company_id);
      setContacts(data || []);
    } catch (error) {
      toast({ title: "Error", description: "Could not fetch contacts.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
        if (!user) return;
        setLoadingDepartments(true);
        try {
            const isAdmin = user.role_id === 1 || user.role_id === 2;
            const [fetchedDepts, fetchedCallLogs] = await Promise.all([
                 (isAdmin && user.company_id
                    ? getDepartments(user.company_id)
                    : getUserDepartments(user.id)),
                getCallLogs()
            ]);

            setDepartments(Array.isArray(fetchedDepts) ? fetchedDepts : []);
            setCallLogs(Array.isArray(fetchedCallLogs) ? fetchedCallLogs : []);

        } catch (error) {
            toast({ title: "Error", description: "Failed to load initial data.", variant: "destructive" });
        } finally {
            setLoadingDepartments(false);
        }
    };
    fetchInitialData();
  }, [user, toast]);

  const handleDepartmentChange = useCallback(async (departmentId: string) => {
    if (!departmentId) {
        setPhoneNumbers([]);
        return;
    };
    setLoadingNumbers(true);
    try {
        const numbers = await getPhoneNumbers(Number(departmentId));
        setPhoneNumbers(numbers);
    } catch (error) {
        toast({ title: "Error", description: "Failed to load phone numbers for this department.", variant: "destructive" });
        setPhoneNumbers([]);
    } finally {
        setLoadingNumbers(false);
    }
  }, [toast]);

  const handleMakeCall = async (number: string, fromNumber?: string) => {
    if (!device || !isDeviceReady) {
        toast({ title: "Twilio Error", description: "Twilio Device not ready. Please connect first.", variant: 'destructive'});
        return;
    }
    try {
        const params: { To: string, From?: string } = { To: number };
        if (fromNumber) {
            params.From = fromNumber;
        }
        await device.connect({ params });
    } catch (error) {
        console.error("Error making call:", error);
        toast({ title: "Call Error", description: "Failed to make call. See console for details.", variant: 'destructive'});
    }
  };


  const handleDialogOpen = (contact: Contact | null = null) => {
    setEditingContact(contact);
    if (contact) {
      form.reset(contact);
    } else {
      form.reset({ name: "", email: "", phone_no: "", phone_type: "mobile" });
    }
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingContact(null);
    form.reset();
  };

  const onSubmit = async (values: z.infer<typeof contactSchema>) => {
    if (!user?.company_id) return;
    try {
      if (editingContact) {
        await updateContact(editingContact.id, { ...values, company_id: user.company_id });
        toast({ title: "Success", description: "Contact updated successfully." });
      } else {
        await createContact({ ...values, company_id: user.company_id });
        toast({ title: "Success", description: "Contact created successfully." });
      }
      fetchContacts();
      handleDialogClose();
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to save contact.", variant: "destructive" });
    }
  };
  
  const handleDelete = async (contactId: number) => {
    try {
        await deleteContact(contactId);
        toast({ title: "Success", description: "Contact deleted successfully." });
        fetchContacts();
    } catch (error) {
        toast({ title: "Error", description: "Failed to delete contact.", variant: "destructive" });
    }
  }

  return (
    <AppLayout calls={callLogs}>
        <div className="flex flex-col min-h-screen">
            <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background shadow-sm">
                <div className="flex items-center gap-4">
                    <SidebarTrigger className="md:hidden" />
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search or type command..." className="pl-9 w-full md:w-96" />
                        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 md:flex">
                            <span className="text-xs">⌘</span>K
                        </kbd>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <Dialer
                        onMakeCall={handleMakeCall}
                        departments={departments}
                        phoneNumbers={phoneNumbers}
                        onDepartmentChange={handleDepartmentChange}
                        loadingDepartments={loadingDepartments}
                        loadingNumbers={loadingNumbers}
                     >
                       <Button variant="ghost" size="icon"><Phone className="h-5 w-5" /></Button>
                     </Dialer>
                     <Button variant="ghost" size="icon" onClick={() => setIsSmsOpen(true)}><MessageSquare className="h-5 w-5" /></Button>
                     <Button variant="ghost" size="icon" onClick={() => setIsVideoOpen(true)}><Video className="h-5 w-5" /></Button>
                     <HardwareSettings />
                     
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={`https://placehold.co/100x100.png?text=${userInitial}`} alt={user?.name} />
                                    <AvatarFallback>{userInitial}</AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                                <Link href="/profile">
                                    <Settings className="mr-2" />
                                    <span>Profile</span>
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={logout}>
                                <LogOut className="mr-2" />
                                <span>Logout</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

          <main className="flex-1 p-4 md:p-8 bg-muted/40">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Company Contacts</CardTitle>
                  <CardDescription>A list of all contacts for your company.</CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                     <Button onClick={() => handleDialogOpen()}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Contact
                     </Button>
                  </DialogTrigger>
                  <DialogContent onInteractOutside={handleDialogClose}>
                      <DialogHeader>
                      <DialogTitle>{editingContact ? 'Edit' : 'Add New'} Contact</DialogTitle>
                      </DialogHeader>
                      <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                          <FormField control={form.control} name="name" render={({ field }) => (
                          <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="e.g. John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                          )}/>
                          <FormField control={form.control} name="email" render={({ field }) => (
                          <FormItem><FormLabel>Email (Optional)</FormLabel><FormControl><Input type="email" placeholder="e.g. john@example.com" {...field} /></FormControl><FormMessage /></FormItem>
                          )}/>
                          <FormField control={form.control} name="phone_no" render={({ field }) => (
                          <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="+1234567890" {...field} /></FormControl><FormMessage /></FormItem>
                          )}/>
                          <FormField control={form.control} name="phone_type" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Phone Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                  <SelectItem value="mobile">Mobile</SelectItem>
                                  <SelectItem value="work">Work</SelectItem>
                                  <SelectItem value="home">Home</SelectItem>
                              </SelectContent>
                              </Select>
                              <FormMessage />
                          </FormItem>
                          )}/>
                          <DialogFooter>
                          <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                          <Button type="submit">Save Contact</Button>
                          </DialogFooter>
                      </form>
                      </Form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {loading ? <p>Loading...</p> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone Number</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contacts.length > 0 ? contacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium">{contact.name}</TableCell>
                          <TableCell>{contact.email || 'N/A'}</TableCell>
                          <TableCell>{contact.phone_no}</TableCell>
                          <TableCell>{contact.phone_type}</TableCell>
                          <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(contact)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                      <AlertDialogHeader>
                                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                              This will permanently delete the contact. This action cannot be undone.
                                          </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDelete(contact.id)}>Delete</AlertDialogAction>
                                      </AlertDialogFooter>
                                  </AlertDialogContent>
                              </AlertDialog>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={5} className="text-center h-24">No contacts found.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </main>
        </div>

        <Dialog open={isSmsOpen} onOpenChange={setIsSmsOpen}>
            <DialogContent>
            <DialogHeader>
                <DialogTitle>New Message</DialogTitle>
                <DialogDescription>
                Select a department and number to send a message from.
                </DialogDescription>
            </DialogHeader>
            <NewMessageForm 
                onClose={() => setIsSmsOpen(false)}
                departments={departments}
                phoneNumbers={phoneNumbers}
                onDepartmentChange={handleDepartmentChange}
                loadingDepartments={loadingDepartments}
                loadingNumbers={loadingNumbers}
            />
            </DialogContent>
        </Dialog>
        
        <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
            <DialogContent>
            <DialogHeader>
                <DialogTitle>New Video Call</DialogTitle>
                <DialogDescription>
                This feature is coming soon.
                </DialogDescription>
            </DialogHeader>
            </DialogContent>
        </Dialog>

    </AppLayout>
  );
}
