
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { canAccessCompanySettings } from "@/lib/roles";

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    if (!canAccessCompanySettings(user.role_id)) {
      router.replace('/app');
      return;
    }

    if (user.company_id) {
        if (user.role_id === 1) {
            router.replace('/companies');
        } else {
            router.replace(`/companies/${user.company_id}/settings`);
        }
    }
  }, [user, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <p>Redirecting...</p>
    </div>
  );
}

    