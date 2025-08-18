
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { User, Company, Department, Assignment } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { getCompany } from "@/services/companyService";
import { getDepartments } from "@/services/departmentService";
import { getUsersByCompany, addUserToCompany, assignUserToDepartment, removeUserFromDepartment, updateUser, deleteUser } from "@/services/userService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, ArrowLeft, Edit, Trash2, Users, Briefcase } from "lucide-react";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import AppHeader from "@/components/app-header";

const userSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters.").optional().or(z.literal('')),
  role_id: z.coerce.number({ required_error: "Role is required."}).min(1, "Role is required."),
});

const assignmentSchema = z.object({
  department_id: z.coerce.number().min(1, "Please select a department."),
});

export default function ManageUsersPage() {
  const { user: authUser, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const companyId = Number(params.companyId);

  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();

  const userForm = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", password: "", role_id: 3 },
  });

  const assignmentForm = useForm<z.infer<typeof assignmentSchema>>({
    resolver: zodResolver(assignmentSchema),
  });

  useEffect(() => {
    if ((authUser?.role_id !== 1 && authUser?.role_id !== 2) || !companyId) {
      router.replace('/');
      return;
    }
    fetchData();
  }, [authUser, companyId, router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [companyData, usersResponse, departmentsResponse] = await Promise.all([
        getCompany(companyId),
        getUsersByCompany(companyId),
        getDepartments(companyId)
      ]);
      setCompany(companyData);
      setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
      setDepartments(Array.isArray(departmentsResponse) ? departmentsResponse : []);
    } catch (error) {
      toast({
        title: "Error fetching data",
        description: "Could not load company and user data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleUserDialogOpen = (user: User | null = null) => {
    setEditingUser(user);
    if (user) {
      userForm.reset({
        name: user.name,
        email: user.email,
        password: "",
        role_id: user.role_id,
      });
    } else {
      userForm.reset({ name: "", email: "", password: "", role_id: 3 });
    }
    setIsUserDialogOpen(true);
  }
  
  const handleUserDialogClose = () => {
    setIsUserDialogOpen(false);
    userForm.reset();
    setEditingUser(null);
  }
  
  const handleAssignmentDialogClose = () => {
    setIsAssignmentDialogOpen(false);
    assignmentForm.reset();
    setSelectedUser(null);
  };
  
  const handleOpenAssignmentDialog = (user: User) => {
    setSelectedUser(user);
    setIsAssignmentDialogOpen(true);
  };

  const onUserSubmit = async (values: z.infer<typeof userSchema>) => {
    try {
      if (editingUser) {
        const payload: { name: string, email: string, role_id: number, password?: string } = {
          name: values.name,
          email: values.email,
          role_id: values.role_id,
        };
        if (values.password) {
          payload.password = values.password;
        }
        await updateUser(editingUser.id, payload);
        toast({ title: "Success", description: "User updated successfully." });
      } else {
        await addUserToCompany(companyId, values);
        toast({ title: "Success", description: "User added successfully." });
      }
      fetchData();
      handleUserDialogClose();
    } catch (error: any) {
        const errorMessage = error.response?.data?.message || "An unexpected error occurred.";
        toast({
            title: `Error ${editingUser ? 'updating' : 'adding'} user`,
            description: errorMessage,
            variant: "destructive",
        });
    }
  };
  
  const handleDeleteUser = async (userId: number) => {
    try {
      await deleteUser(userId);
      toast({ title: "Success", description: "User deleted successfully." });
      fetchData();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "Failed to delete user.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };
  
  const onAssignmentSubmit = async (values: z.infer<typeof assignmentSchema>) => {
    if (!selectedUser) return;
    try {
      await assignUserToDepartment(companyId, values.department_id, selectedUser.id);
      toast({ title: "Success", description: "User assigned to department." });
      fetchData();
      handleAssignmentDialogClose();
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to assign user.", variant: "destructive" });
    }
  };
  

  if (authUser?.role_id !== 1 && authUser?.role_id !== 2) {
    return null;
  }
  
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent><AppSidebar /></SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          <AppHeader 
              user={authUser} 
              logout={logout} 
              pageTitle={`Manage Users for ${company?.name || '...'}`}
          />
          <header className="sticky top-16 z-20 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-4">
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
             <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleUserDialogOpen(null)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add User
                </Button>
              </DialogTrigger>
              <DialogContent onInteractOutside={handleUserDialogClose} className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
                </DialogHeader>
                <Form {...userForm}>
                  <form onSubmit={userForm.handleSubmit(onUserSubmit)} className="space-y-4">
                     <FormField control={userForm.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="e.g. John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                     )}/>
                     <FormField control={userForm.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="e.g. john@acme.com" {...field} /></FormControl><FormMessage /></FormItem>
                     )}/>
                     <FormField control={userForm.control} name="password" render={({ field }) => (
                        <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder={editingUser ? 'Leave blank to keep current' : '******'} {...field} /></FormControl><FormMessage /></FormItem>
                     )}/>
                     <FormField control={userForm.control} name="role_id" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select onValueChange={field.onChange} value={String(field.value)}>
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
                      <DialogClose asChild><Button type="button" variant="secondary" onClick={handleUserDialogClose}>Cancel</Button></DialogClose>
                      <Button type="submit">{editingUser ? 'Save Changes' : 'Add User'}</Button>
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
                        <div className="text-2xl font-bold">{departments?.length || 0}</div>
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
                              <Button variant="ghost" size="icon" onClick={() => handleOpenAssignmentDialog(u)}><Briefcase className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleUserDialogOpen(u)}><Edit className="h-4 w-4" /></Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action will permanently delete the user.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteUser(u.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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
        
        <Dialog open={isAssignmentDialogOpen} onOpenChange={setIsAssignmentDialogOpen}>
          <DialogContent onInteractOutside={handleAssignmentDialogClose}>
            <DialogHeader>
              <DialogTitle>Assign Department for {selectedUser?.name}</DialogTitle>
              <DialogDescription>Select a department to assign this user to.</DialogDescription>
            </DialogHeader>
            <Form {...assignmentForm}>
              <form onSubmit={assignmentForm.handleSubmit(onAssignmentSubmit)} className="space-y-4">
                <FormField
                  control={assignmentForm.control}
                  name="department_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue="">
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={String(dept.id)}>{dept.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={handleAssignmentDialogClose}>Cancel</Button>
                  <Button type="submit">Assign</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

      </SidebarInset>
    </SidebarProvider>
  );
}

    