
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { User } from "@/types";
import { getDepartmentUsers, getDepartments } from "@/services/departmentService";
import { getUsersByCompany, assignUserToDepartment, removeUserFromDepartment } from "@/services/userService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Trash2, PlusCircle } from "lucide-react";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import AppHeader from "@/components/app-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { events } from '@/lib/events';

const assignmentSchema = z.object({
  user_id: z.coerce.number({ required_error: "User is required." }).min(1, "User is required."),
});

export default function DepartmentUsersPage() {
  const router = useRouter();
  const params = useParams();
  const { user: authUser, logout } = useAuth();
  const departmentId = Number(params.departmentId);
  const companyId = authUser?.company_id;

  const [departmentUsers, setDepartmentUsers] = useState<any[]>([]);
  const [allCompanyUsers, setAllCompanyUsers] = useState<User[]>([]);
  const [departmentName, setDepartmentName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof assignmentSchema>>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: { user_id: 0 },
  });

  useEffect(() => {
    if (companyId && !isNaN(departmentId)) {
      fetchAllData();
    }
  }, [departmentId, companyId]);

  // Handle DND status change notifications
  useEffect(() => {
    const handleDndStatusChange = (data: any) => {
      console.log("🔄 Updating department users DND status directly:", data);
      
      // Update department users list directly without API call
      setDepartmentUsers(prevUsers => 
        prevUsers.map(user => 
          user.user.id === data.user_id 
            ? { ...user, is_dnd: data.is_dnd ? 1 : 0 }
            : user
        )
      );
      
      // Also update all company users list
      setAllCompanyUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === data.user_id 
            ? { ...user, is_dnd: data.is_dnd }
            : user
        )
      );
    };

    events.on('refreshOperators', handleDndStatusChange);
    return () => events.off('refreshOperators', handleDndStatusChange);
  }, []);

  // Handle in-call status change notifications
  useEffect(() => {
    const handleInCallStatusChange = (data: any) => {
      console.log("🔄 Updating department users in-call status directly:", data);
      
      // Update department users list directly without API call
      setDepartmentUsers(prevUsers => 
        prevUsers.map(user => 
          user.user.id === data.user_id 
            ? { ...user, user: { ...user.user, in_call: data.in_call ? 1 : 0 } }
            : user
        )
      );
      
      // Also update all company users list
      setAllCompanyUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === data.user_id 
            ? { ...user, in_call: data.in_call }
            : user
        )
      );
    };

    events.on('refreshOperators', handleInCallStatusChange);
    return () => events.off('refreshOperators', handleInCallStatusChange);
  }, []);

  const fetchAllData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [deptUsersResponse, companyUsersResponse, allDepartmentsResponse] = await Promise.all([
        getDepartmentUsers(companyId, departmentId),
        getUsersByCompany(companyId),
        getDepartments(companyId)
      ]);
      
      const currentDept = allDepartmentsResponse.find(d => d.id === departmentId);
      if (currentDept) {
        setDepartmentName(currentDept.name);
      }

      setDepartmentUsers(Array.isArray(deptUsersResponse.users) ? deptUsersResponse.users : []);
      setAllCompanyUsers(Array.isArray(companyUsersResponse.data) ? companyUsersResponse.data : []);
    } catch (error) {
      toast({
        title: "Error fetching data",
        description: "Could not load user data. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const onSubmit = async (values: z.infer<typeof assignmentSchema>) => {
    if (!companyId) return;
    try {
        await assignUserToDepartment(companyId, departmentId, values.user_id);
        toast({ title: "Success", description: "User assigned to department successfully." });
        fetchAllData(); // Refresh both lists
        form.reset({ user_id: 0 });
    } catch (error: any) {
        toast({
            title: "Error assigning user",
            description: error.response?.data?.message || "An unexpected error occurred.",
            variant: "destructive",
        });
    }
  };

  const handleRemoveUser = async (userId: number) => {
    if (!companyId) return;
    try {
      await removeUserFromDepartment(companyId, departmentId, userId);
      toast({ title: "Success", description: "User removed from department." });
      fetchAllData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove user from department.", variant: "destructive" });
    }
  };

  const availableUsers = allCompanyUsers.filter(
    (companyUser) => !departmentUsers.some((deptUser) => deptUser.id === companyUser.id)
  );

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent><AppSidebar /></SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
            <AppHeader user={authUser} logout={logout} />
          <header className="sticky top-16 z-20 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                 <Button variant="ghost" size="icon" asChild>
                    <Link href="/departments">
                      <ArrowLeft />
                    </Link>
                  </Button>
                <h1 className="text-xl font-bold">
                  Department Users
                </h1>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8 space-y-8 bg-muted/40">
             <Card>
              <CardHeader>
                <CardTitle>Add User to {departmentName ? `the ${departmentName}` : 'Department'}</CardTitle>
                <CardDescription>Select a user from your company to add them to this department.</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-end gap-4">
                     <FormField
                        control={form.control}
                        name="user_id"
                        render={({ field }) => (
                            <FormItem className="flex-1">
                            <FormLabel>User</FormLabel>
                            <Select onValueChange={field.onChange} value={String(field.value === 0 ? '' : field.value)}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a user to add" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {availableUsers.map((user) => (
                                        <SelectItem key={user.id} value={String(user.id)}>
                                            {user.name} ({user.email})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    <Button type="submit">
                      <PlusCircle className="mr-2 h-4 w-4"/>
                      Add User
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Users in Department</CardTitle>
                <CardDescription>A list of all users assigned to this department.</CardDescription>
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
                        {Array.isArray(departmentUsers) && departmentUsers.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.name}</TableCell>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>
                              <Badge variant={u.role_id === 2 ? 'default' : 'secondary'}>
                                {u.role_id === 1 ? 'Super Owner' : u.role_id === 2 ? 'Admin' : 'User'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
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
                                      This will permanently remove the user from this department.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRemoveUser(u.id)}>
                                      Continue
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!Array.isArray(departmentUsers) || departmentUsers.length === 0) && (
                          <TableRow><TableCell colSpan={4} className="text-center h-24">No users found for this department.</TableCell></TableRow>
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

