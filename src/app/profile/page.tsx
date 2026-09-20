"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, LogOut, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import { useAuthStore } from "@/lib/store/authStore";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  staff: "พนักงาน",
  customer: "ลูกค้า",
};

function ProfileContent() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user)!;
  const signOut = useAuthStore((s) => s.signOut);

  async function handleLogout() {
    await signOut();
    router.push("/login");
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-10">
      <button
        onClick={() => router.push("/pos/ticketing")}
        className="flex items-center gap-1.5 self-start text-sm text-text-muted hover:text-text"
      >
        <ChevronLeft className="h-4 w-4" /> กลับหน้า POS
      </button>

      <div className="flex flex-col items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-elevated-2 text-text-muted">
          <UserRound className="h-8 w-8" />
        </span>
        <div className="text-center">
          <p className="text-lg font-bold">{user.full_name}</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-muted px-2 py-0.5 text-xs font-medium text-accent">
            <ShieldCheck className="h-3 w-3" /> {ROLE_LABEL[user.role]}
          </span>
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-bg-elevated p-4 text-sm">
        <div className="flex items-center gap-2 text-text-muted">
          <Mail className="h-4 w-4 text-text-faint" /> {user.email}
        </div>
        {user.phone && (
          <div className="flex items-center gap-2 text-text-muted">
            <Phone className="h-4 w-4 text-text-faint" /> {user.phone}
          </div>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="flex items-center justify-center gap-2 rounded-xl border border-accent/40 py-2.5 text-sm font-semibold text-accent hover:bg-accent-muted"
      >
        <LogOut className="h-4 w-4" /> ออกจากระบบ
      </button>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard roles={["staff", "admin"]}>
      <ProfileContent />
    </AuthGuard>
  );
}
