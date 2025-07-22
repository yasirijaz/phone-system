
"use client";

import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { subscribeToPlan } from '@/services/stripeService';
import type { Package } from '@/types';
import { useRouter } from 'next/navigation';

interface SubscriptionFormProps {
    selectedPackage: Package;
    isSubscribing: boolean;
    setIsSubscribing: (isSubscribing: boolean) => void;
    onSuccess: () => void;
}

export default function SubscriptionForm({ selectedPackage, isSubscribing, setIsSubscribing, onSuccess }: SubscriptionFormProps) {
    const stripe = useStripe();
    const elements = useElements();
    const { toast } = useToast();
    const router = useRouter();

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSubscribing(true);

        if (!stripe || !elements) {
            toast({ title: 'Error', description: 'Stripe is not initialized.', variant: 'destructive' });
            setIsSubscribing(false);
            return;
        }

        try {
            const { error: submitError } = await elements.submit();
            if (submitError) {
                toast({ title: 'Payment Error', description: submitError.message, variant: 'destructive' });
                setIsSubscribing(false);
                return;
            }
            
            const { error: confirmError, setupIntent } = await stripe.confirmSetup({
                elements,
                redirect: 'if_required',
            });

            if (confirmError) {
                toast({ title: 'Payment Error', description: confirmError.message, variant: 'destructive' });
                setIsSubscribing(false);
                return;
            }

            if (setupIntent?.status === 'succeeded') {
                const paymentMethodId = setupIntent.payment_method as string;
                await subscribeToPlan(paymentMethodId, selectedPackage.price_id);
                
                toast({ title: 'Success!', description: `You've subscribed to the ${selectedPackage.title} plan.` });
                onSuccess();
                router.push('/');
            } else {
                 toast({ title: 'Error', description: 'Could not process payment method. Please try again.', variant: 'destructive' });
            }

        } catch (error: any) {
            toast({ title: 'Subscription Error', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
        } finally {
            setIsSubscribing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <PaymentElement />
            <Button disabled={!stripe || isSubscribing} className="w-full mt-4">
                {isSubscribing ? 'Processing...' : `Subscribe for $${selectedPackage.price}/mo`}
            </Button>
        </form>
    );
}
