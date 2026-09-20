"use client";

import { create } from "zustand";
import { createClient } from "../supabase/client";
import type { AppUser } from "../types";

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  init: () => () => void;
  signUp: (input: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<{ ok: boolean; message?: string; needsEmailConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

function translateAuthError(message: string) {
  if (message.includes("Invalid login credentials")) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (message.includes("already registered") || message.includes("already exists"))
    return "อีเมลนี้ถูกใช้สมัครแล้ว";
  if (message.includes("Password should be at least")) return "รหัสผ่านสั้นเกินไป (อย่างน้อย 6 ตัวอักษร)";
  if (message.includes("Email not confirmed")) return "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ";
  return message;
}

async function fetchProfile(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<AppUser | null> {
  const { data } = await supabase.from("users").select("*").eq("user_id", userId).maybeSingle();
  return data ?? null;
}

export const useAuthStore = create<AuthState>()((set) => {
  const supabase = createClient();

  return {
    user: null,
    loading: true,

    init: () => {
      supabase.auth.getSession().then(async ({ data }) => {
        const sessionUser = data.session?.user;
        const profile = sessionUser ? await fetchProfile(supabase, sessionUser.id) : null;
        set({ user: profile, loading: false });
      });

      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const profile = session?.user ? await fetchProfile(supabase, session.user.id) : null;
        set({ user: profile, loading: false });
      });

      return () => sub.subscription.unsubscribe();
    },

    signUp: async ({ full_name, email, phone, password }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name, phone } },
      });
      if (error) return { ok: false, message: translateAuthError(error.message) };
      if (!data.session) return { ok: true, needsEmailConfirmation: true };
      return { ok: true };
    },

    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, message: translateAuthError(error.message) };
      return { ok: true };
    },

    signOut: async () => {
      await supabase.auth.signOut();
      set({ user: null });
    },

    refreshProfile: async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const profile = await fetchProfile(supabase, data.user.id);
        set({ user: profile });
      }
    },
  };
});
