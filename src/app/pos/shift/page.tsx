"use client";

import { useEffect, useState } from "react";
import { Clock, LogIn, LogOut } from "lucide-react";
import { fetchOpenShift, fetchPaymentsTotalForStaffToday, fetchShiftsForStaff } from "@/lib/queries";
import { clockIn, clockOut } from "@/lib/mutations";
import { formatCurrency } from "@/lib/format";
import { useAuthStore } from "@/lib/store/authStore";
import type { StaffShift } from "@/lib/types";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ShiftPage() {
  const user = useAuthStore((s) => s.user)!;
  const [openShift, setOpenShift] = useState<StaffShift | null | undefined>(undefined);
  const [history, setHistory] = useState<StaffShift[]>([]);
  const [todaySales, setTodaySales] = useState(0);

  const [startingCash, setStartingCash] = useState("1000");
  const [endingCash, setEndingCash] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    Promise.all([
      fetchOpenShift(user.user_id),
      fetchShiftsForStaff(user.user_id),
      fetchPaymentsTotalForStaffToday(user.user_id),
    ]).then(([open, hist, sales]) => {
      setOpenShift(open);
      setHistory(hist);
      setTodaySales(sales);
    });
  }

  useEffect(load, [user.user_id]);

  async function handleClockIn(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const result = await clockIn(user.user_id, Number(startingCash) || 0);
    setSubmitting(false);
    if (!result.ok) {
      setMessage(result.message ?? "เข้ากะไม่สำเร็จ");
      return;
    }
    load();
  }

  async function handleClockOut(e: React.FormEvent) {
    e.preventDefault();
    if (!openShift) return;
    setSubmitting(true);
    setMessage(null);
    const result = await clockOut(openShift.shift_id, Number(endingCash) || 0, notes || undefined);
    setSubmitting(false);
    if (!result.ok) {
      setMessage(result.message ?? "ออกกะไม่สำเร็จ");
      return;
    }
    setEndingCash("");
    setNotes("");
    load();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <h1 className="text-lg font-bold">Shift Management</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-bg-elevated p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-accent" />
            {openShift === undefined
              ? "กำลังโหลด..."
              : openShift
                ? `เริ่มกะเมื่อ ${formatDateTime(openShift.clock_in)}`
                : "ยังไม่ได้เข้ากะ"}
          </h2>

          {openShift === undefined ? null : openShift ? (
            <form onSubmit={handleClockOut} className="flex flex-col gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-text-muted">เงินสดปลายกะ (บาท)</span>
                <input
                  type="number"
                  value={endingCash}
                  onChange={(e) => setEndingCash(e.target.value)}
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-text-muted">หมายเหตุ (ไม่บังคับ)</span>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </label>
              <button
                disabled={submitting}
                className="flex items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" /> ออกกะ
              </button>
            </form>
          ) : (
            <form onSubmit={handleClockIn} className="flex flex-col gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-text-muted">เงินสดตั้งต้น (บาท)</span>
                <input
                  type="number"
                  value={startingCash}
                  onChange={(e) => setStartingCash(e.target.value)}
                  className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </label>
              <button
                disabled={submitting}
                className="flex items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                <LogIn className="h-4 w-4" /> เข้ากะ
              </button>
            </form>
          )}
          {message && <p className="mt-2 text-xs text-accent">{message}</p>}
        </div>

        <div className="rounded-xl border border-border bg-bg-elevated p-4">
          <h2 className="mb-3 text-sm font-semibold">ยอดขายวันนี้ของคุณ</h2>
          <p className="text-3xl font-bold text-gold">{formatCurrency(todaySales)}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">ประวัติกะการทำงาน</h2>
        {history.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-faint">ยังไม่มีประวัติ</p>
        ) : (
          <div className="space-y-2">
            {history.map((s) => (
              <div
                key={s.shift_id}
                className="flex items-center justify-between rounded-xl border border-border bg-bg-elevated px-4 py-2.5 text-sm"
              >
                <div>
                  <p className="font-medium">{formatDateTime(s.clock_in)}</p>
                  <p className="text-xs text-text-faint">
                    {s.clock_out ? `ถึง ${formatDateTime(s.clock_out)}` : "กำลังทำงาน"}
                  </p>
                </div>
                <div className="text-right text-xs text-text-faint">
                  <p>เริ่ม {formatCurrency(s.starting_cash ?? 0)}</p>
                  {s.ending_cash != null && <p>ปิด {formatCurrency(s.ending_cash)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
