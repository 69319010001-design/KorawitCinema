"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, Plus, Search } from "lucide-react";
import clsx from "clsx";
import { fetchAllBookingsWithDetail } from "@/lib/queries";
import { effectiveStatus } from "@/lib/mutations";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";
import type { BookingStatus, BookingWithDetail } from "@/lib/types";

const STATUS_META: Record<BookingStatus, { label: string; className: string }> = {
  confirmed: { label: "สำเร็จ", className: "bg-success-muted text-success" },
  pending_payment: { label: "รอชำระเงิน", className: "bg-warning/15 text-warning" },
  expired: { label: "หมดเวลา", className: "bg-bg-elevated-2 text-text-faint" },
  cancelled: { label: "ยกเลิกแล้ว", className: "bg-bg-elevated-2 text-text-faint" },
};

const FILTERS: { key: BookingStatus | "all"; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "confirmed", label: "สำเร็จ" },
  { key: "pending_payment", label: "รอชำระเงิน" },
  { key: "cancelled", label: "ยกเลิก/หมดเวลา" },
];

export default function ReservationsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingWithDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BookingStatus | "all">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchAllBookingsWithDetail()
      .then(setBookings)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter((b) => {
      const status = effectiveStatus(b);
      if (filter === "cancelled") {
        if (status !== "cancelled" && status !== "expired") return false;
      } else if (filter !== "all" && status !== filter) {
        return false;
      }
      if (!q) return true;
      return (
        b.booking_code.toLowerCase().includes(q) || b.movie_title.toLowerCase().includes(q)
      );
    });
  }, [bookings, filter, query]);

  function openBooking(b: BookingWithDetail) {
    const status = effectiveStatus(b);
    if (status === "confirmed") router.push(`/bookings/${b.booking_id}/ticket`);
    else if (status === "pending_payment") router.push(`/bookings/${b.booking_id}/payment`);
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-bold">Reservations</h1>
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหารหัสจอง หรือชื่อหนัง..."
            className="w-full rounded-xl border border-border bg-bg-elevated py-2.5 pl-9 pr-3 text-sm placeholder:text-text-faint focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={clsx(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              filter === f.key
                ? "bg-accent text-white"
                : "bg-bg-elevated text-text-muted hover:text-text",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-text-faint">กำลังโหลด...</p>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-text-faint">ไม่พบรายการจอง</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => {
            const status = effectiveStatus(b);
            const meta = STATUS_META[status];
            const clickable = status === "confirmed" || status === "pending_payment";
            return (
              <div
                key={b.booking_id}
                className={clsx(
                  "flex flex-col gap-1.5 rounded-xl border border-border bg-bg-elevated p-4 transition-colors",
                  !clickable && "opacity-60",
                )}
              >
                <button
                  onClick={() => openBooking(b)}
                  disabled={!clickable}
                  className="flex flex-col gap-1.5 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{b.movie_title || "—"}</p>
                    <span className={clsx("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", meta.className)}>
                      {meta.label}
                    </span>
                  </div>
                  <p className="flex items-center gap-1 truncate text-xs text-text-faint">
                    <MapPin className="h-3 w-3 shrink-0" /> {b.cinema_name} · {b.hall_name}
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-text-faint">
                    <CalendarDays className="h-3 w-3 shrink-0" />
                    {formatDate(b.start_time)} · {formatTime(b.start_time)} น.
                  </p>
                  <p className="mt-1 text-xs font-medium text-text-muted">
                    {formatCurrency(b.total_amount)} · {b.booking_code}
                  </p>
                </button>

                {status === "confirmed" && (
                  <button
                    onClick={() => router.push(`/pos/reservations/${b.booking_id}/add-items`)}
                    className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-border-strong py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-accent"
                  >
                    <Plus className="h-3.5 w-3.5" /> เพิ่มเครื่องดื่ม/ของทานเล่น
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
