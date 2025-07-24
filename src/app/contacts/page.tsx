
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Contact } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { getContacts, createContact, updateContact, deleteContact } from "@/services/contactService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Hash, Inbox, MessageSquare, Users, Edit, Trash2 } from "lucide-react";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import Link from "next/link";
import { Logo } from "@/components/icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const contactSchema = z.object({
  name: z.string().min(2, "Name is required."),
  email: z.string().email("Invalid email address.").optional().or(z.literal('')),
  phone_no: z.string().min(10, "Phone number is required."),
  phone_type: z.string().min(1, "Phone type is required."),
});

const recentContacts = [
  { name: "(321) 799-6096", initial: "A" },
  { name: "Ideal GA", initial: "I", color: "bg-green-500" },
  { name: "Susan Buser", initial: "S", color: "bg-green-500" },
  { name: "(407) 269-8808", initial: "A" },
  { name: "(205) 916-8373", initial: "A" },
  { name: "(407) 410-4734", initial: "A" },
  { name: "Orlando FL", initial: "O", color: "bg-blue-500" },
  { name: "(813) 544-4201", initial: "M" },
  { name: "Metuchen NJ", initial: "M", color: "bg-yellow-500" },
  { name: "WindshieldHUB", initial: "W", color: "bg-orange-500" },
  { name: "(737) 204-9493", initial: "A" },
  { name: "(713) 804-8089", initial: "A" },
  { name: "Kashif Raza", initial: "K", color: "bg-yellow-500", status: "DND" },
  { name: "WindshieldHUB SMS", initial: "W", color: "bg-orange-500" },
  { name: "(407) 250-1607", initial: "A" },
];


function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarContent className="p-0">
                    <div className="p-4 flex items-center justify-between h-16 border-b">
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
                            {recentContacts.map((contact, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted"
                              >
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className={contact.color}>
                                    {contact.initial}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 truncate">
                                  <p className="text-sm font-medium">{contact.name}</p>
                                  {contact.status && (
                                    <p className="text-xs text-destructive">{contact.status}</p>
                                  )}
                                </div>
                              </div>
                            ))}
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
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const { toast } = useToast();

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
    <AppLayout>
        <div className="flex flex-col min-h-screen">
          <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="md:hidden" />
              <h1 className="text-xl font-bold">Contacts</h1>
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
          </header>

          <main className="flex-1 p-4 md:p-8 bg-muted/40">
            <Card>
              <CardHeader>
                <CardTitle>Company Contacts</CardTitle>
                <CardDescription>A list of all contacts for your company.</CardDescription>
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
    </AppLayout>
  );
}
