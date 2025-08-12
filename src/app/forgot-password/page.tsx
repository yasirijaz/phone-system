
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';
import { useAppDispatch, useAppSelector } from '@/store';
import { forgotPassword } from '@/store/slices/authSlice';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((state) => state.auth);
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    const result = await dispatch(forgotPassword({ email }));
    if (forgotPassword.fulfilled.match(result)) {
        toast({
            title: 'Success',
            description: "Redirecting you to reset your password.",
        });
        // The API sends back the full URL in the 'email' field.
        if (result.payload?.email) {
            router.push(result.payload.email);
        } else {
             setMessage("Could not get reset link. Please try again.");
        }
    } else if (forgotPassword.rejected.match(result)) {
        const errorMessage = typeof result.payload === 'string' ? result.payload : 'An unknown error occurred';
         toast({
            title: 'Error',
            description: errorMessage,
            variant: 'destructive',
        });
        setMessage(errorMessage);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Logo className="mx-auto h-12 w-12 text-primary" />
          <CardTitle className="mt-4 text-2xl">Forgot Password</CardTitle>
          <CardDescription>
            Enter your email and we'll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleForgotPassword} className="space-y-4">
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
          {message && <p className={`mt-4 text-center text-sm ${error ? 'text-destructive' : 'text-foreground'}`}>{message}</p>}
          <div className="mt-4 text-center text-sm">
            Remember your password?{' '}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
