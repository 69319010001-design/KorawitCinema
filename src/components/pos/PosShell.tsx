"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Clapperboard,
  Gift,
  LayoutDashboard,
  LogOut,
  Popcorn,
  Receipt,
  Ticket,
  Users,
} from "lucide-react";
import clsx from "clsx";
import { useAuthStore } from "@/lib/store/authStore";

const NAV_LINKS = [
  { href: "/pos/ticketing", label: "Ticketing", icon: Ticket },
  { href: "/pos/concession", label: "Concession", icon: Popcorn },
  { href: "/pos/gift-cards", label: "Gift Card", icon: Gift },
  { href: "/pos/reservations", label: "Reservations", icon: Receipt },
  { href: "/pos/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

const ADMIN_NAV_LINK = { href: "/pos/staff", label: "Staff", icon: Users };

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  staff: "พนักงาน",
  customer: "ลูกค้า",
};

export default function PosShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  async function handleLogout() {
    await signOut();
    router.push("/login");
  }

  return (
    <div className="flex min-h-svh flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-bg-elevated">
        <Link href="/pos/ticketing" className="flex items-center gap-2 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent">
            <Clapperboard className="h-5 w-5 text-white" strokeWidth={2} />
          </span>
          <span className="text-sm font-bold leading-tight">
            Korawit
            <br />
            <span className="text-[10px] font-medium tracking-[0.3em] text-text-faint">
              CINEMA
            </span>
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          {[...NAV_LINKS, ...(user?.role === "admin" ? [ADMIN_NAV_LINK] : [])].map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-white"
                    : "text-text-muted hover:bg-bg-elevated-2 hover:text-text",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={active ? 2.4 : 1.8} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 border-t border-border px-4 py-4">
          <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-muted text-sm font-bold text-accent">
              {user?.full_name?.[0]?.toUpperCase() ?? "?"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user?.full_name ?? "..."}</p>
              <p className="truncate text-xs text-text-faint">
                {user ? ROLE_LABEL[user.role] : ""}
              </p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            aria-label="ออกจากระบบ"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-faint transition-colors hover:bg-accent-muted hover:text-accent"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
