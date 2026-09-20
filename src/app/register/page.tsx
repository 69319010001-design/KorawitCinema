"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clapperboard, Mail, Lock, User, Phone } from "lucide-react";
import { useAuthStore } from "@/lib/store/authStore";

export default function RegisterPage() {
  const router = useRouter();
  const signUp = useAuthStore((s) => s.signUp);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (password !== confirm) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }

    setSubmitting(true);
    const result = await signUp({
      full_name: fullName,
      email,
      phone,
      password,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message ?? "สมัครสมาชิกไม่สำเร็จ");
      return;
    }
    if (result.needsEmailConfirmation) {
      setInfo("สมัครสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");
      setTimeout(() => router.replace("/login"), 1500);
      return;
    }
    router.replace("/");
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
        <p className="text-sm text-text-faint">สมัครสมาชิกใหม่ ใช้เวลาไม่ถึงนาที</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-bg-elevated p-6"
      >
        <Field icon={User} label="ชื่อ-นามสกุล">
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="โกรวิท ใจดี"
            className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
          />
        </Field>
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
        <Field icon={Phone} label="เบอร์โทรศัพท์">
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08X-XXX-XXXX"
            className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
          />
        </Field>
        <Field icon={Lock} label="รหัสผ่าน">
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="อย่างน้อย 6 ตัวอักษร"
            className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
          />
        </Field>
        <Field icon={Lock} label="ยืนยันรหัสผ่าน">
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="พิมพ์รหัสผ่านอีกครั้ง"
            className="w-full bg-transparent text-sm outline-none placeholder:text-text-faint"
          />
        </Field>

        {error && <p className="text-sm text-accent">{error}</p>}
        {info && <p className="text-sm text-success">{info}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          สมัครสมาชิก
        </button>

        <p className="text-center text-sm text-text-faint">
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/login" className="font-medium text-accent">
            เข้าสู่ระบบ
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
