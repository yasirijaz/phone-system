
"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { User, Company, Department, Assignment } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { getCompany } from "@/services/companyService";
import { getDepartments } from "@/services/departmentService";
import { getUsersByCompany, addUserToCompany, assignUserToDepartment, removeUserFromDepartment, updateUser, deleteUser, importUsersToCompany, type UserImportPayload } from "@/services/userService";
import { parseCsv, getCsvValue } from "@/lib/csvParser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, ArrowLeft, Edit, Trash2, Users, Briefcase, Upload, Download, Loader2 } from "lucide-react";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import AppHeader from "@/components/app-header";
import { events } from '@/lib/events';
import { parseWorkerStatusPayload } from '@/lib/worker-status';
import {
  canManageUsers,
  canDeleteUsers,
  getAssignableRolesForCreator,
  getRoleName,
  ROLES,
} from '@/lib/roles';

const userSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters.").optional().or(z.literal('')),
  password_confirmation: z.string().optional().or(z.literal('')),
  role_id: z.coerce.number({ required_error: "Role is required."}).min(1, "Role is required."),
});

const assignmentSchema = z.object({
  department_id: z.coerce.number().min(1, "Please select a department."),
});

const importRowSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  role_id: z.number().min(2).max(3),
});

type ParsedImportRow = UserImportPayload & { row: number; error?: string };

const CSV_TEMPLATE = "name,email,password,role\nJohn Doe,john@example.com,password123,User\nJane Smith,jane@example.com,password123,Admin";

function parseRoleId(value: string): number {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'admin' || normalized === '2') return 2;
  return 3;
}

function parseImportRows(csvText: string, defaultPassword: string): ParsedImportRow[] {
  const rows = parseCsv(csvText);
  return rows.map((row, index) => {
    const parsed: ParsedImportRow = {
      row: index + 2,
      name: getCsvValue(row, 'name'),
      email: getCsvValue(row, 'email'),
      password: getCsvValue(row, 'password') || defaultPassword,
      role_id: parseRoleId(getCsvValue(row, 'role_id', 'role') || 'user'),
    };

    const result = importRowSchema.safeParse(parsed);
    if (!result.success) {
      parsed.error = result.error.errors[0]?.message || 'Invalid row';
    }

    return parsed;
  });
}

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
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importRows, setImportRows] = useState<ParsedImportRow[]>([]);
  const [importCsvText, setImportCsvText] = useState("");
  const [defaultImportPassword, setDefaultImportPassword] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const userForm = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", password: "", password_confirmation: "", role_id: 3 },
  });

  const assignmentForm = useForm<z.infer<typeof assignmentSchema>>({
    resolver: zodResolver(assignmentSchema),
  });

  useEffect(() => {
    if (!canManageUsers(authUser?.role_id) || !companyId) {
      router.replace('/');
      return;
    }
    fetchData();
  }, [authUser, companyId, router]);

  // Handle DND status change notifications
  useEffect(() => {
    const handleDndStatusChange = (data: any) => {
      if (data?.is_dnd === undefined) return;

      setUsers(prevUsers =>
        prevUsers.map(user =>
          Number(user.id) === Number(data.user_id)
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
      if (data?.in_call === undefined) return;

      const inCall = Number(data.in_call) ? 1 : 0;
      setUsers(prevUsers =>
        prevUsers.map(user =>
          Number(user.id) === Number(data.user_id)
            ? { ...user, in_call: inCall }
            : user
        )
      );
    };

    events.on('refreshInCallStatus', handleInCallStatusChange);
    return () => events.off('refreshInCallStatus', handleInCallStatusChange);
  }, []);

  useEffect(() => {
    const handleWorkerStatusChange = (data: any) => {
      const parsed = parseWorkerStatusPayload(data);
      if (!parsed) return;

      setUsers(prevUsers =>
        prevUsers.map(u =>
          Number(u.id) === parsed.user_id
            ? { ...u, worker_status: parsed.worker_status }
            : u
        )
      );
    };

    events.on('refreshWorkerStatus', handleWorkerStatusChange);
    return () => events.off('refreshWorkerStatus', handleWorkerStatusChange);
  }, []);

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
        password_confirmation: "",
        role_id: user.role_id,
      });
    } else {
      userForm.reset({ name: "", email: "", password: "", password_confirmation: "", role_id: 3 });
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
    if (editingUser && values.password && values.password !== values.password_confirmation) {
      userForm.setError("password_confirmation", {
        type: "manual",
        message: "Passwords don't match",
      });
      return;
    }

    try {
      if (editingUser) {
        const payload: { name: string, email: string, role_id: number, password?: string, password_confirmation?: string } = {
          name: values.name,
          email: values.email,
          role_id: values.role_id,
        };
        if (values.password) {
          payload.password = values.password;
          payload.password_confirmation = values.password_confirmation;
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
  
  const handleImportDialogClose = () => {
    setIsImportDialogOpen(false);
    setImportRows([]);
    setImportCsvText("");
    setDefaultImportPassword("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "users-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setImportCsvText(text);
      const parsed = parseImportRows(text, defaultImportPassword);
      if (parsed.length === 0) {
        toast({
          title: "Empty file",
          description: "The CSV file has no data rows. Include a header row and at least one user.",
          variant: "destructive",
        });
        return;
      }
      setImportRows(parsed);
    } catch {
      toast({
        title: "Invalid file",
        description: "Could not read the CSV file.",
        variant: "destructive",
      });
    }
  };

  const handleImportSubmit = async () => {
    const validRows = importRows.filter((row) => !row.error);
    if (validRows.length === 0) {
      toast({
        title: "Nothing to import",
        description: "Fix validation errors before importing.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    try {
      const payload: UserImportPayload[] = validRows.map(({ name, email, password, role_id }) => ({
        name,
        email,
        password,
        role_id,
      }));
      const result = await importUsersToCompany(companyId, payload);
      fetchData();
      handleImportDialogClose();

      if (result.failed.length === 0) {
        toast({
          title: "Import complete",
          description: `${result.success.length} user${result.success.length === 1 ? '' : 's'} imported successfully.`,
        });
      } else {
        toast({
          title: "Import partially complete",
          description: `${result.success.length} imported, ${result.failed.length} failed.`,
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Import failed",
        description: "An unexpected error occurred during import.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const validImportCount = importRows.filter((row) => !row.error).length;
  const invalidImportCount = importRows.length - validImportCount;

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
  

  const assignableRoles = getAssignableRolesForCreator(authUser?.role_id);
  const canDelete = canDeleteUsers(authUser?.role_id);

  if (!canManageUsers(authUser?.role_id)) {
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
            <div className="flex items-center gap-2">
              {authUser?.role_id !== ROLES.MANAGER && (
              <Dialog open={isImportDialogOpen} onOpenChange={(open) => open ? setIsImportDialogOpen(true) : handleImportDialogClose()}>
                <DialogTrigger asChild>
                  <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" /> Import CSV
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Import Users from CSV</DialogTitle>
                    <DialogDescription>
                      Upload a CSV with columns: name, email, password (optional), role (User or Admin).
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate}>
                        <Download className="mr-2 h-4 w-4" /> Download Template
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="mr-2 h-4 w-4" /> Choose File
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={handleCsvFileChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="default-password" className="text-sm font-medium">
                        Default password (used when CSV row has no password)
                      </label>
                      <Input
                        id="default-password"
                        type="password"
                        placeholder="Optional default password"
                        value={defaultImportPassword}
                        onChange={(e) => {
                          const value = e.target.value;
                          setDefaultImportPassword(value);
                          if (importCsvText) {
                            setImportRows(parseImportRows(importCsvText, value));
                          }
                        }}
                      />
                    </div>
                    {importRows.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          {validImportCount} valid, {invalidImportCount} with errors
                        </p>
                        <div className="rounded-md border max-h-64 overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Row</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {importRows.map((row) => (
                                <TableRow key={row.row}>
                                  <TableCell>{row.row}</TableCell>
                                  <TableCell>{row.name}</TableCell>
                                  <TableCell>{row.email}</TableCell>
                                  <TableCell>{row.role_id === 2 ? 'Admin' : 'User'}</TableCell>
                                  <TableCell>
                                    {row.error ? (
                                      <span className="text-destructive text-sm">{row.error}</span>
                                    ) : (
                                      <span className="text-green-600 text-sm">Ready</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="secondary" onClick={handleImportDialogClose} disabled={importing}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleImportSubmit}
                      disabled={importing || validImportCount === 0}
                    >
                      {importing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        `Import ${validImportCount} User${validImportCount === 1 ? '' : 's'}`
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              )}
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
                     {editingUser && (
                       <FormField control={userForm.control} name="password_confirmation" render={({ field }) => (
                          <FormItem><FormLabel>Confirm Password</FormLabel><FormControl><Input type="password" placeholder="Confirm new password" {...field} /></FormControl><FormMessage /></FormItem>
                       )}/>
                     )}
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
                              {assignableRoles.map((roleId) => (
                                <SelectItem key={roleId} value={String(roleId)}>
                                  {getRoleName(roleId)}
                                </SelectItem>
                              ))}
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
            </div>
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
                              <Badge variant={u.role_id === ROLES.COMPANY_ADMIN ? 'default' : 'secondary'}>
                                {getRoleName(u.role_id)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => handleOpenAssignmentDialog(u)}><Briefcase className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleUserDialogOpen(u)}><Edit className="h-4 w-4" /></Button>
                              {canDelete && (
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
                              )}
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
