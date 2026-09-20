"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Clapperboard, Lock, Mail } from "lucide-react";
import { useAuthStore } from "@/lib/store/authStore";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const signIn = useAuthStore((s) => s.signIn);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signIn(email, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message ?? "เข้าสู่ระบบไม่สำเร็จ");
      return;
    }
    router.replace(params.get("redirect") || "/");
  }

  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 flex flex-col items-center gap-2">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
          <Clapperboard className="h-7 w-7 text-white" />
        </span>
        <h1 className="text-2xl font-bold">
          Korawit<span className="text-accent">Cinema</span>
        </h1>
        <p className="text-sm text-text-faint">เข้าสู่ระบบเพื่อจองตั๋วหนัง</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-bg-elevated p-6"
      >
        <Field icon={Mail} label="อีเมล">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
          />
        </Field>
        <Field icon={Lock} label="รหัสผ่าน">
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
          />
        </Field>

        {error && <p className="text-sm text-accent">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          เข้าสู่ระบบ
        </button>

        <p className="text-center text-sm text-text-faint">
          ยังไม่มีบัญชี?{" "}
          <Link href="/register" className="font-medium text-accent">
            สมัครสมาชิก
          </Link>
        </p>
      </form>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-text-muted">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2.5 focus-within:border-accent">
        <Icon className="h-4 w-4 shrink-0 text-text-faint" />
        {children}
      </div>
    </label>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
