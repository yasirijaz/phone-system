
"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { getSubscriptionStatus, swapPlan, cancelSubscription } from "@/services/stripeService";
import { getPackages } from "@/services/packageService";
import type { Package } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const featureList = [
    "Unlimited call logging",
    "AI-powered call categorization",
    "Voicemail transcription",
    "Basic analytics",
    "Email support"
];


export default function BillingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [subscription, setSubscription] = useState<any>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const [subData, pkgData] = await Promise.all([
        getSubscriptionStatus(),
        getPackages()
      ]);
      setSubscription(subData.subscription || null);
      setPackages(Array.isArray(pkgData) ? pkgData.filter(p => p.status === 1) : []);
    } catch (error) {
      console.error("Failed to fetch billing data:", error);
      toast({ title: "Error", description: "Could not load billing details. Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchBillingData();
    }
  }, [user]);

  const currentPlan = useMemo(() => {
    if (!subscription || packages.length === 0) return null;
    const currentPriceId = subscription.items?.[0]?.stripe_price || subscription.stripe_price;
    return packages.find(pkg => pkg.price_id === currentPriceId) || null;
  }, [subscription, packages]);

  const handleSwapPlan = async (priceId: string) => {
    setActionLoading(true);
    try {
      await swapPlan(priceId);
      toast({ title: "Success", description: "Your subscription plan has been updated." });
      await fetchBillingData(); // Refresh data
    } catch (error) {
      toast({ title: "Error", description: "Failed to update your plan. Please try again.", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setActionLoading(true);
    try {
      await cancelSubscription();
      toast({ title: "Success", description: "Your subscription has been canceled." });
      await fetchBillingData(); // Refresh data
    } catch (error) {
      toast({ title: "Error", description: "Failed to cancel your subscription. Please contact support.", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const PlanCard = ({ pkg }: { pkg: Package }) => {
    const isCurrent = currentPlan?.id === pkg.id;
    const isUpgrade = !isCurrent && pkg.price > (currentPlan?.price || 0);
    const isDowngrade = !isCurrent && pkg.price < (currentPlan?.price || 0);

    const getButton = () => {
      if (isCurrent) {
        return <Button disabled className="w-full"><CheckCircle className="mr-2 h-4 w-4"/> Current Plan</Button>;
      }
      
      const actionText = isUpgrade ? "Upgrade" : "Downgrade";

      return (
         <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant={isUpgrade ? "default" : "outline"} className="w-full" disabled={actionLoading}>
              {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {actionText}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Plan Change</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to {actionText.toLowerCase()} to the {pkg.title} plan?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleSwapPlan(pkg.price_id)}>
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    }

    return (
       <Card className={isCurrent ? "border-primary" : ""}>
          <CardHeader>
            <CardTitle>{pkg.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-baseline">
                <span className="text-4xl font-bold">${pkg.price}</span>
                <span className="ml-2 text-muted-foreground">/ month</span>
            </div>
            <ul className="space-y-4 text-sm text-muted-foreground">
                {featureList.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>
          </CardContent>
          <CardFooter>
             {getButton()}
          </CardFooter>
        </Card>
    )
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
              <h1 className="text-xl font-bold">Billing & Subscription</h1>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-8 bg-muted/40">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : subscription && subscription.stripe_status === 'active' ? (
              <div className="space-y-8">
                 <Card>
                    <CardHeader>
                        <CardTitle>Your Current Plan</CardTitle>
                        <CardDescription>
                            You are currently subscribed to the <strong>{currentPlan?.title || 'Active'}</strong> plan.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p>Manage your subscription, change plans, or update your payment method below.</p>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                      <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button variant="destructive" disabled={actionLoading}>
                                {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                Cancel Subscription
                              </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                      This will cancel your subscription at the end of your current billing period. This action cannot be undone.
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel>Go Back</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleCancelSubscription}>
                                      Yes, Cancel Subscription
                                  </AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                    </CardFooter>
                </Card>
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {packages.map(pkg => (
                        <PlanCard key={pkg.id} pkg={pkg} />
                    ))}
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-10">
                <Card className="max-w-md mx-auto">
                    <CardHeader>
                        <CardTitle>No Active Subscription</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>You do not have an active subscription.</p>
                    </CardContent>
                    <CardFooter>
                        <Button asChild className="w-full">
                           <Link href="/pricing">View Pricing Plans</Link>
                        </Button>
                    </CardFooter>
                </Card>
              </div>
            )}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
