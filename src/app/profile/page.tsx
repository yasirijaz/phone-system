
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/context/AuthContext";
import { updateProfile } from "@/services/profileService";
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
import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import UserDevices from "@/components/user-devices";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      password: "",
      password_confirmation: "",
    },
  });
  
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && user) {
      setIsUploading(true);
      try {
        const updatedUser = await updateProfile(user.id, { profile_picture: file });
        console.log("🔄 Updating user in store:", updatedUser);
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

  const onSubmit = async (values: z.infer<typeof profileSchema>) => {
    if (!user) return;
    try {
      const updateData: { name: string; email: string; password?: string; password_confirmation?: string } = {
        name: values.name,
        email: values.email,
      };

      if (values.password) {
        updateData.password = values.password;
        updateData.password_confirmation = values.password_confirmation;
      }
      
      const updatedUser = await updateProfile(user.id, updateData);
      
      if (values.password) {
        // If password was changed, logout user
        toast({ title: "Success", description: "Profile updated successfully. Please re-login with your new password." });
        logout();
      } else {
        // If only name/email was changed, update user in store
        console.log("🔄 Updating user in store:", updatedUser);
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
            <div className="md:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Update your account's profile information and email address.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form id="profile-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl><Input {...field} defaultValue={user.name} /></FormControl>
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
                            <FormControl><Input type="email" {...field} defaultValue={user.email} disabled /></FormControl>
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
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <UserDevices />
            </div>
          </main>
        </div>
  );
}
