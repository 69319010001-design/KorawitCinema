"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";

export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/pos/ticketing" : "/login");
  }, [loading, user, router]);

  return (
    <div className="flex flex-1 items-center justify-center py-24 text-sm text-text-faint">
      กำลังโหลด...
    </div>
  );
}
