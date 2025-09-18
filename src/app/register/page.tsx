
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/icons';
import { useAppDispatch, useAppSelector } from '@/store';
import { registerUser } from '@/store/slices/authSlice';
import { useForm, type FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Progress } from '@/components/ui/progress';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';

const nameEmailSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
});

const domainSchema = z.object({
  subdomain: z.string().min(2, "Subdomain must be at least 2 characters."),
});

const passwordSchema = z.object({
    password: z.string().min(6, "Password must be at least 6 characters."),
    password_confirmation: z.string()
}).refine(data => data.password === data.password_confirmation, {
    message: "Passwords do not match",
    path: ["password_confirmation"],
});

const totalSteps = 3;

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({});
  const router = useRouter();
  const { toast } = useToast();
  const dispatch = useAppDispatch();
  const { loading, error, user } = useAppSelector((state) => state.auth);

  const currentValidationSchema = 
    step === 1 ? nameEmailSchema : 
    step === 2 ? domainSchema : 
    passwordSchema;

  const { 
    control, 
    trigger, 
    getValues,
    register,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(currentValidationSchema),
    mode: "onChange"
  });

  const handleNext = async () => {
    const isValid = await trigger();
    if (isValid) {
      setFormData(prev => ({ ...prev, ...getValues() }));
      if (step < totalSteps) {
        setStep(step + 1);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
     const isValid = await trigger();
    if (!isValid) return;

    const finalData = { ...formData, ...getValues() };
    
    dispatch(registerUser(finalData));
  };
  
  useEffect(() => {
    if (error) {
      toast({
        title: 'Registration Failed',
        description: error,
        variant: 'destructive',
      });
    }
    if (user) {
      router.push('/');
    }
  }, [error, user, router, toast]);

  const variants = {
    hidden: { opacity: 0, x: 50 },
    enter: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -50 },
  };

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-2">
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
            <div>
                 <Link href="/" className="flex items-center gap-2 mb-6">
                    <Logo className="h-8 w-16" />
                    <span className="font-bold text-2xl">by Windshield Hub</span>
                </Link>
                <h2 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
                    Create an account
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    Already have an account?{' '}
                    <Link href="/login" className="font-medium text-primary hover:underline">
                        Sign in
                    </Link>
                </p>
            </div>

            <div className="space-y-6">
              <Progress value={(step / totalSteps) * 100} className="h-2" />
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial="hidden"
                  animate="enter"
                  exit="exit"
                  variants={variants}
                  transition={{ duration: 0.3 }}
                >
                  <form onSubmit={step === totalSteps ? handleRegister : (e) => {e.preventDefault(); handleNext();}} className="space-y-6">
                      {step === 1 && (
                          <div className="space-y-4">
                              <div>
                                <Label htmlFor="name">Name</Label>
                                <Input id="name" type="text" placeholder="John Doe" required {...register('name')} />
                                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message as string}</p>}
                              </div>
                              <div>
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" placeholder="m@example.com" required {...register('email')} />
                                 {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message as string}</p>}
                              </div>
                          </div>
                      )}
                      {step === 2 && (
                         <div>
                            <Label htmlFor="subdomain">Company Domain</Label>
                            <div className="flex items-center">
                              <Input id="subdomain" type="text" placeholder="your-company" required {...register('subdomain')} className="rounded-r-none focus:z-10" />
                              <span className="inline-flex items-center px-3 text-sm text-gray-500 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 h-10">.windshieldhub.com</span>
                            </div>
                             {errors.subdomain && <p className="text-sm text-destructive mt-1">{errors.subdomain.message as string}</p>}
                         </div>
                      )}
                      {step === 3 && (
                          <div className="space-y-4">
                              <div>
                                <Label htmlFor="password">Password</Label>
                                <Input id="password" type="password" required minLength={6} {...register('password')} />
                                 {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message as string}</p>}
                              </div>
                               <div>
                                <Label htmlFor="password_confirmation">Confirm Password</Label>
                                <Input id="password_confirmation" type="password" required minLength={6} {...register('password_confirmation')} />
                                 {errors.password_confirmation && <p className="text-sm text-destructive mt-1">{errors.password_confirmation.message as string}</p>}
                              </div>
                          </div>
                      )}
                      <div className="flex justify-between pt-4">
                          {step > 1 && (
                              <Button type="button" variant="outline" onClick={handleBack}>Back</Button>
                          )}
                           <div className="flex-grow" />
                          {step < totalSteps ? (
                              <Button type="button" onClick={handleNext}>Continue</Button>
                          ) : (
                              <Button type="submit" disabled={loading}>
                                {loading ? 'Creating Account...' : 'Create Account'}
                              </Button>
                          )}
                      </div>
                  </form>
                </motion.div>
              </AnimatePresence>
            </div>
             <p className="px-8 text-center text-sm text-muted-foreground">
                By clicking continue, you agree to our{' '}
                <Link href="#" className="underline underline-offset-4 hover:text-primary">Terms of Service</Link>
                {' '}and{' '}
                <Link href="#" className="underline underline-offset-4 hover:text-primary">Privacy Policy</Link>
                .
            </p>
        </div>
      </div>
      <div className="hidden lg:flex items-center justify-center bg-muted p-10">
        <Image 
            src="https://placehold.co/800x1000.png"
            alt="Product demonstration"
            width={800}
            height={1000}
            className="rounded-2xl object-cover w-full h-full"
            data-ai-hint="communication app interface"
        />
      </div>
    </div>
  );
}

    
