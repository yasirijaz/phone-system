
'use client';

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { usePathname, useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store';
import { setInitialState, logoutUser } from '@/store/slices/authSlice';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialLoading, setInitialLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { user, loading: authLoading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    dispatch(setInitialState());
    setInitialLoading(false);
  }, [dispatch]);
  
  const logout = () => {
    dispatch(logoutUser());
    router.push('/login');
  };
  
  const unprotectedRoutes = ['/login', '/register', '/pricing', '/forgot-password', '/reset-password'];
  const isProtectedRoute = !unprotectedRoutes.some(route => pathname.startsWith(route));
  const isAuthRoute = ['/login', '/register'].includes(pathname);

  useEffect(() => {
    if (initialLoading) {
      return;
    }

    if (!user && isProtectedRoute) {
        router.replace('/login');
    } else if (user && isAuthRoute) {
        router.replace('/');
    }
  }, [user, initialLoading, pathname, isProtectedRoute, isAuthRoute, router]);

  const isLoading = initialLoading || authLoading;

  if (isLoading || (!user && isProtectedRoute)) {
     return (
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="flex flex-col items-center space-y-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </div>
        </div>
     )
  }

   if (user && isAuthRoute) {
      return (
        <div className="flex items-center justify-center h-screen bg-background">
            <p>Redirecting...</p>
        </div>
      );
  }

  return <AuthContext.Provider value={{ user, loading: isLoading, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
