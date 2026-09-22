"use client";

import { useEffect, useMemo, useState } from "react";
import { Armchair, Clock3, Popcorn, TrendingUp } from "lucide-react";
import clsx from "clsx";
import {
  fetchConfirmedBookingsSince,
  fetchTodayOccupancy,
} from "@/lib/queries";
import type { DashboardBookingRow, ShowtimeOccupancy } from "@/lib/queries";
import { formatCurrency, formatTime } from "@/lib/format";

type Period = "today" | "7d" | "30d";

const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: "today", label: "วันนี้", days: 1 },
  { key: "7d", label: "7 วันล่าสุด", days: 7 },
  { key: "30d", label: "30 วันล่าสุด", days: 30 },
];

function sinceForPeriod(period: Period): Date {
  const days = PERIODS.find((p) => p.key === period)!.days;
  if (period === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated p-4">
      <div className="mb-2 flex items-center gap-2 text-text-faint">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-text-faint">{sub}</p>}
    </div>
  );
}

function RankedList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; barPct: number }[];
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated p-4">
      <h2 className="mb-3 text-sm font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-text-faint">ยังไม่มีข้อมูลในช่วงนี้</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={r.label + i}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="truncate pr-2 font-medium text-text">
                  {i + 1}. {r.label}
                </span>
                <span className="shrink-0 text-text-faint">{r.value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-bg-elevated-2">
                <div
                  className="h-1.5 rounded-full bg-accent"
                  style={{ width: `${Math.max(4, r.barPct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("today");
  const [bookings, setBookings] = useState<DashboardBookingRow[]>([]);
  const [occupancy, setOccupancy] = useState<ShowtimeOccupancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [bookingRows, occupancyRows] = await Promise.all([
          fetchConfirmedBookingsSince(sinceForPeriod(period)),
          fetchTodayOccupancy(),
        ]);
        if (cancelled) return;
        setBookings(bookingRows);
        setOccupancy(occupancyRows);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const stats = useMemo(() => {
    let addonRevenue = 0;
    let ticketsSold = 0;
    const byMovie = new Map<string, number>();
    const byAddon = new Map<string, { qty: number; revenue: number }>();
    const byHour = new Map<number, number>();

    for (const b of bookings) {
      ticketsSold += b.seats_booked;
      if (b.movie_title) {
        byMovie.set(b.movie_title, (byMovie.get(b.movie_title) ?? 0) + b.seats_booked);
      }
      for (const a of b.addons) {
        addonRevenue += a.price_each * a.quantity;
        const prev = byAddon.get(a.name) ?? { qty: 0, revenue: 0 };
        byAddon.set(a.name, {
          qty: prev.qty + a.quantity,
          revenue: prev.revenue + a.price_each * a.quantity,
        });
      }
      const hour = new Date(b.created_at).getHours();
      byHour.set(hour, (byHour.get(hour) ?? 0) + b.total_amount);
    }

    const totalRevenue = bookings.reduce((sum, b) => sum + b.total_amount, 0);
    const ticketRevenue = totalRevenue - addonRevenue;

    const topMovies = Array.from(byMovie, ([label, qty]) => ({ label, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
    const maxMovieQty = topMovies[0]?.qty ?? 1;

    const topAddons = Array.from(byAddon, ([label, v]) => ({ label, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
    const maxAddonQty = topAddons[0]?.qty ?? 1;

    const hourly = Array.from({ length: 24 }, (_, h) => byHour.get(h) ?? 0);
    const peakHour = hourly.reduce(
      (best, v, h) => (v > best.v ? { h, v } : best),
      { h: 0, v: 0 },
    );
    const maxHourRevenue = Math.max(1, ...hourly);

    return {
      totalRevenue,
      ticketRevenue,
      addonRevenue,
      ticketsSold,
      bookingsCount: bookings.length,
      topMovies,
      maxMovieQty,
      topAddons,
      maxAddonQty,
      hourly,
      peakHour,
      maxHourRevenue,
    };
  }, [bookings]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-text-faint">
        กำลังโหลด...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-text-muted">
        {loadError}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-bold">Dashboard</h1>
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={clsx(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                period === p.key
                  ? "bg-accent text-white"
                  : "bg-bg-elevated text-text-muted hover:text-text",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="ยอดขายรวม"
          value={formatCurrency(stats.totalRevenue)}
          sub={`${stats.bookingsCount} รายการ`}
        />
        <StatCard icon={Armchair} label="ยอดขายตั๋ว" value={formatCurrency(stats.ticketRevenue)} />
        <StatCard
          icon={Popcorn}
          label="ยอดขายของทานเล่น"
          value={formatCurrency(stats.addonRevenue)}
        />
        <StatCard
          icon={Armchair}
          label="ตั๋วที่ขายได้"
          value={`${stats.ticketsSold} ที่นั่ง`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RankedList
          title="หนังขายดีที่สุด (ตามจำนวนตั๋ว)"
          rows={stats.topMovies.map((m) => ({
            label: m.label,
            value: `${m.qty} ที่นั่ง`,
            barPct: (m.qty / stats.maxMovieQty) * 100,
          }))}
        />
        <RankedList
          title="เมนูของทานเล่นขายดีที่สุด"
          rows={stats.topAddons.map((a) => ({
            label: a.label,
            value: `${a.qty} ชิ้น · ${formatCurrency(a.revenue)}`,
            barPct: (a.qty / stats.maxAddonQty) * 100,
          }))}
        />
      </div>

      <div className="rounded-xl border border-border bg-bg-elevated p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Clock3 className="h-4 w-4 text-accent" /> ยอดขายตามช่วงเวลา
          </h2>
          {stats.peakHour.v > 0 && (
            <span className="text-xs text-text-faint">
              ขายดีสุดช่วง {stats.peakHour.h}:00–{stats.peakHour.h + 1}:00 น.
            </span>
          )}
        </div>
        {stats.totalRevenue === 0 ? (
          <p className="py-6 text-center text-xs text-text-faint">ยังไม่มีข้อมูลในช่วงนี้</p>
        ) : (
          <div className="flex h-32 items-end gap-1">
            {stats.hourly.map((v, h) => (
              <div key={h} className="flex flex-1 flex-col items-center gap-1">
                <div
                  title={`${h}:00 · ${formatCurrency(v)}`}
                  className={clsx(
                    "w-full rounded-t-sm transition-all",
                    h === stats.peakHour.h && v > 0 ? "bg-accent" : "bg-bg-elevated-2",
                  )}
                  style={{ height: `${Math.max(2, (v / stats.maxHourRevenue) * 100)}%` }}
                />
                {h % 3 === 0 && <span className="text-[9px] text-text-faint">{h}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-bg-elevated p-4">
        <h2 className="mb-3 text-sm font-bold">อัตราที่นั่งเต็มต่อรอบฉาย (วันนี้)</h2>
        {occupancy.length === 0 ? (
          <p className="py-6 text-center text-xs text-text-faint">วันนี้ไม่มีรอบฉาย</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {occupancy.map((s) => {
              const pct = s.capacity > 0 ? Math.round((s.booked / s.capacity) * 100) : 0;
              return (
                <div key={s.showtime_id} className="rounded-lg border border-border p-3">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="truncate pr-2 font-medium">{s.movie_title || "—"}</span>
                    <span className="shrink-0 text-text-faint">{formatTime(s.start_time)}</span>
                  </div>
                  <p className="mb-1.5 text-[11px] text-text-faint">
                    {s.hall_name} · {s.booked}/{s.capacity} ที่นั่ง
                  </p>
                  <div className="h-1.5 rounded-full bg-bg-elevated-2">
                    <div
                      className={clsx(
                        "h-1.5 rounded-full",
                        pct >= 80 ? "bg-accent" : pct >= 40 ? "bg-gold" : "bg-success",
                      )}
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
