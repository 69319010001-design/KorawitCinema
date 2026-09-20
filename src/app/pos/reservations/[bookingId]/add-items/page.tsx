"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Minus, Plus } from "lucide-react";
import AddonThumb from "@/components/pos/AddonThumb";
import { fetchAddons, fetchBookingAddons, fetchShowtimeDetail } from "@/lib/queries";
import type { BookingAddonWithDetail } from "@/lib/queries";
import { addAddonsToBooking, fetchBooking } from "@/lib/mutations";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";
import type { Addon, Booking } from "@/lib/types";

function AddItemsContent({ bookingId }: { bookingId: string }) {
  const router = useRouter();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [movieTitle, setMovieTitle] = useState("");
  const [existingItems, setExistingItems] = useState<BookingAddonWithDetail[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTotal, setSuccessTotal] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const b = await fetchBooking(bookingId);
      setBooking(b);
      if (!b) {
        setLoading(false);
        return;
      }
      const [detail, items, addonList] = await Promise.all([
        fetchShowtimeDetail(b.showtime_id),
        fetchBookingAddons(bookingId),
        fetchAddons(),
      ]);
      setMovieTitle(detail?.movie.title_local ?? "");
      setExistingItems(items);
      setAddons(addonList);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() also re-runs after a successful add, not just on mount
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  function updateQty(addonId: string, delta: number) {
    setCart((prev) => ({ ...prev, [addonId]: Math.max(0, (prev[addonId] ?? 0) + delta) }));
  }

  const cartItems = useMemo(
    () =>
      addons
        .map((a) => ({ addon: a, qty: cart[a.addon_id] ?? 0 }))
        .filter((i) => i.qty > 0),
    [addons, cart],
  );

  const addTotal = cartItems.reduce((sum, i) => sum + i.addon.price * i.qty, 0);
  const existingTotal = existingItems.reduce((sum, i) => sum + i.price_each * i.quantity, 0);

  async function handleAdd() {
    if (cartItems.length === 0) return;
    setSubmitting(true);
    setError(null);
    setSuccessTotal(null);
    const result = await addAddonsToBooking(bookingId, cart);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message ?? "เพิ่มรายการไม่สำเร็จ");
      return;
    }
    setSuccessTotal(result.added_total ?? addTotal);
    setCart({});
    load();
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-text-faint">
        กำลังโหลด...
      </div>
    );
  }

  if (loadError || !booking) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-text-muted">{loadError ?? "ไม่พบรายการจองนี้"}</p>
        <button
          onClick={() => router.push("/pos/reservations")}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          กลับไปหน้า Reservations
        </button>
      </div>
    );
  }

  if (booking.status !== "confirmed") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-text-muted">
          เพิ่มรายการได้เฉพาะบิลที่ชำระเงินแล้วเท่านั้น (สถานะปัจจุบัน: {booking.status})
        </p>
        <button
          onClick={() => router.push("/pos/reservations")}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          กลับไปหน้า Reservations
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 gap-6 p-6">
      <div className="flex-1">
        <div className="mb-4 flex items-center gap-3">
          <button onClick={() => router.push("/pos/reservations")} aria-label="ย้อนกลับ">
            <ChevronLeft className="h-5 w-5 text-text-muted" />
          </button>
          <div>
            <h1 className="text-lg font-bold">เพิ่มรายการลงบิล {booking.booking_code}</h1>
            <p className="text-xs text-text-faint">
              {movieTitle} · {formatDate(booking.created_at)} {formatTime(booking.created_at)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {addons.map((addon) => {
            const qty = cart[addon.addon_id] ?? 0;
            return (
              <div
                key={addon.addon_id}
                className="flex flex-col overflow-hidden rounded-xl border border-border bg-bg-elevated"
              >
                <AddonThumb addon={addon} className="h-24 w-full" />
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <p className="text-sm font-medium">{addon.name}</p>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-sm font-bold text-accent">
                      {formatCurrency(addon.price)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(addon.addon_id, -1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-border-strong text-text-muted hover:text-text"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-4 text-center text-sm">{qty}</span>
                      <button
                        onClick={() => updateQty(addon.addon_id, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="flex w-80 shrink-0 flex-col rounded-xl border border-border bg-bg-elevated p-4">
        <h2 className="mb-3 text-sm font-bold">รายการในบิลนี้</h2>
        <div className="mb-3 space-y-1 border-b border-border pb-3 text-xs text-text-muted">
          {existingItems.length === 0 ? (
            <p className="text-text-faint">ยังไม่มีของทานเล่นในบิลนี้</p>
          ) : (
            existingItems.map((i) => (
              <div key={i.addon_id} className="flex items-center justify-between">
                <span>
                  {i.addon_name} x{i.quantity}
                </span>
                <span>{formatCurrency(i.price_each * i.quantity)}</span>
              </div>
            ))
          )}
          {existingItems.length > 0 && (
            <div className="flex items-center justify-between pt-1 font-medium text-text">
              <span>รวมของเดิม</span>
              <span>{formatCurrency(existingTotal)}</span>
            </div>
          )}
        </div>

        <h2 className="mb-2 text-sm font-bold">
          กำลังจะเพิ่ม <span className="text-accent">ใหม่</span>
        </h2>
        <div className="flex-1 space-y-2 overflow-y-auto">
          {cartItems.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-faint">เลือกรายการที่จะเพิ่มจากด้านซ้าย</p>
          ) : (
            cartItems.map(({ addon, qty }) => (
              <div key={addon.addon_id} className="flex items-center gap-2">
                <AddonThumb addon={addon} className="h-9 w-9 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{addon.name}</p>
                  <p className="text-xs text-text-faint">{formatCurrency(addon.price)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => updateQty(addon.addon_id, -1)}
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-border-strong text-text-muted"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-3 text-center text-xs">{qty}</span>
                  <button
                    onClick={() => updateQty(addon.addon_id, 1)}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-base font-bold">
          <span>ยอดเพิ่ม</span>
          <span className="text-accent">{formatCurrency(addTotal)}</span>
        </div>

        {error && <p className="mt-2 text-xs text-accent">{error}</p>}
        {successTotal != null && (
          <p className="mt-2 text-xs text-success">
            เพิ่มรายการสำเร็จ (+{formatCurrency(successTotal)}) บิลนี้ยอดรวมล่าสุด{" "}
            {formatCurrency(booking.total_amount)}
          </p>
        )}

        <button
          disabled={cartItems.length === 0 || submitting}
          onClick={handleAdd}
          className="mt-4 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          เพิ่มลงบิล
        </button>
      </aside>
    </div>
  );
}

export default function AddItemsPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  return <AddItemsContent bookingId={bookingId} />;
}
