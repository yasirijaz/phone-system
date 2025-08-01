
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Package } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { getPackages, createPackage, updatePackage, deletePackage } from "@/services/packageService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Edit, Trash2, Package as PackageIcon } from "lucide-react";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { useRouter } from 'next/navigation';
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import AppHeader from "@/components/app-header";

const packageSchema = z.object({
  title: z.string().min(2, "Package name must be at least 2 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  price: z.coerce.number().min(0, "Price must be a positive number."),
  stripe_price_id: z.string().min(1, "Stripe Price ID is required."),
  stripe_product_id: z.string().min(1, "Stripe Product ID is required."),
  status: z.boolean().default(true),
});

export default function PackagesPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof packageSchema>>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      title: "",
      description: "",
      price: 0,
      stripe_price_id: "",
      stripe_product_id: "",
      status: true,
    },
  });

  useEffect(() => {
    if (user?.role_id !== 1) {
      router.replace('/');
      return;
    }
    fetchPackages();
  }, [user, router]);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const data = await getPackages();
      setPackages(data);
    } catch (error) {
      toast({
        title: "Error fetching packages",
        description: "Could not load packages. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDialogOpen = (pkg: Package | null = null) => {
    setEditingPackage(pkg);
    if (pkg) {
      form.reset({ title: pkg.title, description: pkg.description, price: pkg.price, stripe_price_id: pkg.stripe_price_id, stripe_product_id:pkg.stripe_product_id, status: pkg.status === 1 });
    } else {
      form.reset({ title: "", description: "", price: 0, stripe_price_id:"", stripe_product_id:"", status: true });
    }
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingPackage(null);
    form.reset();
  }

  const onSubmit = async (values: z.infer<typeof packageSchema>) => {
    try {
        const payload = { ...values, status: values.status ? 1 : 0 as (0 | 1) };
        if (editingPackage) {
            await updatePackage(editingPackage.id, payload);
            toast({ title: "Success", description: "Package updated successfully." });
        } else {
            await createPackage(payload);
            toast({ title: "Success", description: "Package created successfully." });
        }
        fetchPackages();
        handleDialogClose();
    } catch (error: any) {
      toast({
        title: `Error ${editingPackage ? 'updating' : 'creating'} package`,
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };
  
  const handleDelete = async (id: number) => {
    try {
      await deletePackage(id);
      toast({ title: "Success", description: "Package deleted successfully." });
      fetchPackages();
    } catch (error: any) {
       toast({
        title: "Error deleting package",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  }

  if (user?.role_id !== 1) {
    return null; 
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent><AppSidebar /></SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
            <AppHeader user={user} logout={logout} />
          <header className="sticky top-16 z-20 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background/80 backdrop-blur-sm">
            <h1 className="text-xl font-bold">Manage Packages</h1>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleDialogOpen()}>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Package
                </Button>
              </DialogTrigger>
              <DialogContent onInteractOutside={handleDialogClose}>
                <DialogHeader>
                  <DialogTitle>{editingPackage ? "Edit" : "Add"} Package</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="title" render={({ field }) => (
                      <FormItem><FormLabel>Package Name</FormLabel><FormControl><Input placeholder="e.g. Basic Plan" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Describe the package features" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="price" render={({ field }) => (
                        <FormItem><FormLabel>Price ($ / month)</FormLabel><FormControl><Input type="number" placeholder="e.g. 29" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="stripe_price_id" render={({ field }) => (
                        <FormItem><FormLabel>Stripe Price ID</FormLabel><FormControl><Input placeholder="price_..." {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                    </div>
                    <FormField control={form.control} name="stripe_product_id" render={({ field }) => (
                      <FormItem><FormLabel>Stripe Product ID</FormLabel><FormControl><Input placeholder="prod_..." {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <FormLabel>Active</FormLabel>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )}/>
                    <DialogFooter>
                      <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                      <Button type="submit">Save</Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </header>

          <main className="flex-1 p-4 md:p-8 bg-muted/40">
            <Card>
              <CardHeader>
                <CardTitle>Pricing Packages</CardTitle>
                <CardDescription>A list of all subscription packages offered.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? <p>Loading...</p> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Price ID</TableHead>
                        <TableHead>Product ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {packages.map((pkg) => (
                        <TableRow key={pkg.id}>
                          <TableCell className="font-medium">{pkg.title}</TableCell>
                          <TableCell>${pkg.price}/mo</TableCell>
                          <TableCell>{pkg.stripe_price_id}</TableCell>
                          <TableCell>{pkg.stripe_product_id}</TableCell>
                          <TableCell>
                            <Badge variant={pkg.status === 1 ? 'default' : 'secondary'}>
                              {pkg.status === 1 ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(pkg)}><Edit className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently delete the package.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(pkg.id)}>Continue</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                      {packages.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center h-24">No packages found.</TableCell></TableRow>
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
