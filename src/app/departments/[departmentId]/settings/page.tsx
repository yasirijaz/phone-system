
"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { getDepartmentSettings, createOrUpdateDepartmentSettings, createDepartmentSlackGroup } from "@/services/departmentSettingsService";
import type { DepartmentSettings } from "@/types";
import AppHeader from "@/components/app-header";

const ivrOptionSchema = z.object({
  digit: z.string().length(1, "Must be a single digit"),
  action: z.string().min(1, "Action is required"),
  destination: z.string().min(1, "Destination is required"),
});

const holidaySchema = z.object({
  name: z.string().min(1, "Holiday name is required"),
  date: z.string().min(1, "Date is required"),
});

const businessHoursSchema = z.object({
  day: z.string(),
  enabled: z.boolean(),
  open: z.string(),
  close: z.string(),
});

const settingsSchema = z.object({
  timezone: z.string().default("UTC"),
  call_settings: z.object({
    greeting_message: z.string().optional().default(""),
    hold_music_url: z.string().url().optional().or(z.literal('')),
  }),
  business_hours: z.object({
    is_24_7: z.boolean().default(false),
    days: z.array(businessHoursSchema),
  }),
  ivr_menu: z.object({
    enabled: z.boolean().default(false),
    greeting: z.string().optional().default(""),
    options: z.array(ivrOptionSchema),
  }),
  break_handling: z.object({
    enabled: z.boolean().default(false),
    max_break_duration: z.coerce.number().min(0).default(15),
  }),
  holiday_schedule: z.object({
    holidays: z.array(holidaySchema),
  }),
  slack_settings: z.object({
    enabled: z.boolean().default(false),
    notify_missed_calls: z.boolean().default(true),
    bot_token: z.string().optional(),
  }).optional(),
});


export default function DepartmentSettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const departmentId = Number(params.departmentId);

  const [settings, setSettings] = useState<DepartmentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingSlackGroup, setCreatingSlackGroup] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      timezone: "UTC",
      call_settings: { greeting_message: "", hold_music_url: "" },
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
      ivr_menu: { enabled: false, greeting: "", options: [] },
      break_handling: { enabled: false, max_break_duration: 15 },
      holiday_schedule: { holidays: [] },
      slack_settings: { enabled: false, notify_missed_calls: true, bot_token: "" },
    },
  });

  const { fields: businessDaysFields } = useFieldArray({ control: form.control, name: "business_hours.days" });
  const { fields: ivrOptions, append: appendIvrOption, remove: removeIvrOption } = useFieldArray({ control: form.control, name: "ivr_menu.options" });
  const { fields: holidays, append: appendHoliday, remove: removeHoliday } = useFieldArray({ control: form.control, name: "holiday_schedule.holidays" });
  const is247 = form.watch("business_hours.is_24_7");
  const isIvrEnabled = form.watch("ivr_menu.enabled");
  const isSlackEnabled = form.watch("slack_settings.enabled");
  const slackChannelName = settings?.slack_settings?.channel_name;

  useEffect(() => {
    if (user && departmentId) fetchSettings();
  }, [departmentId, user]);

  useEffect(() => {
    if (settings) {
      form.reset({
        timezone: settings.timezone || "UTC",
        call_settings: {
            greeting_message: settings.call_settings?.greeting_message || "",
            hold_music_url: settings.call_settings?.hold_music_url || ""
        },
        business_hours: settings.business_hours || { is_24_7: false, days: [] },
        ivr_menu: {
            enabled: settings.ivr_menu?.enabled || false,
            greeting: settings.ivr_menu?.greeting || "",
            options: settings.ivr_menu?.options || []
        },
        break_handling: {
            enabled: settings.break_handling?.enabled || false,
            max_break_duration: settings.break_handling?.max_break_duration || 15
        },
        holiday_schedule: {
            holidays: settings.holiday_schedule?.holidays || []
        },
        slack_settings: {
            enabled: settings.slack_settings?.enabled || false,
            notify_missed_calls: settings.slack_settings?.notify_missed_calls ?? true,
            bot_token: "",
        },
      });
    }
  }, [settings, form]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getDepartmentSettings(departmentId);
      setSettings(data);
    } catch (error) {
      console.log("No existing department settings, using defaults.");
      setSettings(null);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof settingsSchema>) => {
    try {
      const slackSettings = values.slack_settings ? { ...values.slack_settings } : undefined;
      if (slackSettings && !slackSettings.bot_token) {
        delete slackSettings.bot_token;
      }

      const payload = {
        ...values,
        department_id: departmentId,
        slack_settings: slackSettings
          ? {
              ...slackSettings,
              channel_id: settings?.slack_settings?.channel_id,
              channel_name: settings?.slack_settings?.channel_name,
            }
          : undefined,
      };
      const response = await createOrUpdateDepartmentSettings(settings?.id, payload);
      if (response?.settings) {
        setSettings(response.settings);
      }
      toast({ title: "Success", description: "Department settings saved successfully." });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "An unexpected error occurred.";
      toast({
        title: `Error saving settings`,
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleCreateSlackGroup = async () => {
    const botToken = form.getValues("slack_settings.bot_token");
    if (!botToken && !settings?.slack_settings?.has_bot_token) {
      toast({
        title: "Slack bot token required",
        description: "Enter your Slack bot token before creating a group.",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreatingSlackGroup(true);
      const result = await createDepartmentSlackGroup(departmentId, botToken || undefined);
      if (result.settings) {
        setSettings(result.settings);
      } else {
        setSettings((prev) => ({
          ...(prev || { id: 0, department_id: departmentId, timezone: "UTC", call_settings: { greeting_message: "" }, business_hours: { is_24_7: false, days: [] }, ivr_menu: { enabled: false, greeting: "", options: [] }, break_handling: { enabled: false, max_break_duration: 15 }, holiday_schedule: { holidays: [] } }),
          slack_settings: result.slack_settings,
        }));
      }
      form.setValue("slack_settings.enabled", true);
      form.setValue("slack_settings.notify_missed_calls", true);
      form.setValue("slack_settings.bot_token", "");
      toast({
        title: "Slack group created",
        description: result.message || "Missed-call notifications will be sent to the new Slack group.",
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "Could not create the Slack group.";
      toast({
        title: "Slack group creation failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setCreatingSlackGroup(false);
    }
  };

  if (loading) return <p>Loading department settings...</p>;

  return (
    <SidebarProvider>
      <Sidebar><SidebarContent><AppSidebar /></SidebarContent></Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          <AppHeader user={user} logout={logout} />
          <header className="sticky top-16 z-20 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/departments"><ArrowLeft /></Link>
              </Button>
              <h1 className="text-xl font-bold">Department Settings</h1>
            </div>
            <Button type="submit" form="dept-settings-form">Save Changes</Button>
          </header>

          <main className="flex-1 p-4 md:p-8 bg-muted/40">
            <Form {...form}>
              <form id="dept-settings-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <Tabs defaultValue="general" className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="business-hours">Business Hours</TabsTrigger>
                    <TabsTrigger value="ivr">IVR Menu</TabsTrigger>
                    <TabsTrigger value="schedules">Schedules</TabsTrigger>
                    <TabsTrigger value="slack">Slack</TabsTrigger>
                  </TabsList>

                  <TabsContent value="general">
                    <Card>
                      <CardHeader><CardTitle>General Settings</CardTitle><CardDescription>Basic call settings and timezone.</CardDescription></CardHeader>
                      <CardContent className="space-y-6">
                        <FormField control={form.control} name="timezone" render={({ field }) => (
                          <FormItem><FormLabel>Timezone</FormLabel><FormControl><Input placeholder="e.g. UTC" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="call_settings.greeting_message" render={({ field }) => (
                          <FormItem><FormLabel>Greeting Message (Optional)</FormLabel><FormControl><Textarea placeholder="e.g. Welcome to the Sales department." {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="call_settings.hold_music_url" render={({ field }) => (
                          <FormItem><FormLabel>Hold Music URL (Optional)</FormLabel><FormControl><Input type="url" placeholder="e.g. https://example.com/music.mp3" {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                        )}/>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="business-hours">
                    <Card>
                      <CardHeader><CardTitle>Business Hours</CardTitle><CardDescription>Define when this department is available.</CardDescription></CardHeader>
                      <CardContent className="space-y-6">
                        <FormField control={form.control} name="business_hours.is_24_7" render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <FormLabel className="text-base">Available 24/7</FormLabel>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )}/>
                        {!is247 && businessDaysFields.map((field, index) => (
                          <div key={field.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                            <FormField control={form.control} name={`business_hours.days.${index}.enabled`} render={({ field: checkboxField }) => (
                              <FormItem><FormControl><Checkbox checked={checkboxField.value} onCheckedChange={checkboxField.onChange} /></FormControl></FormItem>
                            )}/>
                            <FormLabel className="w-24">{field.day}</FormLabel>
                            <div className="flex-1 grid grid-cols-2 gap-4">
                              <FormField control={form.control} name={`business_hours.days.${index}.open`} render={({ field: timeField }) => (
                                <FormItem><FormControl><Input type="time" {...timeField} disabled={!form.watch(`business_hours.days.${index}.enabled`)} /></FormControl></FormItem>
                              )}/>
                              <FormField control={form.control} name={`business_hours.days.${index}.close`} render={({ field: timeField }) => (
                                <FormItem><FormControl><Input type="time" {...timeField} disabled={!form.watch(`business_hours.days.${index}.enabled`)} /></FormControl></FormItem>
                              )}/>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="ivr">
                    <Card>
                      <CardHeader><CardTitle>IVR Menu</CardTitle><CardDescription>Set up an Interactive Voice Response menu for callers.</CardDescription></CardHeader>
                      <CardContent className="space-y-6">
                        <FormField control={form.control} name="ivr_menu.enabled" render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <FormLabel className="text-base">Enable IVR Menu</FormLabel>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )}/>
                        {isIvrEnabled && (
                          <>
                            <FormField control={form.control} name="ivr_menu.greeting" render={({ field }) => (
                              <FormItem><FormLabel>IVR Greeting</FormLabel><FormControl><Textarea placeholder="e.g. Press 1 for sales, 2 for support..." {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <div>
                               <FormLabel>IVR Options</FormLabel>
                               {ivrOptions.map((option, index) => (
                                <div key={option.id} className="flex items-center gap-2 p-2 border rounded-md mt-2">
                                  <FormField control={form.control} name={`ivr_menu.options.${index}.digit`} render={({ field }) => <Input placeholder="Digit" {...field} />} />
                                  <FormField control={form.control} name={`ivr_menu.options.${index}.action`} render={({ field }) => <Input placeholder="Action (e.g., forward)" {...field} />} />
                                  <FormField control={form.control} name={`ivr_menu.options.${index}.destination`} render={({ field }) => <Input placeholder="Destination" {...field} />} />
                                  <Button type="button" variant="ghost" size="icon" onClick={() => removeIvrOption(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </div>
                              ))}
                              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => appendIvrOption({ digit: '', action: '', destination: '' })}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Option
                              </Button>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="schedules">
                     <Card>
                      <CardHeader><CardTitle>Schedules</CardTitle><CardDescription>Manage holiday and break schedules for this department.</CardDescription></CardHeader>
                      <CardContent className="space-y-6">
                         <FormField control={form.control} name="break_handling.enabled" render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <FormLabel className="text-base">Enable Break Handling</FormLabel>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )}/>
                         <FormField control={form.control} name="break_handling.max_break_duration" render={({ field }) => (
                            <FormItem><FormLabel>Max Break Duration (minutes)</FormLabel><FormControl><Input type="number" {...field} disabled={!form.watch('break_handling.enabled')} /></FormControl><FormMessage /></FormItem>
                         )}/>
                         <div className="pt-4">
                           <FormLabel>Holiday Schedule</FormLabel>
                           {holidays.map((holiday, index) => (
                              <div key={holiday.id} className="flex items-center gap-2 p-2 border rounded-md mt-2">
                                  <FormField control={form.control} name={`holiday_schedule.holidays.${index}.name`} render={({ field }) => <Input placeholder="Holiday Name" {...field} />} />
                                  <FormField control={form.control} name={`holiday_schedule.holidays.${index}.date`} render={({ field }) => <Input type="date" {...field} />} />
                                  <Button type="button" variant="ghost" size="icon" onClick={() => removeHoliday(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                           ))}
                           <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => appendHoliday({ name: '', date: '' })}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Holiday
                           </Button>
                         </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="slack">
                    <Card>
                      <CardHeader>
                        <CardTitle>Slack Notifications</CardTitle>
                        <CardDescription>
                          Create a Slack group for this department and receive missed-call alerts, similar to Dialpad.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <FormField control={form.control} name="slack_settings.enabled" render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-1">
                              <FormLabel className="text-base">Enable Slack Integration</FormLabel>
                              <p className="text-sm text-muted-foreground">Turn on Slack notifications for this department.</p>
                            </div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )}/>

                        {isSlackEnabled && (
                          <>
                            <FormField control={form.control} name="slack_settings.bot_token" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Slack Bot Token</FormLabel>
                                <FormControl>
                                  <Input
                                    type="password"
                                    placeholder={settings?.slack_settings?.has_bot_token ? "Token saved — enter a new value to replace" : "xoxb-..."}
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                                <p className="text-sm text-muted-foreground">
                                  Use a Slack bot token with <code>channels:manage</code> and <code>chat:write</code> scopes.
                                </p>
                                <FormMessage />
                              </FormItem>
                            )}/>

                            <FormField control={form.control} name="slack_settings.notify_missed_calls" render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-1">
                                  <FormLabel className="text-base">Notify on Missed Calls</FormLabel>
                                  <p className="text-sm text-muted-foreground">Post a message to the Slack group when a call is missed.</p>
                                </div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                              </FormItem>
                            )}/>

                            <div className="rounded-lg border p-4 space-y-3">
                              <div>
                                <p className="font-medium">Slack Group</p>
                                <p className="text-sm text-muted-foreground">
                                  {slackChannelName
                                    ? `Connected to #${slackChannelName}`
                                    : "No Slack group has been created for this department yet."}
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleCreateSlackGroup}
                                disabled={creatingSlackGroup}
                              >
                                {creatingSlackGroup ? "Creating..." : slackChannelName ? "Recreate Slack Group" : "Create Slack Group"}
                              </Button>
                            </div>
                          </>
                        )}
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
