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
  const { user, loading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    dispatch(setInitialState());
    setInitialLoading(false);
  }, [dispatch]);
  
  const logout = () => {
    dispatch(logoutUser());
  };
  
  const isProtectedRoute = pathname === '/';
  const isAuthRoute = pathname === '/login' || pathname === '/register';
  
  useEffect(() => {
    if (!initialLoading && !loading) {
      if (user) {
        if (isAuthRoute) {
          router.replace('/');
        }
      } else {
        if (isProtectedRoute) {
          router.replace('/login');
        }
      }
    }
  }, [user, initialLoading, loading, router, isProtectedRoute, isAuthRoute, pathname]);

  if (initialLoading || loading || (!user && isProtectedRoute) || (user && isAuthRoute)) {
     return (
        <div className="flex items-center justify-center h-screen">
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

  return <AuthContext.Provider value={{ user, loading, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
