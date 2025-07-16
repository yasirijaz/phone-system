
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function UsersRedirectPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user?.company_id) {
      if(user.role_id === 1) {
        router.replace(`/companies`);
      } else {
        router.replace(`/companies/${user.company_id}/users`);
      }
    } else if(user && user.role_id !== 1) {
        // Fallback for user without company_id, maybe redirect to a different page
        router.replace('/');
    }
  }, [user, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <p>Redirecting...</p>
    </div>
  );
}

    