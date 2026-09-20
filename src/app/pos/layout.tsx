"use client";

import AuthGuard from "@/components/AuthGuard";
import PosShell from "@/components/pos/PosShell";
import PosTopBar from "@/components/pos/PosTopBar";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard roles={["staff", "admin"]}>
      <PosShell>
        <PosTopBar />
        <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
      </PosShell>
    </AuthGuard>
  );
}
