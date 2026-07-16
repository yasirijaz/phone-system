
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isElectron } from '@/lib/is-electron';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const inElectron = isElectron();

  useEffect(() => {
    if (!user) return;
    if (user.role_id === 1) {
      router.replace('/companies');
      return;
    }
    if (inElectron) {
      router.replace('/app');
    } else {
      router.replace('/dashboard');
    }
  }, [user, router, inElectron]);

  return null;
}
