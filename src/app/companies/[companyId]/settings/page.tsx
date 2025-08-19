
"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { CompanySettings } from "@/types";
import { useAuth } from "@/context/AuthContext";
import { getCompanySettings, createOrUpdateCompanySettings } from "@/services/companySettingsService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, PlusCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import AppHeader from "@/components/app-header";

const businessHoursSchema = z.object({
  day: z.string(),
  enabled: z.boolean(),
  open: z.string(),
  close: z.string(),
});

const holidaySchema = z.object({
  name: z.string().min(1, "Holiday name is required"),
  date: z.string().min(1, "Date is required"),
});

const settingsSchema = z.object({
  call_settings: z.object({
    record_calls: z.boolean().default(false),
    greeting_message: z.string().optional(),
  }),
  voicemail_settings: z.object({
    enabled: z.boolean().default(true),
    greeting: z.string().optional(),
    send_transcription: z.boolean().default(false),
  }),
  business_hours: z.object({
    is_24_7: z.boolean().default(false),
    days: z.array(businessHoursSchema),
  }),
  holiday_schedule: z.object({
    holidays: z.array(holidaySchema),
  }),
  routing_preferences: z.object({
    default_route: z.string().default("voicemail"),
    timeout: z.coerce.number().min(5).max(120).default(30),
  }),
});

export default function CompanySettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const companyId = Number(params.companyId);

  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      call_settings: { record_calls: false, greeting_message: "" },
      voicemail_settings: { enabled: true, greeting: "", send_transcription: false },
      business_hours: {
        is_24_7: false,
        days: [
          { day: "Monday", enabled: true, open: "09:00", close: "17:00" },
          { day: "Tuesday", enabled: true, open: "09:00", close: "17:00" },
          { day: "Wednesday", enabled: true, open: "09:00", close: "17:00" },
          { day: "Thursday", enabled: true, open: "09:00", close: "17:00" },
          { day: "Friday", enabled: true, open: "09:00", close: "17:00" },
          { day: "Saturday", enabled: false, open: "09:00", close: "17:00" },
          { day: "Sunday", enabled: false, open: "09:00", close: "17:00" },
        ],
      },
      holiday_schedule: { holidays: [] },
      routing_preferences: { default_route: "voicemail", timeout: 30 },
    },
  });
  
  const { fields, append: appendHoliday, remove: removeHoliday } = useFieldArray({
    control: form.control,
    name: "holiday_schedule.holidays",
  });
  
  const { fields: businessHoursFields } = useFieldArray({
    control: form.control,
    name: "business_hours.days",
  });

  const is247 = form.watch("business_hours.is_24_7");


  useEffect(() => {
    if (user?.role_id === 3) {
       router.replace('/');
       return;
    }

    if(user?.role_id === 2 && user?.company_id !== companyId) {
        router.replace('/');
        return;
    }
    
    if(companyId) {
        fetchSettings();
    }
  }, [user, companyId, router]);

  useEffect(() => {
    if (settings) {
      form.reset({
        call_settings: settings.call_settings,
        voicemail_settings: settings.voicemail_settings,
        business_hours: settings.business_hours,
        holiday_schedule: settings.holiday_schedule || { holidays: [] },
        routing_preferences: settings.routing_preferences,
      });
    }
  }, [settings, form]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getCompanySettings(companyId);
      setSettings(data);
    } catch (error) {
      console.log("No existing settings, using defaults.");
      setSettings(null); 
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof settingsSchema>) => {
    try {
      const payload = { ...values, company_id: companyId };
      await createOrUpdateCompanySettings(settings?.id, payload);
      toast({ title: "Success", description: "Settings saved successfully." });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "An unexpected error occurred.";
      toast({
        title: `Error saving settings`,
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <p>Loading settings...</p>;
  }
  
  const isSuperAdmin = user?.role_id === 1;

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent><AppSidebar /></SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          <AppHeader 
              user={user} 
              logout={logout} 
              pageTitle={!isSuperAdmin ? "Company Settings" : ""}
          />
          <header className="sticky top-16 z-20 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              {isSuperAdmin && (
                <Button variant="ghost" size="icon" asChild>
                  <Link href="/companies">
                    <ArrowLeft />
                  </Link>
                </Button>
              )}
              <h1 className="text-xl font-bold">Company Settings</h1>
            </div>
            <Button type="submit" form="settings-form">Save Changes</Button>
          </header>

          <main className="flex-1 p-4 md:p-8 bg-muted/40">
            <Form {...form}>
              <form id="settings-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                 <Tabs defaultValue="call-settings">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="call-settings">Call Settings</TabsTrigger>
                        <TabsTrigger value="voicemail">Voicemail</TabsTrigger>
                        <TabsTrigger value="business-hours">Business Hours</TabsTrigger>
                        <TabsTrigger value="holiday-schedule">Holiday Schedule</TabsTrigger>
                        <TabsTrigger value="routing">Routing</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="call-settings">
                        <Card>
                            <CardHeader>
                                <CardTitle>Call Configuration</CardTitle>
                                <CardDescription>Manage how incoming and outgoing calls are handled.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                               <FormField
                                  control={form.control}
                                  name="call_settings.record_calls"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                      <div className="space-y-0.5">
                                        <FormLabel className="text-base">Record Calls</FormLabel>
                                        <FormMessage />
                                      </div>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                    control={form.control}
                                    name="call_settings.greeting_message"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Greeting Message (Optional)</FormLabel>
                                            <FormControl><Textarea placeholder="e.g. Welcome to Acme Corp. Please hold while we connect you." {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="voicemail">
                        <Card>
                            <CardHeader>
                                <CardTitle>Voicemail Settings</CardTitle>
                                <CardDescription>Configure your company's voicemail system.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <FormField
                                  control={form.control}
                                  name="voicemail_settings.enabled"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                      <div className="space-y-0.5">
                                        <FormLabel className="text-base">Enable Voicemail</FormLabel>
                                         <FormMessage />
                                      </div>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                 <FormField
                                    control={form.control}
                                    name="voicemail_settings.greeting"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Voicemail Greeting (Optional)</FormLabel>
                                            <FormControl><Textarea placeholder="e.g. Sorry we missed your call. Please leave a message..." {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                 <FormField
                                  control={form.control}
                                  name="voicemail_settings.send_transcription"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                      <div className="space-y-0.5">
                                        <FormLabel className="text-base">Email Voicemail Transcriptions</FormLabel>
                                         <FormMessage />
                                      </div>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                     <TabsContent value="business-hours">
                        <Card>
                            <CardHeader>
                                <CardTitle>Business Hours</CardTitle>
                                <CardDescription>Define when your team is available to take calls.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                 <FormField
                                  control={form.control}
                                  name="business_hours.is_24_7"
                                  render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                      <div className="space-y-0.5">
                                        <FormLabel className="text-base">Available 24/7</FormLabel>
                                      </div>
                                      <FormControl>
                                        <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                {!is247 && businessHoursFields.map((field, index) => (
                                  <div key={field.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                                    <FormField
                                      control={form.control}
                                      name={`business_hours.days.${index}.enabled`}
                                      render={({ field: checkboxField }) => (
                                        <FormItem>
                                          <FormControl>
                                             <Checkbox
                                                checked={checkboxField.value}
                                                onCheckedChange={checkboxField.onChange}
                                              />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                    />
                                    <FormLabel className="w-24">{field.day}</FormLabel>
                                    <div className="flex-1 grid grid-cols-2 gap-4">
                                       <FormField
                                          control={form.control}
                                          name={`business_hours.days.${index}.open`}
                                          render={({ field: timeField }) => (
                                            <FormItem>
                                              <FormControl>
                                                 <Input type="time" {...timeField} disabled={!form.watch(`business_hours.days.${index}.enabled`)} />
                                              </FormControl>
                                            </FormItem>
                                          )}
                                        />
                                        <FormField
                                          control={form.control}
                                          name={`business_hours.days.${index}.close`}
                                          render={({ field: timeField }) => (
                                            <FormItem>
                                              <FormControl>
                                                  <Input type="time" {...timeField} disabled={!form.watch(`business_hours.days.${index}.enabled`)} />
                                              </FormControl>
                                            </FormItem>
                                          )}
                                        />
                                    </div>
                                  </div>
                                ))}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    
                    <TabsContent value="holiday-schedule">
                        <Card>
                            <CardHeader>
                                <CardTitle>Holiday Schedule</CardTitle>
                                <CardDescription>Define company holidays. Calls will be handled according to your out-of-hours settings on these days.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {fields.map((field, index) => (
                                  <div key={field.id} className="flex items-end gap-4 p-4 border rounded-lg">
                                    <FormField
                                      control={form.control}
                                      name={`holiday_schedule.holidays.${index}.name`}
                                      render={({ field }) => (
                                        <FormItem className="flex-1">
                                          <FormLabel>Holiday Name</FormLabel>
                                          <FormControl><Input placeholder="e.g. New Year's Day" {...field} /></FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                     <FormField
                                      control={form.control}
                                      name={`holiday_schedule.holidays.${index}.date`}
                                      render={({ field }) => (
                                        <FormItem className="flex-1">
                                          <FormLabel>Date</FormLabel>
                                          <FormControl><Input type="date" {...field} /></FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <Button type="button" variant="destructive" size="icon" onClick={() => removeHoliday(index)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                                <Button type="button" variant="outline" onClick={() => appendHoliday({ name: '', date: '' })}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Holiday
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                     <TabsContent value="routing">
                        <Card>
                            <CardHeader>
                                <CardTitle>Call Routing</CardTitle>
                                <CardDescription>Determine how calls are directed and handled.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <FormField
                                  control={form.control}
                                  name="routing_preferences.default_route"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Default Action for Missed Calls</FormLabel>
                                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                                          <FormControl>
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select a default route" />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            <SelectItem value="voicemail">Go to Voicemail</SelectItem>
                                            <SelectItem value="hangup">Hang Up</SelectItem>
                                            <SelectItem value="message">Play a Message</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                    control={form.control}
                                    name="routing_preferences.timeout"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Routing Timeout (seconds)</FormLabel>
                                            <FormControl><Input type="number" placeholder="e.g. 30" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>

                 </Tabs>
              </form>
            </Form>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
