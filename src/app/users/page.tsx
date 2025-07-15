
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { User, Department, Assignment, Company } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { getUsersByCompany, getUserAssignments, assignUserToDepartment, removeUserFromDepartment } from "@/services/userService";
import { getDepartments } from "@/services/departmentService";
import { getCompanies } from "@/services/companyService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";

const assignmentSchema = z.object({
  user_id: z.coerce.number({ required_error: "User is required." }).min(1, "User is required."),
  department_id: z.coerce.number({ required_error: "Department is required." }).min(1, "Department is required."),
});

const defaultAssignmentValues = {
    user_id: 0,
    department_id: 0,
};

export default function AssignDepartmentPage() {
  const { user: authUser } = useAuth();
  const searchParams = useSearchParams();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof assignmentSchema>>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: defaultAssignmentValues,
  });
  
  useEffect(() => {
    const companyIdFromUrl = searchParams.get('companyId');
    if (companyIdFromUrl) {
      const id = Number(companyIdFromUrl);
      if(!isNaN(id)) {
        setSelectedCompanyId(id);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authUser) return;
    if (authUser.role_id === 1) {
      getCompanies(1).then(res => setCompanies(res.data));
    } else if (authUser.company_id) {
      setSelectedCompanyId(authUser.company_id);
    }
  }, [authUser]);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchAllData(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  const fetchAllData = async (companyId: number) => {
    setLoading(true);
    try {
      await Promise.all([
        fetchCompanyUsers(companyId),
        fetchCompanyDepartments(companyId),
        fetchUserAssignments(companyId)
      ]);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load company data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }
  
  const fetchCompanyUsers = async(companyId: number) => {
     try {
       const res = await getUsersByCompany(companyId);
       setUsers(res.data || []);
     } catch (err) {
       toast({ title: "Error", description: "Failed to load users.", variant: "destructive" });
     }
  }

  const fetchCompanyDepartments = async (companyId: number) => {
    try {
      const res = await getDepartments(companyId);
      setDepartments(res || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load departments.", variant: "destructive" });
    }
  }

  const fetchUserAssignments = async (companyId: number) => {
    try {
      const res = await getUserAssignments(companyId);
      setAssignments(res.data || []);
    } catch (err) {
      toast({ title: "Error", description: "Failed to load assignments.", variant: "destructive" });
    }
  }

  const handleCompanyChange = (companyId: string) => {
    const id = Number(companyId);
    setSelectedCompanyId(id);
    setUsers([]);
    setDepartments([]);
    setAssignments([]);
  }

  const onSubmit = async (values: z.infer<typeof assignmentSchema>) => {
    if (!selectedCompanyId) return;
    try {
      await assignUserToDepartment(selectedCompanyId, values.department_id, values.user_id);
      toast({ title: "Success", description: "User assigned to department." });
      fetchUserAssignments(selectedCompanyId); // Refresh assignments list
      form.reset(defaultAssignmentValues);
    } catch (error: any) {
      toast({ title: "Error", description: error.response?.data?.message || "Failed to assign user.", variant: "destructive" });
    }
  };
  
  const handleRemoveAssignment = async (assignment: Assignment) => {
    if(!selectedCompanyId) return;
    try {
      await removeUserFromDepartment(selectedCompanyId, assignment.department_id, assignment.user_id);
      toast({ title: "Success", description: "User removed from department." });
      fetchUserAssignments(selectedCompanyId);
    } catch(error) {
       toast({ title: "Error", description: "Failed to remove user from department.", variant: "destructive" });
    }
  }
  
  if (authUser?.role_id !== 1 && authUser?.role_id !== 2) {
      return (
        <div className="flex h-screen items-center justify-center">
            <p>You do not have permission to view this page.</p>
        </div>
      )
  }

  return (
    <SidebarProvider>
      <Sidebar><SidebarContent><AppSidebar /></SidebarContent></Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-xl font-bold">User Assignments</h1>
            </div>
            {authUser?.role_id === 1 && (
              <Select onValueChange={handleCompanyChange} value={selectedCompanyId ? String(selectedCompanyId) : ""}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Select a company to manage assignments" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </header>
          <main className="flex-1 p-4 md:p-8 bg-muted/40 space-y-8">
            {selectedCompanyId && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Assign User to Department</CardTitle>
                    <CardDescription>Select a user and a department to create a new assignment.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <FormField control={form.control} name="user_id" render={({ field }) => (
                          <FormItem>
                            <FormLabel>User</FormLabel>
                            <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value === 0 ? "" : String(field.value)}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger></FormControl>
                              <SelectContent>{users.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}/>
                        <FormField control={form.control} name="department_id" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Department</FormLabel>
                            <Select onValueChange={(value) => field.onChange(Number(value))} value={field.value === 0 ? "" : String(field.value)}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select a department" /></SelectTrigger></FormControl>
                              <SelectContent>{departments.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}/>
                        <Button type="submit">Assign User</Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Current Assignments</CardTitle>
                    <CardDescription>A list of all users and their assigned departments.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? <p>Loading assignments...</p> : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>User</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {assignments.length > 0 ? (
                            assignments.map(a => (
                              <TableRow key={a.id}>
                                <TableCell>{a.user_name}</TableCell>
                                <TableCell>{a.department_name}</TableCell>
                                <TableCell className="text-right">
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will remove the user from the department.</AlertDialogDescription></AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleRemoveAssignment(a)}>Remove</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow><TableCell colSpan={3} className="text-center h-24">No assignments found for this company.</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
             {!selectedCompanyId && authUser?.role_id === 1 && (
                <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">Please select a company to view assignments.</p>
                </div>
            )}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
