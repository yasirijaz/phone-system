
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { User, Company } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { getCompany } from "@/services/companyService";
import { getUsersByCompany, addUserToCompany } from "@/services/userService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, ArrowLeft, Edit, Trash2, Users, Briefcase } from "lucide-react";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";

const userSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  role_id: z.coerce.number({ required_error: "Role is required."}).min(1, "Role is required."),
});

export default function ManageUsersPage() {
  const { user: authUser } = useAuth();
  const router = useRouter();
  const params = useParams();
  const companyId = Number(params.companyId);

  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  useEffect(() => {
    if (authUser?.role_id !== 1 || !companyId) {
      router.replace('/');
      return;
    }
    fetchCompanyAndUsers();
  }, [authUser, companyId, router]);

  const fetchCompanyAndUsers = async () => {
    try {
      setLoading(true);
      const [companyData, usersResponse] = await Promise.all([
        getCompany(companyId),
        getUsersByCompany(companyId)
      ]);
      setCompany(companyData);
      setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
    } catch (error) {
      toast({
        title: "Error fetching data",
        description: "Could not load company and user data. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleDialogClose = () => {
    setIsDialogOpen(false);
    form.reset();
  }

  const onSubmit = async (values: z.infer<typeof userSchema>) => {
    try {
      await addUserToCompany(companyId, values);
      toast({ title: "Success", description: "User added successfully." });
      fetchCompanyAndUsers();
      handleDialogClose();
    } catch (error: any) {
        const errorMessage = error.response?.data?.message || "An unexpected error occurred.";
        toast({
            title: "Error adding user",
            description: errorMessage,
            variant: "destructive",
        });
    }
  };

  if (authUser?.role_id !== 1) {
    return null;
  }
  
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent><AppSidebar /></SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div className="flex items-center gap-2">
                 <Button variant="ghost" size="icon" asChild>
                    <Link href="/companies">
                      <ArrowLeft />
                    </Link>
                  </Button>
                <h1 className="text-xl font-bold">
                  Manage Users for {company?.name || '...'}
                </h1>
              </div>
            </div>
             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add User
                </Button>
              </DialogTrigger>
              <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                     <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="e.g. John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                     )}/>
                     <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="e.g. john@acme.com" {...field} /></FormControl><FormMessage /></FormItem>
                     )}/>
                     <FormField control={form.control} name="password" render={({ field }) => (
                        <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="******" {...field} /></FormControl><FormMessage /></FormItem>
                     )}/>
                     <FormField control={form.control} name="role_id" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="2">Admin</SelectItem>
                              <SelectItem value="3">User</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                     )}/>
                    <DialogFooter>
                      <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                      <Button type="submit">Add User</Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </header>

          <main className="flex-1 p-4 md:p-8 space-y-8 bg-muted/40">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{users.length}</div>
                        <p className="text-xs text-muted-foreground">in this company</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Departments</CardTitle>
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{company?.departments?.length || 0}</div>
                        <p className="text-xs text-muted-foreground">configured</p>
                    </CardContent>
                </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Company Users</CardTitle>
                <CardDescription>A list of all users registered under {company?.name}.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? <p>Loading...</p> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.isArray(users) && users.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.name}</TableCell>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>
                              <Badge variant={u.role_id === 2 ? 'default' : 'secondary'}>
                                {u.role_id === 2 ? 'Admin' : 'User'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon"><Edit className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!Array.isArray(users) || users.length === 0) && (
                          <TableRow><TableCell colSpan={4} className="text-center h-24">No users found for this company.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
