"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/store/authStore";

/** Starts the single Supabase auth-state subscription for the whole app. */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const unsubscribe = useAuthStore.getState().init();
    return unsubscribe;
  }, []);

  return <>{children}</>;
}
