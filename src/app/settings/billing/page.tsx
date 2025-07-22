
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSubscriptionStatus } from "@/services/stripeService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle } from "lucide-react";
import { format } from 'date-fns';

export default function BillingPage() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchSubscription();
    }
  }, [user]);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const data = await getSubscriptionStatus();
      setSubscription(data.subscription);
    } catch (error) {
      console.error("No active subscription found.", error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };
  
  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp * 1000), 'MMMM dd, yyyy');
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent><AppSidebar /></SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 border-b bg-background shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-xl font-bold">Billing</h1>
            </div>
            {/* Future "Manage Subscription" button can go here */}
          </header>

          <main className="flex-1 p-4 md:p-8 bg-muted/40">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Plan</CardTitle>
                <CardDescription>Manage your billing information and subscription.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="ml-2">Loading subscription details...</p>
                  </div>
                ) : subscription ? (
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold">{subscription.plan.nickname || 'Active Plan'}</h3>
                            <p className="text-sm text-muted-foreground">
                                You are currently on the {subscription.plan.nickname} plan.
                            </p>
                        </div>
                         <Badge variant={subscription.status === 'active' ? 'default' : 'destructive'} className="capitalize">
                            {subscription.status}
                        </Badge>
                    </div>
                     <div className="p-4 border rounded-lg">
                         <h4 className="font-semibold mb-2">Plan Details</h4>
                         <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span>${(subscription.plan.amount / 100).toFixed(2)} / {subscription.plan.interval}</span>
                            </li>
                             <li className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span>Next invoice on {formatDate(subscription.current_period_end)}</span>
                            </li>
                         </ul>
                     </div>
                     <div className="flex justify-end">
                        <Button disabled>Change Plan</Button>
                     </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-10">
                    <p>You do not have an active subscription.</p>
                    <Button variant="link" asChild>
                       <a href="/pricing">View Pricing Plans</a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
