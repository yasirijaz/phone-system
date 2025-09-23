
"use client";

import { useState, useEffect } from 'react';
import type { Package } from '@/types';
import { getPackages } from '@/services/packageService';
import Link from 'next/link';
import { Logo } from '@/components/icons';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import SubscriptionForm from '@/components/subscription-form';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { getSetupIntent } from '@/services/stripeService';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Check } from 'lucide-react';

const featureList = [
    "Unlimited call logging",
    "AI-powered call categorization",
    "Voicemail transcription",
    "Basic analytics",
    "Email support"
];

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY 
    ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    : null;

const PricingCard = ({ pkg, onPurchase, isFeatured }: { pkg: Package; onPurchase: (pkg: Package) => void; isFeatured?: boolean }) => {
    const { user } = useAuth();

    return (
       <Card className={isFeatured ? "border-primary" : ""}>
          <CardHeader>
            <CardTitle>{pkg.title}</CardTitle>
            <p className='text-muted'>{pkg.description}</p>
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
             {user ? (
                 <Button onClick={() => onPurchase(pkg)} className="w-full">
                    Purchase Plan
                </Button>
             ) : (
                <Button asChild className="w-full">
                    <Link href="/register">Get Started</Link>
                </Button>
             )}
          </CardFooter>
        </Card>
    );
};


export default function PricingPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const data = await getPackages();
        if (Array.isArray(data)) {
          setPackages(data.filter(p => p.status === 1));
        }
      } catch (error) {
        console.error("Failed to fetch packages:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPackages();
  }, []);
  
  const handlePurchase = async (pkg: Package) => {
      setSelectedPackage(pkg);
      setIsSubscribing(true);
      try {
        const { client_secret } = await getSetupIntent();
        setClientSecret(client_secret);
      } catch (error) {
        toast({ title: 'Error', description: 'Could not prepare payment form. Please try again.', variant: 'destructive' });
        setSelectedPackage(null);
      } finally {
          setIsSubscribing(false);
      }
  };
  
  const handleDialogClose = () => {
    if (!isSubscribing) {
        setSelectedPackage(null);
        setClientSecret(null);
    }
  }

  if (!stripePromise) {
    return (
        <div className="flex h-screen items-center justify-center">
            <p className="text-center text-red-500">Stripe is not configured. Please add your Stripe publishable key to the environment variables.</p>
        </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background dark:bg-gray-900">
      <header className="px-4 lg:px-6 h-14 flex items-center border-b sticky top-0 bg-background/95 z-50">
         <Link href="/" className="flex items-center justify-center gap-2">
           <Logo className="h-6 w-12" />
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link href="/login" className="text-sm font-medium hover:underline underline-offset-4">Login</Link>
          <Link href="/register" className="text-sm font-medium hover:underline underline-offset-4">Sign Up</Link>
        </nav>
      </header>
      <main className="flex-1">
        <section className="py-24 md:py-24">
            <div className="container px-4 md:px-6">
                <div className="mb-12 text-center">
                    <h1 className="text-2xl font-bold tracking-tighter sm:text-4xl">Simple, Transparent Pricing</h1>
                    <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl mt-4">
                        Choose the plan that's right for your business. No hidden fees, no surprises.
                    </p>
                </div>

                {loading ? (
                  <p className="text-center">Loading packages...</p>
                ) : (
                    <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                        {packages.map(pkg => (
                            <PricingCard key={pkg.id} pkg={pkg} onPurchase={handlePurchase} isFeatured={pkg.title.toLowerCase() === 'pro'} />
                        ))}
                    </div>
                )}
                 {packages.length === 0 && !loading && (
                    <p className="text-center text-muted-foreground">No active pricing plans available at the moment. Please check back later.</p>
                 )}
            </div>
        </section>
      </main>

      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} by Windshield Hub. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Terms of Service
          </Link>
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Privacy
          </Link>
        </nav>
      </footer>
       
      {selectedPackage && clientSecret && (
        <Dialog open={!!(selectedPackage && clientSecret)} onOpenChange={handleDialogClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Subscribe to {selectedPackage.title}</DialogTitle>
                    <DialogDescription>
                        Complete your subscription by providing your payment details below.
                    </DialogDescription>
                </DialogHeader>
                 <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <SubscriptionForm 
                        selectedPackage={selectedPackage}
                        isSubscribing={isSubscribing}
                        setIsSubscribing={setIsSubscribing}
                        onSuccess={() => {
                            setSelectedPackage(null);
                            setClientSecret(null);
                        }}
                    />
                </Elements>
            </DialogContent>
        </Dialog>
      )}

    </div>
  );
}

    
