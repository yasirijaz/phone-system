
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
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { InAppSidebar } from "@/components/in-app-sidebar";
import AppHeader from "@/components/app-header";
import { formatPhoneNumber } from "@/lib/utils";

const contactSchema = z.object({
  name: z.string().min(2, "Name is required."),
  email: z.string().email("Invalid email address.").optional().or(z.literal('')),
  phone_no: z.string().min(10, "Phone number is required."),
  phone_type: z.string().min(1, "Phone type is required."),
});

export default function ContactsPage() {
  const { user, logout } = useAuth();
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
      form.reset({
        ...contact,
        phone_no: contact.phone_no.replace(/^\+1/, ''), // Remove +1 for editing
      });
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
      const phoneWithCountryCode = `+1${values.phone_no.replace(/\D/g, '')}`;
      const payload = { ...values, phone_no: phoneWithCountryCode };

      if (editingContact) {
        await updateContact(editingContact.id, { ...payload, company_id: user.company_id });
        toast({ title: "Success", description: "Contact updated successfully." });
      } else {
        await createContact({ ...payload, company_id: user.company_id });
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
    <SidebarProvider>
      <Sidebar>
          <InAppSidebar />
      </Sidebar>
      <SidebarInset>
          <div className="flex flex-col min-h-screen">
            <AppHeader user={user} logout={logout} />

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
                              <FormItem>
                                <FormLabel>Phone Number</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="(123) 456-7890" 
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
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
                              <TableCell>{formatPhoneNumber(contact.phone_no)}</TableCell>
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
      </SidebarInset>
    </SidebarProvider>
  );
}
