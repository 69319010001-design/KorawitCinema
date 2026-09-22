"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  ChevronLeft,
  CreditCard,
  Minus,
  Plus,
  QrCode,
  Smartphone,
  Wallet,
} from "lucide-react";
import clsx from "clsx";
import AuthGuard from "@/components/AuthGuard";
import CountdownTimer from "@/components/CountdownTimer";
import { fetchAddons, fetchGiftCardByCode, fetchShowtimeDetail } from "@/lib/queries";
import type { ShowtimeDetail } from "@/lib/queries";
import {
  applyPromo,
  confirmPayment,
  effectiveStatus,
  fetchBooking,
  fetchBookingSeats,
  redeemGiftCardForBooking,
} from "@/lib/mutations";
import { fetchSeatsForHall } from "@/lib/queries";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";
import { useAuthStore } from "@/lib/store/authStore";
import type { Addon, Booking, BookingSeat, GiftCard, Payment, Seat } from "@/lib/types";

const METHODS: { key: Payment["method"]; label: string; icon: React.ElementType }[] = [
  { key: "cash", label: "เงินสด", icon: Banknote },
  { key: "promptpay", label: "พร้อมเพย์ (PromptPay)", icon: QrCode },
  { key: "credit_card", label: "บัตรเครดิต/เดบิต", icon: CreditCard },
  { key: "true_money", label: "TrueMoney Wallet", icon: Wallet },
  { key: "line_pay", label: "LINE Pay", icon: Smartphone },
];

function PaymentContent({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookingSeats, setBookingSeats] = useState<BookingSeat[]>([]);
  const [detail, setDetail] = useState<ShowtimeDetail | null>(null);
  const [hallSeats, setHallSeats] = useState<Seat[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);

  const [method, setMethod] = useState<Payment["method"]>("cash");
  const [cashTendered, setCashTendered] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [giftCardInput, setGiftCardInput] = useState("");
  const [giftCardFound, setGiftCardFound] = useState<GiftCard | null | undefined>(undefined);
  const [giftCardAmount, setGiftCardAmount] = useState("");
  const [giftCardMessage, setGiftCardMessage] = useState<string | null>(null);
  const [giftCardBusy, setGiftCardBusy] = useState(false);
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const b = await fetchBooking(bookingId);
        if (cancelled) return;
        setBooking(b);
        if (!b) {
          setLoading(false);
          return;
        }
        const [seats, d, addonList] = await Promise.all([
          fetchBookingSeats(bookingId),
          fetchShowtimeDetail(b.showtime_id),
          fetchAddons(),
        ]);
        if (cancelled) return;
        setBookingSeats(seats);
        setDetail(d);
        setAddons(addonList);
        if (d) {
          const seatRows = await fetchSeatsForHall(d.hall.hall_id);
          if (!cancelled) setHallSeats(seatRows);
        }
        // A POS concession-only sale (pos/concession) stashes its cart here before
        // redirecting, since this page owns the shared confirm_payment checkout flow.
        try {
          const pending = window.sessionStorage.getItem("pos-pending-addons");
          if (pending) {
            setAddonQty(JSON.parse(pending));
            window.sessionStorage.removeItem("pos-pending-addons");
          }
        } catch {
          // ignore malformed/unavailable storage
        }
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
  }, [bookingId]);

  const seatLabels = useMemo(() => {
    return bookingSeats
      .map((bs) => hallSeats.find((s) => s.seat_id === bs.seat_id))
      .filter(Boolean)
      .sort(
        (a, b) => a!.seat_row.localeCompare(b!.seat_row) || a!.seat_column - b!.seat_column,
      )
      .map((s) => `${s!.seat_row}${s!.seat_column}`);
  }, [bookingSeats, hallSeats]);

  const addonTotal = useMemo(
    () => addons.reduce((sum, a) => sum + (addonQty[a.addon_id] ?? 0) * a.price, 0),
    [addons, addonQty],
  );

  const finalTotal = (booking?.total_amount ?? 0) + addonTotal;
  const cashChange = Number(cashTendered || 0) - finalTotal;
  const cashInsufficient = method === "cash" && (!cashTendered || cashChange < 0);

  useEffect(() => {
    if (booking?.status === "confirmed") {
      router.replace(`/bookings/${bookingId}/ticket`);
    }
  }, [booking?.status, bookingId, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-text-faint">
        กำลังโหลด...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-text-muted">โหลดข้อมูลไม่สำเร็จ</p>
        <p className="max-w-sm text-xs text-text-faint">{loadError}</p>
        <button
          onClick={() => router.push("/")}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          กลับหน้าแรก
        </button>
      </div>
    );
  }

  if (!booking || !detail) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-text-muted">ไม่พบรายการจองนี้ หรือรายการถูกยกเลิกไปแล้ว</p>
        <button
          onClick={() => router.push("/")}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          กลับหน้าแรก
        </button>
      </div>
    );
  }

  const { showtime, movie, hall, cinema } = detail;

  if (booking.status === "confirmed") {
    return null;
  }

  if (effectiveStatus(booking) !== "pending_payment") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-text-muted">
          หมดเวลาชำระเงินสำหรับรายการนี้แล้ว ที่นั่งถูกปล่อยคืนให้ผู้อื่นแล้ว
        </p>
        <button
          onClick={() => router.push("/pos/ticketing")}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          เลือกที่นั่งใหม่
        </button>
      </div>
    );
  }

  function updateQty(addonId: string, delta: number) {
    setAddonQty((prev) => ({
      ...prev,
      [addonId]: Math.max(0, (prev[addonId] ?? 0) + delta),
    }));
  }

  async function handleApplyPromo() {
    if (!promoInput.trim()) return;
    const result = await applyPromo(bookingId, promoInput);
    setPromoMessage(result.ok ? "ใช้ส่วนลดสำเร็จ" : result.message ?? "ใช้โค้ดไม่สำเร็จ");
    if (result.ok) {
      const refreshed = await fetchBooking(bookingId);
      setBooking(refreshed);
    }
  }

  async function handleLookupGiftCard() {
    if (!giftCardInput.trim() || !booking) return;
    setGiftCardMessage(null);
    const card = await fetchGiftCardByCode(giftCardInput);
    setGiftCardFound(card);
    setGiftCardAmount(card ? String(Math.min(card.balance, booking.total_amount)) : "");
  }

  async function handleRedeemGiftCard() {
    if (!giftCardFound) return;
    const amount = Number(giftCardAmount);
    if (!amount || amount <= 0) return;
    setGiftCardBusy(true);
    setGiftCardMessage(null);
    const result = await redeemGiftCardForBooking(bookingId, giftCardFound.code, amount);
    setGiftCardBusy(false);
    if (!result.ok) {
      setGiftCardMessage(result.message ?? "ใช้บัตรไม่สำเร็จ");
      return;
    }
    setGiftCardMessage(
      `ใช้บัตรสำเร็จ -${formatCurrency(result.applied ?? amount)} (คงเหลือในบัตร ${formatCurrency(result.card_balance ?? 0)})`,
    );
    setGiftCardFound(null);
    setGiftCardInput("");
    setGiftCardAmount("");
    const refreshed = await fetchBooking(bookingId);
    setBooking(refreshed);
  }

  function handleExpire() {
    fetchBooking(bookingId).then(setBooking);
  }

  async function handleConfirm() {
    if (!booking) return;
    setSubmitting(true);
    setError(null);
    const result = await confirmPayment(bookingId, method, addonQty);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message ?? "ชำระเงินไม่สำเร็จ");
      return;
    }
    await refreshProfile();
    router.push(`/bookings/${bookingId}/ticket`);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          <button onClick={() => router.back()} aria-label="ย้อนกลับ">
            <ChevronLeft className="h-5 w-5 text-text-muted" />
          </button>
          <p className="flex-1 text-sm font-semibold">ชำระเงิน</p>
          <CountdownTimer expiresAt={booking.expires_at} onExpire={handleExpire} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-5">
        <section className="rounded-xl border border-border bg-bg-elevated p-4">
          <p className="text-sm font-semibold">{movie.title_local}</p>
          <p className="mt-1 text-xs text-text-faint">
            {cinema.name} · {hall.name}
          </p>
          <p className="text-xs text-text-faint">
            {formatDate(showtime.start_time)} · {formatTime(showtime.start_time)} น.
          </p>
          {seatLabels.length > 0 && (
            <p className="mt-2 text-xs text-text-muted">
              ที่นั่ง: <span className="font-medium text-text">{seatLabels.join(", ")}</span>
            </p>
          )}
        </section>

        <section>
          <p className="mb-2 text-sm font-semibold">ของทานเล่นเพิ่มเติม</p>
          <div className="space-y-2">
            {addons.map((a) => (
              <div
                key={a.addon_id}
                className="flex items-center justify-between rounded-xl border border-border bg-bg-elevated px-3 py-2.5"
              >
                <div className="min-w-0 pr-2">
                  <p className="truncate text-sm">{a.name}</p>
                  <p className="text-xs text-text-faint">{formatCurrency(a.price)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => updateQty(a.addon_id, -1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-border-strong text-text-muted"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-4 text-center text-sm">{addonQty[a.addon_id] ?? 0}</span>
                  <button
                    onClick={() => updateQty(a.addon_id, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-border-strong text-text-muted"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 text-sm font-semibold">โค้ดส่วนลด</p>
          <div className="flex gap-2">
            <input
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              placeholder="เช่น WELCOME50"
              className="flex-1 rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm uppercase outline-none placeholder:normal-case placeholder:text-text-faint focus:border-accent"
            />
            <button
              onClick={handleApplyPromo}
              className="shrink-0 rounded-xl border border-border-strong px-4 text-sm font-medium text-text-muted hover:text-text"
            >
              ใช้โค้ด
            </button>
          </div>
          {promoMessage && (
            <p className="mt-1.5 text-xs text-text-muted">{promoMessage}</p>
          )}
        </section>

        <section>
          <p className="mb-2 text-sm font-semibold">บัตรของขวัญ</p>
          <div className="flex gap-2">
            <input
              value={giftCardInput}
              onChange={(e) => {
                setGiftCardInput(e.target.value);
                setGiftCardFound(undefined);
              }}
              placeholder="รหัสบัตร เช่น GC1234ABCD"
              className="flex-1 rounded-xl border border-border bg-bg-elevated px-3 py-2 text-sm uppercase outline-none placeholder:normal-case placeholder:text-text-faint focus:border-accent"
            />
            <button
              onClick={handleLookupGiftCard}
              className="shrink-0 rounded-xl border border-border-strong px-4 text-sm font-medium text-text-muted hover:text-text"
            >
              ตรวจสอบ
            </button>
          </div>

          {giftCardFound === null && (
            <p className="mt-1.5 text-xs text-text-faint">ไม่พบบัตรรหัสนี้</p>
          )}

          {giftCardFound && (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-bg-elevated px-3 py-2.5">
              <div className="min-w-0 flex-1 text-xs">
                <p className="font-mono font-semibold">{giftCardFound.code}</p>
                <p className="text-text-faint">
                  คงเหลือ <span className="text-gold">{formatCurrency(giftCardFound.balance)}</span>
                </p>
              </div>
              <input
                type="number"
                min={1}
                max={Math.min(giftCardFound.balance, booking.total_amount)}
                value={giftCardAmount}
                onChange={(e) => setGiftCardAmount(e.target.value)}
                className="w-20 shrink-0 rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-accent"
              />
              <button
                onClick={handleRedeemGiftCard}
                disabled={giftCardBusy || giftCardFound.status !== "active"}
                className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                ใช้บัตร
              </button>
            </div>
          )}
          {giftCardMessage && (
            <p className="mt-1.5 text-xs text-text-muted">{giftCardMessage}</p>
          )}
        </section>

        <section>
          <p className="mb-2 text-sm font-semibold">วิธีชำระเงิน</p>
          <div className="space-y-2">
            {METHODS.map((m) => {
              const Icon = m.icon;
              const active = method === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => setMethod(m.key)}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors",
                    active
                      ? "border-accent bg-accent-muted text-text"
                      : "border-border bg-bg-elevated text-text-muted hover:border-border-strong",
                  )}
                >
                  <Icon className={clsx("h-4 w-4", active && "text-accent")} />
                  {m.label}
                  <span
                    className={clsx(
                      "ml-auto h-4 w-4 rounded-full border-2",
                      active ? "border-accent bg-accent" : "border-border-strong",
                    )}
                  />
                </button>
              );
            })}
          </div>

          {method === "cash" && (
            <div className="mt-3 space-y-2 rounded-xl border border-border bg-bg-elevated p-3">
              <label className="block">
                <span className="mb-1 block text-xs text-text-muted">รับเงินมา (บาท)</span>
                <input
                  type="number"
                  min={0}
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder={String(finalTotal)}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </label>
              {cashTendered && (
                <p
                  className={clsx(
                    "text-sm font-semibold",
                    cashChange < 0 ? "text-accent" : "text-success",
                  )}
                >
                  {cashChange < 0
                    ? `ขาดอีก ${formatCurrency(Math.abs(cashChange))}`
                    : `เงินทอน ${formatCurrency(cashChange)}`}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="space-y-1.5 rounded-xl border border-border bg-bg-elevated p-4 text-sm">
          <Row label="ค่าตั๋ว" value={formatCurrency(booking.total_amount + booking.discount_amount)} />
          {booking.discount_amount > 0 && (
            <Row label="ส่วนลด" value={`-${formatCurrency(booking.discount_amount)}`} accent />
          )}
          {addonTotal > 0 && <Row label="ของทานเล่น" value={formatCurrency(addonTotal)} />}
          <div className="!mt-3 flex items-center justify-between border-t border-border pt-2 text-base font-bold">
            <span>ยอดรวม</span>
            <span className="text-accent">{formatCurrency(finalTotal)}</span>
          </div>
        </section>

        {error && <p className="text-sm text-accent">{error}</p>}
      </div>

      <div className="sticky bottom-0 border-t border-border bg-bg-elevated">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          <button
            disabled={submitting || cashInsufficient}
            onClick={handleConfirm}
            className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            ยืนยันชำระเงิน {formatCurrency(finalTotal)}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-muted">{label}</span>
      <span className={accent ? "text-success" : "text-text"}>{value}</span>
    </div>
  );
}

export default function PaymentPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  return (
    <AuthGuard>
      <PaymentContent bookingId={bookingId} />
    </AuthGuard>
  );
}
