
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { User, Department, Assignment, Company } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { getUsersByCompany, assignDepartmentToUser, getUserAssignments, getAssignedDepartmentsForUser } from "@/services/userService";
import { getDepartmentsByCompany } from "@/services/departmentService";
import { getCompanies } from "@/services/companyService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

const assignmentSchema = z.object({
  company_id: z.coerce.number().optional(),
  user_id: z.coerce.number({ required_error: "User is required." }).min(1),
  department_id: z.coerce.number({ required_error: "Department is required." }).min(1),
});

export default function AssignDepartmentPage() {
  const { user: authUser } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignedDepartments, setAssignedDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof assignmentSchema>>({
    resolver: zodResolver(assignmentSchema),
  });

  // Fetch initial data based on role
  useEffect(() => {
    if (!authUser) return;

    if (authUser.role_id === 1) {
      // Super Owner fetches all companies
      getCompanies(1).then(res => setCompanies(res.data));
    } else if (authUser.role_id === 2) {
      // Admin uses their own company
      if (authUser.company_id) {
        setSelectedCompanyId(authUser.company_id);
      }
    } else if (authUser.role_id === 3) {
      // Regular user fetches their assigned departments
      fetchAssignedDepartmentsForUser();
    }
  }, [authUser]);

  // Fetch users, departments, and assignments when a company is selected
  useEffect(() => {
    if (selectedCompanyId) {
      setLoading(true);
      Promise.all([
        getUsersByCompany(selectedCompanyId).then(res => setUsers(res.data || [])),
        getDepartmentsByCompany(selectedCompanyId).then(res => setDepartments(res.departments || [])),
        getUserAssignments(selectedCompanyId).then(res => setAssignments(res.data || [])),
      ]).catch(err => {
        toast({ title: "Error", description: "Failed to load company data.", variant: "destructive" });
      }).finally(() => {
        setLoading(false);
      });
    }
  }, [selectedCompanyId, toast]);

  const fetchAssignedDepartmentsForUser = async () => {
    if (!authUser) return;
    setLoading(true);
    try {
      const data = await getAssignedDepartmentsForUser();
      setAssignedDepartments(data.departments);
    } catch (error) {
      toast({ title: "Error", description: "Could not fetch your departments.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof assignmentSchema>) => {
    try {
      await assignDepartmentToUser(values.user_id, values.department_id);
      toast({ title: "Success", description: "Department assigned successfully." });
      form.reset();
      // Refetch assignments
      if (selectedCompanyId) {
        const res = await getUserAssignments(selectedCompanyId);
        setAssignments(res.data || []);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "An unexpected error occurred.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };
  
  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(Number(companyId));
    // Reset selections
    setUsers([]);
    setDepartments([]);
    setAssignments([]);
    form.reset();
  }
  
  if (loading && authUser?.role_id !== 3) {
     return <p>Loading...</p>;
  }


  const AdminView = () => (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background shadow-sm">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <h1 className="text-xl font-bold">Assign Department</h1>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-8 bg-muted/40 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Assign User to Department</CardTitle>
            <CardDescription>Select a user and a department to create an assignment.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {authUser?.role_id === 1 && (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <Select onValueChange={handleCompanyChange} >
                          <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a company" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companies.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                          </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                  <FormField control={form.control} name="user_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>User</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={String(field.value)} disabled={!selectedCompanyId}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {users.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="department_id" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={String(field.value)} disabled={!selectedCompanyId}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a department" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {departments.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <Button type="submit" disabled={!selectedCompanyId}>Assign Department</Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p>Loading assignments...</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Department</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.length > 0 ? (
                  assignments.map(a => (
                    <TableRow key={a.id}>
                      <TableCell>{a.user_name}</TableCell>
                      <TableCell>{a.department_name}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={2} className="text-center h-24">No assignments found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
  
  const UserView = () => (
     <>
      <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background shadow-sm">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <h1 className="text-xl font-bold">My Departments</h1>
        </div>
      </header>
       <main className="flex-1 p-4 md:p-8 bg-muted/40">
        <Card>
          <CardHeader>
            <CardTitle>Your Assigned Departments</CardTitle>
            <CardDescription>Here are the departments you are currently a member of.</CardDescription>
          </CardHeader>
          <CardContent>
             {loading ? <p>Loading your departments...</p> : (
                <div className="space-y-4">
                    {assignedDepartments.length > 0 ? (
                        assignedDepartments.map(dept => (
                            <div key={dept.id} className="flex items-center justify-between p-4 border rounded-lg">
                                <span className="font-medium">{dept.name}</span>
                                <Badge variant="secondary">Member</Badge>
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-muted-foreground p-8">You are not assigned to any departments yet.</div>
                    )}
                </div>
             )}
          </CardContent>
        </Card>
       </main>
     </>
  )

  return (
    <SidebarProvider>
      <Sidebar><SidebarContent><AppSidebar /></SidebarContent></Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          {authUser?.role_id === 3 ? <UserView /> : <AdminView />}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
