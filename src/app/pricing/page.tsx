
"use client";

import { useState, useEffect } from 'react';
import type { Package } from '@/types';
import { getPackages } from '@/services/packageService';
import Link from 'next/link';
import { Logo } from '@/components/icons';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import SubscriptionForm from '@/components/subscription-form';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { getSetupIntent } from '@/services/stripeService';
import { useToast } from '@/hooks/use-toast';

const featureList = [
    "Unlimited call logging",
    "AI-powered call categorization",
    "Voicemail transcription",
    "Basic analytics",
    "Email support"
];

const CheckIcon = () => (
    <svg className="flex-shrink-0 w-6 h-6 text-indigo-600" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 14.7875L13.0959 17.8834C13.3399 18.1274 13.7353 18.1275 13.9794 17.8838L20.625 11.25M15 27.5C8.09644 27.5 2.5 21.9036 2.5 15C2.5 8.09644 8.09644 2.5 15 2.5C21.9036 2.5 27.5 8.09644 27.5 15C27.5 21.9036 21.9036 27.5 15 27.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY 
    ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    : null;


const PricingCard = ({ pkg, onPurchase, isFeatured }: { pkg: Package; onPurchase: (pkg: Package) => void; isFeatured?: boolean }) => {
    const { user } = useAuth();

    return (
       <div className={`flex flex-col mx-auto max-w-sm text-gray-900 rounded-2xl transition-all duration-500 ${isFeatured ? 'bg-indigo-50 hover:bg-indigo-100' : 'bg-gray-50 hover:bg-gray-100'}`}>
            {isFeatured && (
                 <div className="uppercase bg-gradient-to-r from-indigo-600 to-violet-600 rounded-t-2xl p-3 text-center text-white">
                    MOST POPULAR
                </div>
            )}
            <div className="p-6 xl:py-9 xl:px-12">
                <h3 className="font-manrope text-2xl font-bold mb-3">{pkg.title}</h3>
                <div className="flex items-center mb-6">
                    <span className={`font-manrope mr-2 text-6xl font-semibold ${isFeatured ? 'text-indigo-600' : ''}`}>${pkg.price}</span>
                    <span className="text-xl text-gray-500">/ month</span>
                </div>
                <div className="mb-8" dangerouslySetInnerHTML={{ __html: pkg.description }}></div>
                <ul className="mb-12 space-y-6 text-left text-lg text-gray-500">
                   {featureList.map((feature, i) => (
                        <li key={i} className="flex items-center space-x-4">
                            <CheckIcon />
                            <span>{feature}</span>
                        </li>
                    ))}
                </ul>
                 {user ? (
                     <button onClick={() => onPurchase(pkg)} className="py-2.5 px-5 bg-indigo-600 shadow-sm rounded-full transition-all duration-500 text-base text-white font-semibold text-center w-fit block mx-auto hover:bg-indigo-700">
                        Purchase Plan
                    </button>
                 ) : (
                    <Link href="/register" className="py-2.5 px-5 bg-indigo-600 shadow-sm rounded-full transition-all duration-500 text-base text-white font-semibold text-center w-fit block mx-auto hover:bg-indigo-700">
                        Get Started
                    </Link>
                 )}
            </div>
        </div>
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
      setIsSubscribing(true); // Show loading state on button
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
           <Logo className="h-6 w-6 text-primary" />
           <span className="font-bold text-lg">CallSync</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link href="/login" className="text-sm font-medium hover:underline underline-offset-4">Login</Link>
          <Link href="/register" className="text-sm font-medium hover:underline underline-offset-4">Sign Up</Link>
        </nav>
      </header>
      <main className="flex-1">
        <section className="py-24">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mb-12">
                    <h2 className="font-manrope text-5xl text-center font-bold text-gray-900 dark:text-white mb-4">Choose your plan</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-center leading-6 mb-9">7 Days free trial. No credit card required.</p>
                    <div className="flex justify-center items-center">
                        <label htmlFor="billing-cycle" className="min-w-[3.5rem] text-xl relative text-gray-900 dark:text-white mr-4 font-medium">Bill Monthly</label>
                        <input type="checkbox" id="billing-cycle" className="relative shrink-0 w-11 h-6 p-0.5 bg-indigo-100 checked:bg-none checked:bg-indigo-100 rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:border-blue-600 appearance-none before:inline-block before:w-5 before:h-5 before:bg-indigo-600 checked:before:bg-indigo-600 before:translate-x-0 checked:before:translate-x-full before:shadow before:rounded-full before:transform before:transition before:ease-in-out before:duration-200" />
                        <label htmlFor="billing-cycle" className="relative min-w-[3.5rem] font-medium text-xl text-gray-500 dark:text-gray-400 ml-4">Bill Yearly</label>
                    </div>
                </div>

                {loading ? (
                  <p className="text-center">Loading packages...</p>
                ) : (
                    <div className="space-y-8 lg:grid lg:grid-cols-3 sm:gap-6 xl:gap-8 lg:space-y-0 lg:items-center">
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
        <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} CallSync. All rights reserved.</p>
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
