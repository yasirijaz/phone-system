
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { Integration } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { getIntegrations, createIntegration, updateIntegration, deleteIntegration } from "@/services/integrationService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Edit, Trash2, Plug } from "lucide-react";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { useRouter } from 'next/navigation';
import AppHeader from "@/components/app-header";

const integrationSchema = z.object({
  integration_name: z.string().min(2, "Integration name is required."),
  api_url: z.string().optional(),
  api_key: z.string().optional(),
});

function isWindshieldHubName(name?: string | null): boolean {
  return (name ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "") === "windshieldhub";
}

export default function IntegrationsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof integrationSchema>>({
    resolver: zodResolver(integrationSchema),
    defaultValues: { integration_name: "", api_url: "", api_key: "" },
  });

  useEffect(() => {
    if (user?.role_id !== 1) {
      router.replace('/');
      return;
    }
    fetchIntegrations();
  }, [user, router]);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const data = await getIntegrations();
      setIntegrations(Array.isArray(data) ? data : []);
    } catch (error) {
      toast({
        title: "Error fetching integrations",
        description: "Could not load integrations.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDialogOpen = (integration: Integration | null = null) => {
    setEditingIntegration(integration);
    if (integration) {
      form.reset({
        integration_name: integration.integration_name,
        api_url: integration.api_url ?? "",
        api_key: "",
      });
    } else {
      form.reset({ integration_name: "", api_url: "", api_key: "" });
    }
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingIntegration(null);
    form.reset();
  };

  const onSubmit = async (values: z.infer<typeof integrationSchema>) => {
    try {
      const companyId = editingIntegration?.company_id;
      if (!companyId) {
        toast({
          title: "Open the company",
          description: "Add the integration from that company's settings.",
          variant: "destructive",
        });
        return;
      }

      const payload = {
        integration_name: values.integration_name,
        company_id: companyId,
        ...(isWindshieldHubName(values.integration_name)
          ? {
              api_url: values.api_url?.trim() ?? "",
              ...(values.api_key?.trim() ? { api_key: values.api_key.trim() } : {}),
            }
          : {}),
      };
      if (editingIntegration) {
        await updateIntegration(editingIntegration.id, payload);
        toast({ title: "Success", description: "Integration updated successfully." });
      } else {
        await createIntegration(payload);
        toast({ title: "Success", description: "Integration created successfully." });
      }
      fetchIntegrations();
      handleDialogClose();
    } catch (error: any) {
      toast({
        title: `Error ${editingIntegration ? 'updating' : 'creating'} integration`,
        description: error.response?.data?.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteIntegration(id);
      toast({ title: "Success", description: "Integration deleted successfully." });
      fetchIntegrations();
    } catch (error: any) {
      toast({
        title: "Error deleting integration",
        description: error.response?.data?.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  if (user?.role_id !== 1) {
    return null;
  }

  return (
    <SidebarProvider>
      <Sidebar><SidebarContent><AppSidebar /></SidebarContent></Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          <AppHeader user={user} logout={logout} pageTitle="Integrations" />
          <header className="sticky top-16 z-20 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background/80 backdrop-blur-sm">
            <h1 className="text-xl font-bold">Manage Integrations</h1>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleDialogOpen()}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Integration
                </Button>
              </DialogTrigger>
              <DialogContent onInteractOutside={handleDialogClose}>
                <DialogHeader>
                  <DialogTitle>{editingIntegration ? "Edit" : "Add"} Integration</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="integration_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Integration Name</FormLabel>
                          <FormControl><Input placeholder="e.g. Slack" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {isWindshieldHubName(form.watch("integration_name")) && (
                      <>
                        <FormField
                          control={form.control}
                          name="api_url"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>API origin</FormLabel>
                              <FormControl>
                                <Input placeholder="https://api.windshieldhub.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="api_key"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>API key</FormLabel>
                              <FormControl>
                                <Input
                                  type="password"
                                  placeholder={editingIntegration?.has_api_key ? "Key saved — enter a new value to replace" : "CRM API key"}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                    
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
                <CardTitle>Available Integrations</CardTitle>
                <CardDescription>Each integration belongs to one company and is not shared with the others.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? <p>Loading...</p> : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {integrations.map((integration) => (
                        <TableRow key={integration.id}>
                          <TableCell className="font-medium">
                            <div>{integration.integration_name}</div>
                            {isWindshieldHubName(integration.integration_name) && (
                              <p className="text-xs font-normal text-muted-foreground">
                                {integration.has_api_key ? "API key saved" : "API key not set — use Edit"}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>{integration.company?.name ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleDialogOpen(integration)}><Edit className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently delete the integration.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(integration.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                      {integrations.length === 0 && (
                        <TableRow><TableCell colSpan={3} className="text-center h-24">No integrations found.</TableCell></TableRow>
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
