"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { fetchAddons, fetchTodayShowtimeOptions } from "@/lib/queries";
import type { ShowtimeOption } from "@/lib/queries";
import { createWalkinBooking } from "@/lib/mutations";
import { formatCurrency, formatTime } from "@/lib/format";
import { usePosSessionStore } from "@/lib/store/posSessionStore";
import AddonThumb from "@/components/pos/AddonThumb";
import type { Addon } from "@/lib/types";

const VAT_RATE = 0.1;

function ShowtimePicker() {
  const setSessionShowtime = usePosSessionStore((s) => s.setShowtime);
  const [options, setOptions] = useState<ShowtimeOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTodayShowtimeOptions()
      .then(setOptions)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="text-sm text-text-muted">
        เลือกรอบฉายที่จะผูกกับการขายของทานเล่นนี้ (ใช้เพื่ออ้างอิงเท่านั้น ไม่จำเป็นต้องเป็นรอบฉายของลูกค้าที่ซื้อ)
      </p>
      {loading ? (
        <p className="text-sm text-text-faint">กำลังโหลด...</p>
      ) : options.length === 0 ? (
        <p className="text-sm text-text-faint">วันนี้ไม่มีรอบฉาย</p>
      ) : (
        <select
          defaultValue=""
          onChange={(e) => {
            const opt = options.find((o) => o.showtime_id === e.target.value);
            if (opt) setSessionShowtime(opt, opt.movie_title_local);
          }}
          className="w-full max-w-sm rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm outline-none focus:border-accent"
        >
          <option value="" disabled>
            เลือกรอบฉาย...
          </option>
          {options.map((o) => (
            <option key={o.showtime_id} value={o.showtime_id}>
              {formatTime(o.start_time)} · {o.movie_title_local} · {o.hall_name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export default function ConcessionPage() {
  const router = useRouter();
  const showtime = usePosSessionStore((s) => s.showtime);

  const [addons, setAddons] = useState<Addon[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAddons()
      .then(setAddons)
      .finally(() => setLoading(false));
  }, []);

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

  const subtotal = cartItems.reduce((sum, i) => sum + i.addon.price * i.qty, 0);
  const vat = Math.round(subtotal * VAT_RATE * 100) / 100;
  const total = subtotal + vat;

  async function handleCheckout() {
    if (!showtime || cartItems.length === 0) return;
    setSubmitting(true);
    setError(null);
    const result = await createWalkinBooking(showtime.showtime_id);
    if (!result.ok || !result.booking_id) {
      setSubmitting(false);
      setError(result.message ?? "เปิดรายการขายไม่สำเร็จ");
      return;
    }
    try {
      window.sessionStorage.setItem("pos-pending-addons", JSON.stringify(cart));
    } catch {
      // payment page will just open with an empty cart if storage is unavailable
    }
    router.push(`/bookings/${result.booking_id}/payment`);
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-text-faint">
        กำลังโหลด...
      </div>
    );
  }

  if (!showtime) {
    return <ShowtimePicker />;
  }

  return (
    <div className="flex flex-1 gap-6 p-6">
      <div className="flex-1">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold">Beverages &amp; Concessions</h1>
          <p className="text-xs text-text-faint">Showing {addons.length} items</p>
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
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">
            Concessions <span className="ml-1 text-accent">Cart</span>
          </h2>
          {cartItems.length > 0 && (
            <button
              onClick={() => setCart({})}
              className="flex items-center gap-1 text-xs text-text-faint hover:text-accent"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {cartItems.length === 0 ? (
            <p className="py-8 text-center text-xs text-text-faint">ยังไม่มีสินค้าในตะกร้า</p>
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

        <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
          <div className="flex items-center justify-between text-text-muted">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-text-muted">
            <span>VAT (10%)</span>
            <span>{formatCurrency(vat)}</span>
          </div>
          <div className="flex items-center justify-between pt-1 text-base font-bold">
            <span>Total Amount</span>
            <span className="text-accent">{formatCurrency(total)}</span>
          </div>
        </div>

        {error && <p className="mt-2 text-xs text-accent">{error}</p>}

        <button
          disabled={cartItems.length === 0 || submitting}
          onClick={handleCheckout}
          className="mt-4 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue to Payment
        </button>
      </aside>
    </div>
  );
}
