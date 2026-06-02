
"use client";

import { useState, useEffect, useMemo } from "react";
import type { User } from "@/types";
import { getDepartmentUsers, getDepartments } from "@/services/departmentService";
import { getUsersByCompany, assignUsersToDepartment, removeUserFromDepartment } from "@/services/userService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Trash2, PlusCircle, Search, Loader2 } from "lucide-react";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import AppHeader from "@/components/app-header";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { events } from '@/lib/events';

function matchesSearch(user: { name: string; email: string }, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    user.name.toLowerCase().includes(normalized) ||
    user.email.toLowerCase().includes(normalized)
  );
}

export default function DepartmentUsersPage() {
  const params = useParams();
  const { user: authUser, logout } = useAuth();
  const departmentId = Number(params.departmentId);
  const companyId = authUser?.company_id;

  const [departmentUsers, setDepartmentUsers] = useState<any[]>([]);
  const [allCompanyUsers, setAllCompanyUsers] = useState<User[]>([]);
  const [departmentName, setDepartmentName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [addUserSearch, setAddUserSearch] = useState("");
  const [departmentUserSearch, setDepartmentUserSearch] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (companyId && !isNaN(departmentId)) {
      fetchAllData();
    }
  }, [departmentId, companyId]);

  useEffect(() => {
    const handleDndStatusChange = (data: any) => {
      setDepartmentUsers(prevUsers =>
        prevUsers.map(user =>
          user.user.id === data.user_id
            ? { ...user, is_dnd: data.is_dnd ? 1 : 0 }
            : user
        )
      );

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

  useEffect(() => {
    const handleInCallStatusChange = (data: any) => {
      setDepartmentUsers(prevUsers =>
        prevUsers.map(user =>
          user.user.id === data.user_id
            ? { ...user, user: { ...user.user, in_call: data.in_call ? 1 : 0 } }
            : user
        )
      );

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

  const availableUsers = useMemo(
    () => allCompanyUsers.filter(
      (companyUser) => !departmentUsers.some((deptUser) => deptUser.user.id === companyUser.id)
    ),
    [allCompanyUsers, departmentUsers]
  );

  const filteredAvailableUsers = useMemo(
    () => availableUsers.filter((user) => matchesSearch(user, addUserSearch)),
    [availableUsers, addUserSearch]
  );

  const filteredDepartmentUsers = useMemo(
    () => departmentUsers.filter((entry) => matchesSearch(entry.user, departmentUserSearch)),
    [departmentUsers, departmentUserSearch]
  );

  const allFilteredSelected =
    filteredAvailableUsers.length > 0 &&
    filteredAvailableUsers.every((user) => selectedUserIds.includes(user.id));

  const toggleUserSelection = (userId: number, checked: boolean) => {
    setSelectedUserIds((prev) =>
      checked ? [...prev, userId] : prev.filter((id) => id !== userId)
    );
  };

  const handleSelectAllFiltered = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds((prev) => {
        const merged = new Set([...prev, ...filteredAvailableUsers.map((user) => user.id)]);
        return Array.from(merged);
      });
    } else {
      const filteredIds = new Set(filteredAvailableUsers.map((user) => user.id));
      setSelectedUserIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    }
  };

  const handleBulkAssign = async () => {
    if (!companyId || selectedUserIds.length === 0) return;

    setAssigning(true);
    try {
      const result = await assignUsersToDepartment(companyId, departmentId, selectedUserIds);
      setSelectedUserIds([]);
      fetchAllData();

      if (result.failed.length === 0) {
        toast({
          title: "Success",
          description: `${result.success.length} user${result.success.length === 1 ? '' : 's'} added to ${departmentName || 'the department'}.`,
        });
      } else {
        toast({
          title: "Partially complete",
          description: `${result.success.length} added, ${result.failed.length} failed.`,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error assigning users",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setAssigning(false);
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

  const departmentLabel = departmentName || 'Department';

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
                <div>
                  <h1 className="text-xl font-bold">{departmentLabel} Users</h1>
                  <p className="text-sm text-muted-foreground">Manage users assigned to this department</p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8 space-y-8 bg-muted/40">
             <Card>
              <CardHeader>
                <CardTitle>Add Users to {departmentLabel}</CardTitle>
                <CardDescription>
                  Search company users and add one or more to {departmentLabel}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={addUserSearch}
                    onChange={(e) => setAddUserSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading users...</p>
                ) : availableUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    All company users are already assigned to {departmentLabel}.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="select-all-users"
                          checked={allFilteredSelected}
                          onCheckedChange={(checked) => handleSelectAllFiltered(checked === true)}
                        />
                        <label htmlFor="select-all-users" className="text-sm font-medium cursor-pointer">
                          Select all {filteredAvailableUsers.length} shown
                        </label>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selectedUserIds.length} selected
                      </p>
                    </div>

                    <ScrollArea className="h-64 rounded-md border">
                      <div className="divide-y">
                        {filteredAvailableUsers.length === 0 ? (
                          <p className="p-4 text-sm text-muted-foreground text-center">
                            No users match your search.
                          </p>
                        ) : (
                          filteredAvailableUsers.map((user) => (
                            <label
                              key={user.id}
                              htmlFor={`add-user-${user.id}`}
                              className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                            >
                              <Checkbox
                                id={`add-user-${user.id}`}
                                checked={selectedUserIds.includes(user.id)}
                                onCheckedChange={(checked) => toggleUserSelection(user.id, checked === true)}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{user.name}</p>
                                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                              </div>
                              <Badge variant={user.role_id === 2 ? 'default' : 'secondary'}>
                                {user.role_id === 2 ? 'Admin' : 'User'}
                              </Badge>
                            </label>
                          ))
                        )}
                      </div>
                    </ScrollArea>

                    <Button
                      type="button"
                      onClick={handleBulkAssign}
                      disabled={assigning || selectedUserIds.length === 0}
                    >
                      {assigning ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Add {selectedUserIds.length > 0 ? `${selectedUserIds.length} ` : ''}User{selectedUserIds.length === 1 ? '' : 's'} to {departmentLabel}
                        </>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Users in {departmentLabel}</CardTitle>
                <CardDescription>A list of all users assigned to this department.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search assigned users..."
                    value={departmentUserSearch}
                    onChange={(e) => setDepartmentUserSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
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
                        {filteredDepartmentUsers.map((u) => (
                          <TableRow key={u.user.id}>
                            <TableCell className="font-medium">{u.user.name}</TableCell>
                            <TableCell>{u.user.email}</TableCell>
                            <TableCell>
                              <Badge variant={u.user.role_id === 2 ? 'default' : 'secondary'}>
                                {u.user.role_id === 1 ? 'Super Owner' : u.user.role_id === 2 ? 'Admin' : 'User'}
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
                                      This will remove the user from {departmentLabel}.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRemoveUser(u.user.id)}>
                                      Continue
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                        {departmentUsers.length === 0 && (
                          <TableRow><TableCell colSpan={4} className="text-center h-24">No users found for this department.</TableCell></TableRow>
                        )}
                        {departmentUsers.length > 0 && filteredDepartmentUsers.length === 0 && (
                          <TableRow><TableCell colSpan={4} className="text-center h-24">No users match your search.</TableCell></TableRow>
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
