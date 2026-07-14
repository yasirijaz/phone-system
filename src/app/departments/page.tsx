
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Department } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { getDepartments, createDepartment, updateDepartment, deleteDepartment, leaveDepartment, invalidateDepartmentsSummaryCache } from "@/services/departmentService";
import { getUserDepartments } from "@/services/userService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Edit, Trash2, Settings, Users, Phone, MoreVertical, LogOut } from "lucide-react";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { useRouter } from "next/navigation";
import AppHeader from "@/components/app-header";
import {
  isPlatformAdmin,
  isCompanyAdmin,
  isManager,
  isRegularUser,
  canCreateDepartments,
  canDeleteDepartments,
  canUpdateDepartments,
  canViewPhoneNumbers,
} from '@/lib/roles';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cacheDel, cacheInvalidatePrefix } from "@/lib/simpleCache";

const departmentSchema = z.object({
  name: z.string().min(2, "Department name must be at least 2 characters."),
});

export default function DepartmentsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<Department | null>(null);
  const [leavingDepartment, setLeavingDepartment] = useState(false);
  const { toast } = useToast();

  const isAdmin = isPlatformAdmin(user?.role_id) || isCompanyAdmin(user?.role_id);
  const canCreate = canCreateDepartments(user?.role_id);
  const canDelete = canDeleteDepartments(user?.role_id);
  const canUpdate = canUpdateDepartments(user?.role_id);
  const canViewPhones = canViewPhoneNumbers(user?.role_id);

  const form = useForm<z.infer<typeof departmentSchema>>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: "",
    },
  });

  useEffect(() => {
    if (user) {
      fetchDepartments();
    }
  }, [user]);

  const fetchDepartments = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let data: Department[] = [];
      if (isAdmin && user.company_id) {
        data = await getDepartments(user.company_id);
      } else if (isManager(user?.role_id) || isRegularUser(user?.role_id)) {
        data = await getUserDepartments(user.id);
      }
      setDepartments(Array.isArray(data) ? data : []);
    } catch (error) {
      toast({
        title: "Error fetching departments",
        description: "Could not load your departments. Please try again later.",
        variant: "destructive",
      });
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDialogOpen = (department: Department | null = null) => {
    setEditingDepartment(department);
    if (department) {
      form.reset({ name: department.name });
    } else {
      form.reset({ name: "" });
    }
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingDepartment(null);
    form.reset();
  }

  const onSubmit = async (values: z.infer<typeof departmentSchema>) => {
    if (!user?.company_id) return;
    try {
      if (editingDepartment) {
        if (!canUpdate) return;
        await updateDepartment(editingDepartment.id, { name: values.name, company_id: user.company_id });
        toast({ title: "Success", description: "Department updated successfully." });
      } else {
        if (!canCreate) return;
        await createDepartment({ ...values, company_id: user.company_id });
        toast({ title: "Success", description: "Department created successfully." });
      }
      fetchDepartments();
      handleDialogClose();
    } catch (error: any) {
       const errorMessage = error.response?.data?.message || "An unexpected error occurred.";
      toast({
        title: `Error ${editingDepartment ? 'updating' : 'creating'} department`,
        description: errorMessage,
        variant: "destructive",
      });
    }
  };
  
  const handleDelete = async (id: number) => {
    if (!canDelete) return;
    try {
      await deleteDepartment(id);
      toast({ title: "Success", description: "Department deleted successfully." });
      fetchDepartments();
    } catch (error: any) {
       const errorMessage = error.response?.data?.message || "An unexpected error occurred.";
       toast({
        title: "Error deleting department",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }

  const handleManageSettings = (departmentId: number) => {
    router.push(`/departments/${departmentId}/settings`);
  }
  
  const handleManageUsers = (departmentId: number) => {
    router.push(`/departments/${departmentId}/users`);
  }

  const handleManagePhoneNumbers = (departmentId: number) => {
    router.push(`/departments/${departmentId}/phone-numbers`);
  };

  const handleConfirmLeaveDepartment = async () => {
    if (!leaveTarget || !user?.id) return;

    setLeavingDepartment(true);
    try {
      await leaveDepartment(leaveTarget.id);
      setDepartments((prev) => prev.filter((dept) => dept.id !== leaveTarget.id));
      cacheDel(`sidebar:${user.id}`);
      cacheDel(`sidebar-dept:${user.id}:${leaveTarget.id}`);
      invalidateDepartmentsSummaryCache();
      cacheInvalidatePrefix('unread-logs:');
      toast({
        title: "Left department",
        description: `You left ${leaveTarget.name}. An admin must re-add you if you need access again.`,
      });
      setLeaveTarget(null);
    } catch (error: any) {
      toast({
        title: "Could not leave department",
        description: error?.response?.data?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLeavingDepartment(false);
    }
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <AppSidebar />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
            <AppHeader user={user} logout={logout} />
           <header className="sticky top-16 z-20 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background/80 backdrop-blur-sm">
            <h1 className="text-xl font-bold">Departments</h1>
            {canCreate && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button onClick={() => handleDialogOpen()}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Department
                    </Button>
                </DialogTrigger>
                <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-[425px]">
                    <DialogHeader>
                    <DialogTitle>{editingDepartment ? "Edit" : "Add"} Department</DialogTitle>
                    </DialogHeader>
                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Department Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g. Sales" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">Cancel</Button>
                        </DialogClose>
                        <Button type="submit">Save</Button>
                        </DialogFooter>
                    </form>
                    </Form>
                </DialogContent>
                </Dialog>
            )}
          </header>

          <main className="flex-1 p-4 md:p-8 bg-muted/40">
            <Card>
              <CardHeader>
                <CardTitle>Your Departments</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p>Loading...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.isArray(departments) && departments.map((dept) => (
                        <TableRow key={dept.id}>
                          <TableCell className="font-medium">{dept.name}</TableCell>
                          <TableCell className="text-right">
                                {canUpdate && (
                                  <>
                                <Button variant="ghost" size="icon" onClick={() => handleManageUsers(dept.id)}>
                                    <Users className="h-4 w-4" />
                                </Button>
                                {canViewPhones && (
                                  <Button variant="ghost" size="icon" onClick={() => handleManagePhoneNumbers(dept.id)}>
                                      <Phone className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" onClick={() => handleManageSettings(dept.id)}>
                                    <Settings className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(dept)}>
                                <Edit className="h-4 w-4" />
                                </Button>
                                {canDelete && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the
                                        department and all associated data from our servers.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(dept.id)}>
                                        Continue
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                )}
                                  </>
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" aria-label={`More options for ${dept.name}`}>
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onSelect={() => setLeaveTarget(dept)}
                                    >
                                      <LogOut className="mr-2 h-4 w-4" />
                                      Leave department
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                       {(!Array.isArray(departments) || departments.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center h-24">
                              No departments found.
                            </TableCell>
                          </TableRow>
                        )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </main>

          <AlertDialog
            open={Boolean(leaveTarget)}
            onOpenChange={(open) => {
              if (!open && !leavingDepartment) setLeaveTarget(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave {leaveTarget?.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This cannot be undone by you. After you leave, you will lose access to this
                  department and will need an admin to add you back.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={leavingDepartment}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={leavingDepartment}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={(event) => {
                    event.preventDefault();
                    void handleConfirmLeaveDepartment();
                  }}
                >
                  {leavingDepartment ? "Leaving..." : "Leave department"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
