
"use client";

import { useState, useEffect } from 'react';
import type { Package } from '@/types';
import { getPackages } from '@/services/packageService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/icons';

const PricingCard = ({ pkg, isFeatured }: { pkg: Package; isFeatured?: boolean }) => (
  <Card className={isFeatured ? 'border-primary ring-2 ring-primary' : ''}>
    <CardHeader className="text-center">
      <CardTitle className="text-2xl">{pkg.title}</CardTitle>
      <CardDescription>{pkg.description}</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="text-center my-4">
        <span className="text-4xl font-bold">${pkg.price}</span>
        <span className="text-muted-foreground">/month</span>
      </div>
      <ul className="space-y-3 mb-6">
        {['Feature one', 'Feature two', 'Feature three'].map((feature, i) => (
          <li key={i} className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Button asChild className={`w-full ${isFeatured ? '' : 'bg-primary/90'}`}>
        <Link href="/register">Get Started</Link>
      </Button>
    </CardContent>
  </Card>
);

export default function PricingPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const data = await getPackages();
        setPackages(data.filter(p => p.status === 1));
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
      <header className="px-4 lg:px-6 h-14 flex items-center border-b">
         <Link href="/" className="flex items-center justify-center">
           <Logo className="h-6 w-6 text-primary" />
           <span className="sr-only">CallSync</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link className="text-sm font-medium hover:underline underline-offset-4" href="/login">
            Login
          </Link>
          <Button asChild>
            <Link href="/register">Sign Up</Link>
          </Button>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 bg-muted/40">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
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
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
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
      </main>
    </div>
  );
}
