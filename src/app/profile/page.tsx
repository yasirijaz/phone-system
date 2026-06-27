
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/context/AuthContext";
import { updateProfile } from "@/services/profileService";
import {
  disconnectSlack,
  getSlackConnectUrl,
  getSlackConnectionStatus,
  type SlackConnectionStatus,
} from "@/services/slackService";
import { useAppDispatch } from "@/store";
import { updateUser } from "@/store/slices/authSlice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import AppHeader from "@/components/app-header";
import { getRoleName } from '@/lib/roles';
import { useRef, useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import UserDevices from "@/components/user-devices";
import { useSearchParams } from "next/navigation";

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters.").optional().or(z.literal('')),
  password_confirmation: z.string().optional(),
}).refine((data) => data.password === data.password_confirmation, {
  message: "Passwords don't match",
  path: ["password_confirmation"],
});

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const { toast } = useToast();
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [slackStatus, setSlackStatus] = useState<SlackConnectionStatus | null>(null);
  const [slackLoading, setSlackLoading] = useState(true);
  const [slackActionLoading, setSlackActionLoading] = useState(false);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      password: "",
      password_confirmation: "",
    },
  });

  const loadSlackStatus = useCallback(async () => {
    try {
      setSlackLoading(true);
      const status = await getSlackConnectionStatus();
      setSlackStatus(status);
    } catch {
      setSlackStatus(null);
    } finally {
      setSlackLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    form.reset({
      name: user.name || "",
      email: user.email || "",
      password: "",
      password_confirmation: "",
    });
  }, [user, form]);

  useEffect(() => {
    if (!user) return;
    loadSlackStatus();
  }, [user, loadSlackStatus]);

  useEffect(() => {
    const slackResult = searchParams.get("slack");
    const message = searchParams.get("message");

    if (slackResult === "connected") {
      toast({
        title: "Slack connected",
        description: "Your Slack account is linked. Your status will update during calls.",
      });
      loadSlackStatus();
      if (user) {
        dispatch(updateUser({
          ...user,
          slack_connected: true,
          has_slack_access_token: true,
        }));
      }
    } else if (slackResult === "error") {
      toast({
        title: "Slack connection failed",
        description: message || "Could not connect your Slack account.",
        variant: "destructive",
      });
    }
  }, [searchParams, toast, loadSlackStatus, dispatch, user]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && user) {
      setIsUploading(true);
      try {
        const updatedUser = await updateProfile(user.id, { profile_picture: file });
        dispatch(updateUser(updatedUser));
        toast({ title: "Success", description: "Profile picture updated successfully." });
      } catch (error: any) {
        toast({
            title: "Upload Failed",
            description: error.message || "Could not upload the new profile picture.",
            variant: "destructive"
        });
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleConnectSlack = async () => {
    try {
      setSlackActionLoading(true);
      const authorizeUrl = await getSlackConnectUrl();
      window.location.href = authorizeUrl;
    } catch (error: any) {
      toast({
        title: "Could not start Slack connection",
        description: error.response?.data?.message || "Slack OAuth is not configured for your company.",
        variant: "destructive",
      });
      setSlackActionLoading(false);
    }
  };

  const handleDisconnectSlack = async () => {
    try {
      setSlackActionLoading(true);
      await disconnectSlack();
      setSlackStatus((prev) => (prev ? { ...prev, connected: false, slack_user_id: null } : prev));
      if (user) {
        dispatch(updateUser({
          ...user,
          slack_user_id: null,
          slack_connected: false,
          has_slack_access_token: false,
        }));
      }
      toast({ title: "Slack disconnected", description: "Your Slack account has been unlinked." });
    } catch (error: any) {
      toast({
        title: "Disconnect failed",
        description: error.response?.data?.message || "Could not disconnect Slack.",
        variant: "destructive",
      });
    } finally {
      setSlackActionLoading(false);
    }
  };

  const onSubmit = async (values: z.infer<typeof profileSchema>) => {
    if (!user) return;
    try {
      const updateData: {
        name: string;
        email: string;
        password?: string;
        password_confirmation?: string;
      } = {
        name: values.name,
        email: values.email,
      };

      if (values.password) {
        updateData.password = values.password;
        updateData.password_confirmation = values.password_confirmation;
      }
      
      const updatedUser = await updateProfile(user.id, updateData);
      
      if (values.password) {
        toast({ title: "Success", description: "Profile updated successfully. Please re-login with your new password." });
        logout();
      } else {
        dispatch(updateUser(updatedUser));
        toast({ title: "Success", description: "Profile updated successfully." });
      }

    } catch (error: any) {
      const errorMessage = error.response?.data?.message || "An unexpected error occurred.";
      toast({
        title: "Error updating profile",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  if (loading || !user) {
    return <p>Loading...</p>;
  }
  
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : '?';
  const userRole = getRoleName(user.role_id);
  const slackConnected = slackStatus?.connected ?? user.slack_connected ?? user.has_slack_access_token;

  return (
      <div className="flex flex-col min-h-screen">
          <AppHeader user={user} logout={logout} />
          <header className="sticky top-16 z-20 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background/80 backdrop-blur-sm">
            <h1 className="text-xl font-bold">My Profile</h1>
            <Button type="submit" form="profile-form">Save Changes</Button>
          </header>

          <main className="flex-1 p-4 md:p-8 bg-muted/40 grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <Card>
                <CardHeader className="items-center text-center">
                   <div className="relative">
                     <Avatar className="h-24 w-24 mb-4 cursor-pointer" onClick={handleAvatarClick}>
                        <AvatarImage src={user.profile_picture || `https://placehold.co/100x100.png?text=${userInitial}`} alt={user.name} />
                        <AvatarFallback>{userInitial}</AvatarFallback>
                    </Avatar>
                    {isUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                            <Loader2 className="h-8 w-8 animate-spin text-white" />
                        </div>
                    )}
                   </div>
                   <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                  <CardTitle>{user.name}</CardTitle>
                  <CardDescription>{user.email}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Badge className="w-full justify-center">{userRole}</Badge>
                </CardContent>
              </Card>
            </div>
            <div className="md:col-span-2 space-y-8">
              <Form {...form}>
                <form id="profile-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Update your account&apos;s profile information and email address.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl><Input type="email" {...field} disabled /></FormControl>
                             <FormDescription>Email address cannot be changed.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <h3 className="text-lg font-medium pt-4 border-t">Update Password</h3>
                       <CardDescription>Ensure your account is using a long, random password to stay secure.</CardDescription>
                       <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>New Password</FormLabel>
                            <FormControl><Input type="password" placeholder="Leave blank to keep current password" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="password_confirmation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirm Password</FormLabel>
                            <FormControl><Input type="password" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                </CardContent>
              </Card>
                </form>
              </Form>

              <Card>
                <CardHeader>
                  <CardTitle>Slack Status</CardTitle>
                  <CardDescription>
                    Connect your Slack account so your status updates to &quot;In a call on voice&quot; during live calls.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {slackLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking Slack connection...
                    </div>
                  ) : (
                    <>
                      <div className="rounded-lg border p-4 space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium">
                              {slackConnected ? "Connected to Slack" : "Not connected"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {slackConnected
                                ? slackStatus?.slack_user_id
                                  ? `Slack user ID: ${slackStatus.slack_user_id}`
                                  : "Your Slack account is linked."
                                : slackStatus?.oauth_configured
                                  ? "Authorize Slack once to enable automatic in-call status updates."
                                  : "Ask your admin to configure Slack OAuth in Company Settings before connecting."}
                            </p>
                          </div>
                          <Badge variant={slackConnected ? "default" : "secondary"}>
                            {slackConnected ? "Connected" : "Disconnected"}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {slackConnected ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleDisconnectSlack}
                            disabled={slackActionLoading}
                          >
                            {slackActionLoading ? "Disconnecting..." : "Disconnect Slack"}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            onClick={handleConnectSlack}
                            disabled={slackActionLoading || !slackStatus?.oauth_configured}
                          >
                            {slackActionLoading ? "Redirecting..." : "Connect Slack"}
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <UserDevices />
            </div>
          </main>
        </div>
  );
}
