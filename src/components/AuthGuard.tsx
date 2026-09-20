"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";
import type { UserRole } from "@/lib/types";

export default function AuthGuard({
  children,
  roles,
}: {
  children: React.ReactNode;
  /** When set, only these roles may view children — others see an access-denied screen. */
  roles?: UserRole[];
}) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const signOut = useAuthStore((s) => s.signOut);
  const router = useRouter();
  const pathname = usePathname();

  const forbidden = !loading && !!user && !!roles && !roles.includes(user.role);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, pathname, router]);

  if (loading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-text-faint">
        กำลังโหลด...
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        <p className="text-sm text-text-muted">
          บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานระบบ POS ({user.full_name})
        </p>
        <button
          onClick={async () => {
            await signOut();
            router.replace("/login");
          }}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          ออกจากระบบ
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
