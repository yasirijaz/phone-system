
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/icons';
import { useAppDispatch, useAppSelector } from '@/store';
import { registerUser } from '@/store/slices/authSlice';


export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const router = useRouter();
  const { toast } = useToast();
  const dispatch = useAppDispatch();
  const { loading, error, user } = useAppSelector((state) => state.auth);


  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== passwordConfirmation) {
      toast({
        title: 'Registration Failed',
        description: 'Passwords do not match.',
        variant: 'destructive',
      });
      return;
    }
    
    dispatch(registerUser({
      name,
      email,
      password,
      password_confirmation: passwordConfirmation,
      subdomain: subdomain
    }));
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Logo className="mx-auto h-12 w-12 text-primary" />
          <CardTitle className="mt-4 text-2xl">Create an Account</CardTitle>
          <CardDescription>Enter your details to get started. Check our <Link href="/pricing" className="underline">pricing plans</Link>.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
                <Label htmlFor="subdomain">Domain</Label>
                <div className="flex items-center">
                  <Input
                    id="subdomain"
                    type="text"
                    placeholder="your-company"
                    required
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    disabled={loading}
                    className="rounded-r-none focus:z-10"
                  />
                  <span className="inline-flex items-center px-3 text-sm text-gray-500 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 h-10">
                    .wsh.com
                  </span>
                </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="password_confirmation">Confirm Password</Label>
              <Input
                id="password_confirmation"
                type="password"
                required
                minLength={6}
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{' '}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
