
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Company, PaginatedResponse } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { getCompanies, createCompany, updateCompany, deleteCompany } from "@/services/companyService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Edit, Trash2, Users, Building2, ChevronLeft, ChevronRight, Briefcase, Settings } from "lucide-react";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { useRouter } from 'next/navigation';
import { Badge } from "@/components/ui/badge";

const companySchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters."),
  subdomain: z.string().min(2, "Subdomain must be at least 2 characters."),
  email: z.string().email("Invalid email address.").optional(),
});

export default function CompaniesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [companiesResponse, setCompaniesResponse] = useState<PaginatedResponse<Company> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof companySchema>>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: "",
      subdomain: "",
      email: "",
    },
  });

  useEffect(() => {
    if (user?.role_id !== 1) {
      router.replace('/');
      return;
    }
    fetchCompanies(currentPage);
  }, [user, router, currentPage]);

  const fetchCompanies = async (page: number) => {
    try {
      setLoading(true);
      const data = await getCompanies(page);
      setCompaniesResponse(data);
    } catch (error) {
      toast({
        title: "Error fetching companies",
        description: "Could not load companies. Please try again later.",
        variant: "destructive",
      });
      setCompaniesResponse(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDialogOpen = (company: Company | null = null) => {
    setEditingCompany(company);
    if (company) {
      form.reset({ name: company.name, subdomain: company.subdomain, email: company.email });
    } else {
      form.reset({ name: "", subdomain: "", email: "" });
    }
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingCompany(null);
    form.reset();
  }

  const onSubmit = async (values: z.infer<typeof companySchema>) => {
    try {
      if (editingCompany) {
        await updateCompany(editingCompany.id, { name: values.name, subdomain: values.subdomain });
        toast({ title: "Success", description: "Company updated successfully." });
      } else {
        if(!values.email) {
            toast({ title: "Error", description: "Owner email is required to create a company.", variant: "destructive" });
            return;
        }
        await createCompany({ name: values.name, email: values.email, subdomain: values.subdomain });
        toast({ title: "Success", description: "Company created successfully." });
      }
      fetchCompanies(currentPage);
      handleDialogClose();
    } catch (error) {
      toast({
        title: `Error ${editingCompany ? 'updating' : 'creating'} company`,
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };
  
  const handleDelete = async (id: number) => {
    try {
      await deleteCompany(id);
      toast({ title: "Success", description: "Company deleted successfully." });
      if (companiesResponse?.data.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else {
        fetchCompanies(currentPage);
      }
    } catch (error) {
       toast({
        title: "Error deleting company",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  }
  
  const handleManageUsers = (companyId: number) => {
    router.push(`/companies/${companyId}/users`);
  }
  
  const handleManageSettings = (companyId: number) => {
    router.push(`/companies/${companyId}/settings`);
  }

  if (user?.role_id !== 1) {
    return null; 
  }

  const companies = companiesResponse?.data || [];
  const totalCompanies = companiesResponse?.total || 0;
  const totalUsers = companiesResponse?.data.reduce((acc, company) => acc + (company.users?.length || 0), 0) || 0;

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <AppSidebar />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-xl font-bold">Companies</h1>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleDialogOpen()} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Company
                </Button>
              </DialogTrigger>
              <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{editingCompany ? "Edit" : "Add"} Company</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Acme Inc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                        control={form.control}
                        name="subdomain"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subdomain</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. acme" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                     {!editingCompany && (
                         <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. owner@acme.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                     )}
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

          <main className="flex-1 p-4 md:p-8 space-y-8 bg-muted/40">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalCompanies}</div>
                   <p className="text-xs text-muted-foreground">registered in the system</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalUsers}</div>
                   <p className="text-xs text-muted-foreground">across all companies</p>
                </CardContent>
              </Card>
               <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalCompanies}</div>
                   <p className="text-xs text-muted-foreground">+0 from last month</p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Registered Companies</CardTitle>
                <CardDescription>A list of all companies in the system.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p>Loading...</p>
                ) : (
                  <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Subdomain</TableHead>
                          <TableHead>Owner Email</TableHead>
                          <TableHead>Users</TableHead>
                          <TableHead>Depts</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.isArray(companies) && companies.map((company) => (
                          <TableRow key={company.id}>
                            <TableCell className="font-medium">{company.name}</TableCell>
                            <TableCell>{company.subdomain}</TableCell>
                            <TableCell>{company.email || 'N/A'}</TableCell>
                            <TableCell>{company.users?.length || 0}</TableCell>
                            <TableCell>{company.departments?.length || 0}</TableCell>
                            <TableCell>
                              <Badge variant={company.status === 'active' ? 'default' : 'secondary'}>{company.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => handleManageUsers(company.id)}>
                                <Users className="h-4 w-4" />
                              </Button>
                               <Button variant="ghost" size="icon" onClick={() => handleManageSettings(company.id)}>
                                <Settings className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(company)}>
                                <Edit className="h-4 w-4" />
                              </Button>
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
                                      company and all associated data from our servers.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(company.id)}>
                                      Continue
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!Array.isArray(companies) || companies.length === 0) && (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center h-24">
                                No companies found.
                              </TableCell>
                            </TableRow>
                          )}
                      </TableBody>
                    </Table>
                  </div>
                   <div className="flex items-center justify-end space-x-2 py-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => prev - 1)}
                        disabled={currentPage === 1}
                      >
                         <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        disabled={!companiesResponse?.next_page_url}
                      >
                        Next
                         <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
