"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, UserRound } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import { fetchAllUsers } from "@/lib/queries";
import { updateUserRole } from "@/lib/mutations";
import { formatDate } from "@/lib/format";
import { useAuthStore } from "@/lib/store/authStore";
import type { AppUser, UserRole } from "@/lib/types";

const ROLE_LABEL: Record<UserRole, string> = {
  customer: "ลูกค้า",
  staff: "พนักงาน",
  admin: "Admin",
};

const ROLES: UserRole[] = ["customer", "staff", "admin"];

function StaffContent() {
  const me = useAuthStore((s) => s.user)!;
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    fetchAllUsers()
      .then(setUsers)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleChangeRole(userId: string, role: UserRole) {
    setSavingId(userId);
    setMessage(null);
    const result = await updateUserRole(userId, role);
    setSavingId(null);
    if (!result.ok) {
      setMessage(result.message ?? "เปลี่ยนสิทธิ์ไม่สำเร็จ");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, role } : u)));
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div>
        <h1 className="text-lg font-bold">จัดการสิทธิ์ผู้ใช้</h1>
        <p className="mt-1 text-xs text-text-faint">
          ให้ผู้ใช้สมัครสมาชิกที่หน้า /register ก่อน (จะได้สิทธิ์ &quot;ลูกค้า&quot; โดยอัตโนมัติ)
          แล้วมาปรับเป็น &quot;พนักงาน&quot; หรือ &quot;Admin&quot; ที่นี่ เพื่อให้เข้าใช้งานระบบ POS ได้
        </p>
      </div>

      {message && <p className="text-xs text-accent">{message}</p>}

      {loading ? (
        <p className="py-16 text-center text-sm text-text-faint">กำลังโหลด...</p>
      ) : users.length === 0 ? (
        <p className="py-16 text-center text-sm text-text-faint">ไม่พบผู้ใช้</p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const isSelf = u.user_id === me.user_id;
            return (
              <div
                key={u.user_id}
                className="flex items-center gap-3 rounded-xl border border-border bg-bg-elevated px-4 py-3"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-elevated-2 text-text-muted">
                  <UserRound className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {u.full_name || "(ไม่มีชื่อ)"}
                    {isSelf && <span className="ml-1.5 text-xs text-text-faint">(คุณ)</span>}
                  </p>
                  <p className="truncate text-xs text-text-faint">
                    {u.email} · สมัครเมื่อ {formatDate(u.created_at)}
                  </p>
                </div>
                <span
                  className={
                    u.role === "admin"
                      ? "flex shrink-0 items-center gap-1 rounded-full bg-accent-muted px-2.5 py-1 text-xs font-medium text-accent"
                      : u.role === "staff"
                        ? "flex shrink-0 items-center gap-1 rounded-full bg-gold-muted px-2.5 py-1 text-xs font-medium text-gold"
                        : "flex shrink-0 items-center gap-1 rounded-full bg-bg-elevated-2 px-2.5 py-1 text-xs font-medium text-text-faint"
                  }
                >
                  {u.role === "admin" && <ShieldCheck className="h-3 w-3" />}
                  {ROLE_LABEL[u.role]}
                </span>
                <select
                  value={u.role}
                  disabled={isSelf || savingId === u.user_id}
                  onChange={(e) => handleChangeRole(u.user_id, e.target.value as UserRole)}
                  className="shrink-0 rounded-lg border border-border-strong bg-bg px-2 py-1.5 text-xs outline-none focus:border-accent disabled:opacity-40"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function StaffPage() {
  return (
    <AuthGuard roles={["admin"]}>
      <StaffContent />
    </AuthGuard>
  );
}
