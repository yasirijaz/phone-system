
"use client";

import { useState, useEffect } from "react";
import type { User, Assignment, Company, Department } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { getUserAssignments } from "@/services/userService";
import { getCompanies } from "@/services/companyService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';

export default function AssignDepartmentPage() {
  const { user: authUser } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Fetch initial data based on role
  useEffect(() => {
    if (!authUser) return;

    if (authUser.role_id === 1) {
      // Super Owner fetches all companies
      getCompanies(1).then(res => setCompanies(res.data));
    } else {
      // Admin or User uses their own company_id
      if (authUser.company_id) {
        setSelectedCompanyId(authUser.company_id);
      }
    }
  }, [authUser]);

  // Fetch assignments when a company is selected
  useEffect(() => {
    if (selectedCompanyId) {
      setLoading(true);
      getUserAssignments(selectedCompanyId)
        .then(res => {
          setAssignments(res.data || []);
        })
        .catch(err => {
          toast({ title: "Error", description: "Failed to load user assignments.", variant: "destructive" });
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [selectedCompanyId, toast]);
  
  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(Number(companyId));
    setAssignments([]);
  }

  return (
    <SidebarProvider>
      <Sidebar><SidebarContent><AppSidebar /></SidebarContent></Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
           <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-xl font-bold">Company Users</h1>
            </div>
             {authUser?.role_id === 1 && (
                <Select onValueChange={handleCompanyChange} >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select a company" />
                    </SelectTrigger>
                  <SelectContent>
                    {companies.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
             )}
          </header>
          <main className="flex-1 p-4 md:p-8 bg-muted/40">
             <Card>
              <CardHeader>
                <CardTitle>User Assignments</CardTitle>
                <CardDescription>A list of all users and their assigned departments in the company.</CardDescription>
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
                      <TableRow><TableCell colSpan={2} className="text-center h-24">No assignments found for this company.</TableCell></TableRow>
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
