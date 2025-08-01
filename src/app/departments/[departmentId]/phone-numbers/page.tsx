
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, PlusCircle, Edit, Trash2 } from "lucide-react";
import type { PhoneNumber } from "@/types";
import { getPhoneNumbers, createPhoneNumber, updatePhoneNumber, deletePhoneNumber } from "@/services/phoneNumberService";
import AppHeader from "@/components/app-header";

const phoneNumberSchema = z.object({
  phone_no: z.string().min(10, "Phone number is required."),
  type: z.string().min(1, "Type is required."),
  label: z.string().min(2, "Label is required."),
});

export default function PhoneNumbersPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const departmentId = Number(params.departmentId);

  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingNumber, setEditingNumber] = useState<PhoneNumber | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof phoneNumberSchema>>({
    resolver: zodResolver(phoneNumberSchema),
    defaultValues: { phone_no: "", type: "local", label: "" },
  });

  useEffect(() => {
    if (user && ![1, 2].includes(user.role_id ?? 0)) {
        router.replace('/');
        return;
    }
    if (departmentId) {
      fetchPhoneNumbers();
    }
  }, [user, departmentId, router]);

  const fetchPhoneNumbers = async () => {
    try {
      setLoading(true);
      const data = await getPhoneNumbers(departmentId);
      setPhoneNumbers(data || []);
    } catch (error) {
      toast({ title: "Error", description: "Could not fetch phone numbers.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDialogOpen = (phoneNumber: PhoneNumber | null = null) => {
    setEditingNumber(phoneNumber);
    if (phoneNumber) {
      form.reset(phoneNumber);
    } else {
      form.reset({ phone_no: "", type: "local", label: "" });
    }
    setIsDialogOpen(true);
  };
  
  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingNumber(null);
    form.reset();
  }

  const onSubmit = async (values: z.infer<typeof phoneNumberSchema>) => {
    try {
      if (editingNumber) {
        await updatePhoneNumber(editingNumber.id, { ...values, department_id: departmentId });
        toast({ title: "Success", description: "Phone number updated." });
      } else {
        await createPhoneNumber({ ...values, department_id: departmentId });
        toast({ title: "Success", description: "Phone number added." });
      }
      fetchPhoneNumbers();
      handleDialogClose();
    } catch (error) {
      toast({ title: "Error", description: "Failed to save phone number.", variant: "destructive" });
    }
  };
  
  const handleDelete = async (id: number) => {
    try {
      await deletePhoneNumber(id);
      toast({ title: "Success", description: "Phone number deleted." });
      fetchPhoneNumbers();
    } catch (error) {
       toast({ title: "Error", description: "Failed to delete phone number.", variant: "destructive" });
    }
  }
  
  if (user && ![1, 2].includes(user.role_id ?? 0)) {
    return null;
  }

  return (
    <SidebarProvider>
      <Sidebar><SidebarContent><AppSidebar /></SidebarContent></Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
            <AppHeader user={user} logout={logout} />
          <header className="sticky top-16 z-20 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-4">
               <Button variant="ghost" size="icon" asChild>
                <Link href="/departments"><ArrowLeft /></Link>
              </Button>
              <h1 className="text-xl font-bold">Department Phone Numbers</h1>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleDialogOpen()}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Number
                </Button>
              </DialogTrigger>
              <DialogContent onInteractOutside={handleDialogClose}>
                <DialogHeader><DialogTitle>{editingNumber ? "Edit" : "Add"} Phone Number</DialogTitle></DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                     <FormField control={form.control} name="phone_no" render={({ field }) => (
                        <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="+1234567890" {...field} /></FormControl><FormMessage /></FormItem>
                     )}/>
                     <FormField control={form.control} name="label" render={({ field }) => (
                        <FormItem><FormLabel>Label</FormLabel><FormControl><Input placeholder="e.g. Main Sales Line" {...field} /></FormControl><FormMessage /></FormItem>
                     )}/>
                     <FormField control={form.control} name="type" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="local">Local</SelectItem>
                              <SelectItem value="toll-free">Toll-Free</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                     )}/>
                    <DialogFooter>
                      <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                      <Button type="submit">Save</Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </header>

          <main className="flex-1 p-4 md:p-8 bg-muted/40">
            <Card>
              <CardHeader>
                <CardTitle>Assigned Numbers</CardTitle>
                <CardDescription>Phone numbers assigned to this department.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? <p>Loading...</p> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Number</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {phoneNumbers.length > 0 ? phoneNumbers.map((num) => (
                        <TableRow key={num.id}>
                          <TableCell className="font-medium">{num.phone_no}</TableCell>
                          <TableCell>{num.label}</TableCell>
                          <TableCell>{num.type}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(num)}><Edit className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the phone number.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(num.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow><TableCell colSpan={4} className="text-center h-24">No phone numbers found.</TableCell></TableRow>
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
