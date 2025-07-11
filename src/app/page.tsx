
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      if (user.role_id === 1) {
        router.replace('/companies');
      } else {
        router.replace('/dashboard/ecommerce');
      }
    }
  }, [user, router]);

  return null;
}
