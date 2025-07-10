
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Department } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from "@/services/departmentService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';

const departmentSchema = z.object({
  name: z.string().min(2, "Department name must be at least 2 characters."),
});

export default function DepartmentsPage() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof departmentSchema>>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: "",
    },
  });

  useEffect(() => {
    if (user?.id) {
      fetchDepartments();
    }
  }, [user]);

  const fetchDepartments = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await getDepartments(user.id);
      setDepartments(data);
    } catch (error) {
      toast({
        title: "Error fetching departments",
        description: "Could not load your departments. Please try again later.",
        variant: "destructive",
      });
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
    if (!user) return;
    try {
      if (editingDepartment) {
        await updateDepartment(editingDepartment.id, { name: values.name, company_id: user.id });
        toast({ title: "Success", description: "Department updated successfully." });
      } else {
        await createDepartment({ ...values, company_id: user.id });
        toast({ title: "Success", description: "Department created successfully." });
      }
      fetchDepartments();
      handleDialogClose();
    } catch (error) {
      toast({
        title: `Error ${editingDepartment ? 'updating' : 'creating'} department`,
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };
  
  const handleDelete = async (id: number) => {
    if(!confirm('Are you sure you want to delete this department?')) return;
    try {
      await deleteDepartment(id);
      toast({ title: "Success", description: "Department deleted successfully." });
      fetchDepartments();
    } catch (error) {
       toast({
        title: "Error deleting department",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <AppSidebar />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen bg-background">
          <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-card shadow-sm">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="md:hidden" />
              <h1 className="text-xl font-bold text-primary">Departments</h1>
            </div>
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
          </header>

          <main className="flex-1 p-4 md:p-8">
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
                      {departments.map((dept) => (
                        <TableRow key={dept.id}>
                          <TableCell className="font-medium">{dept.name}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(dept)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(dept.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                       {departments.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center">
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
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
