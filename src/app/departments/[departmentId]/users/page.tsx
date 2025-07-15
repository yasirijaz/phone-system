
"use client";

import { useState, useEffect } from "react";
import type { User } from "@/types";
import { getDepartmentUsers } from "@/services/departmentService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";

export default function DepartmentUsersPage() {
  const router = useRouter();
  const params = useParams();
  const { user: authUser } = useAuth();
  const departmentId = Number(params.departmentId);
  const companyId = authUser?.company_id;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (departmentId && companyId) {
      fetchDepartmentUsers();
    }
  }, [departmentId, companyId]);

  const fetchDepartmentUsers = async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const response = await getDepartmentUsers(companyId, departmentId);
      setUsers(Array.isArray(response.users) ? response.users : []);
    } catch (error) {
      toast({
        title: "Error fetching users",
        description: "Could not load department users. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
                        {Array.isArray(users) && users.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.name}</TableCell>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>
                              <Badge variant={u.role_id === 2 ? 'default' : 'secondary'}>
                                {u.role_id === 1 ? 'Super Owner' : u.role_id === 2 ? 'Admin' : 'User'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!Array.isArray(users) || users.length === 0) && (
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
