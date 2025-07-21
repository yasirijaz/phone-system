
"use client";

import { useState, useEffect } from 'react';
import type { Package } from '@/types';
import { getPackages } from '@/services/packageService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/icons';

const features = [
  "Unlimited call logging",
  "AI-powered call categorization",
  "Voicemail transcription",
  "Basic analytics",
  "Email support"
];

const proFeatures = [
    ...features,
    "Advanced call routing",
    "Call recording",
    "Real-time analytics dashboard",
    "Priority support"
];

const enterpriseFeatures = [
    ...proFeatures,
    "Dedicated account manager",
    "Custom integrations (API access)",
    "Skills-based routing",
    "99.9% uptime SLA"
]


const PricingCard = ({ pkg, isFeatured }: { pkg: Package; isFeatured?: boolean }) => {
    const featureList = pkg.title.toLowerCase() === 'enterprise' ? enterpriseFeatures : pkg.title.toLowerCase() === 'pro' ? proFeatures : features;

    return (
        <Card className={`relative flex flex-col ${isFeatured ? 'border-primary ring-2 ring-primary' : ''}`}>
             {isFeatured && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 text-sm font-semibold tracking-wider text-primary-foreground bg-primary rounded-full">
                Most Popular
                </div>
            )}
            <CardHeader className="text-center pt-10">
                <CardTitle className="text-3xl font-bold">{pkg.title}</CardTitle>
                 <CardDescription>
                    <div dangerouslySetInnerHTML={{ __html: pkg.description }} />
                 </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col flex-1">
                <div className="text-center my-4">
                    <span className="text-5xl font-bold tracking-tight">${pkg.price}</span>
                    <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="space-y-3 mb-8 text-left">
                    {featureList.slice(0, 5).map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span>{feature}</span>
                    </li>
                    ))}
                </ul>
                <Button asChild className={`w-full mt-auto ${isFeatured ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'}`}>
                    <Link href="/register">Get Started</Link>
                </Button>
            </CardContent>
        </Card>
    );
};

export default function PricingPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="px-4 lg:px-6 h-14 flex items-center border-b sticky top-0 bg-background/95 z-50">
         <Link href="/" className="flex items-center justify-center gap-2">
           <Logo className="h-6 w-6 text-primary" />
           <span className="font-bold text-lg">CallSync</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Button variant="ghost" asChild>
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Sign Up</Link>
          </Button>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-20 md:py-28 lg:py-32 bg-muted/20">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-3">
                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
                  Simple, Transparent Pricing
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                  Choose the plan that's right for your business. No hidden fees, no surprises.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            {loading ? (
              <p className="text-center">Loading packages...</p>
            ) : (
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto items-start">
                {packages.map(pkg => (
                  <PricingCard key={pkg.id} pkg={pkg} isFeatured={pkg.title.toLowerCase() === 'pro'} />
                ))}
              </div>
            )}
             {packages.length === 0 && !loading && (
                <p className="text-center text-muted-foreground">No active pricing plans available at the moment. Please check back later.</p>
             )}
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/20">
          <div className="container px-4 md:px-6 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>Can I change my plan later?</AccordionTrigger>
                <AccordionContent>
                  Yes, you can upgrade or downgrade your plan at any time from your account settings. Prorated charges or credits will be applied automatically.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>Is there a free trial available?</AccordionTrigger>
                <AccordionContent>
                  We don't offer a free trial, but we do have a 14-day money-back guarantee. If you're not satisfied for any reason, just let us know and we'll refund your payment.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>What kind of support do you offer?</AccordionTrigger>
                <AccordionContent>
                  All our plans come with email support. The Pro plan includes priority email support, and the Enterprise plan includes a dedicated account manager and phone support.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
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
    </div>
  );
}
