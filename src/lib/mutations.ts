import { createClient } from "./supabase/client";
import type { Booking, BookingSeat, GiftCard, Payment } from "./types";

// ---------------------------------------------------------------------------
// Writes to bookings/booking_seats/payments all go through the Postgres RPC
// functions defined in supabase_migration_auth_rls.sql — RLS intentionally
// has no insert/update policy for those tables, so this is the only path.
// ---------------------------------------------------------------------------

interface RpcResult {
  ok: boolean;
  message?: string;
  booking_id?: string;
  total_amount?: number;
}

export async function holdSeat(
  showtimeId: string,
  seatId: string,
): Promise<RpcResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("hold_seat", {
    p_showtime_id: showtimeId,
    p_seat_id: seatId,
  });
  if (error) return { ok: false, message: error.message };
  return data as RpcResult;
}

export async function releaseSeat(
  bookingId: string,
  seatId: string,
): Promise<RpcResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("release_seat", {
    p_booking_id: bookingId,
    p_seat_id: seatId,
  });
  if (error) return { ok: false, message: error.message };
  return data as RpcResult;
}

export async function applyPromo(
  bookingId: string,
  code: string,
): Promise<RpcResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("apply_promo", {
    p_booking_id: bookingId,
    p_code: code,
  });
  if (error) return { ok: false, message: error.message };
  return data as RpcResult;
}

export async function confirmPayment(
  bookingId: string,
  method: Payment["method"],
  addonQuantities: Record<string, number>,
): Promise<RpcResult> {
  const supabase = createClient();
  const addons = Object.entries(addonQuantities)
    .filter(([, qty]) => qty > 0)
    .map(([addon_id, quantity]) => ({ addon_id, quantity }));

  const { data, error } = await supabase.rpc("confirm_payment", {
    p_booking_id: bookingId,
    p_method: method,
    p_addons: addons,
  });
  if (error) return { ok: false, message: error.message };
  return data as RpcResult;
}

export async function fetchBooking(bookingId: string): Promise<Booking | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function fetchBookingSeats(bookingId: string): Promise<BookingSeat[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("booking_seats")
    .select("*")
    .eq("booking_id", bookingId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchDraftBooking(
  userId: string,
  showtimeId: string,
): Promise<Booking | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("user_id", userId)
    .eq("showtime_id", showtimeId)
    .eq("status", "pending_payment")
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function fetchUserBookings(userId: string): Promise<Booking[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** A pending_payment booking whose expiry has passed but hasn't been swept yet. */
export function effectiveStatus(booking: Booking): Booking["status"] {
  if (booking.status === "pending_payment" && new Date(booking.expires_at) < new Date()) {
    return "expired";
  }
  return booking.status;
}

// ---------------------------------------------------------------------------
// POS: concession-only sale, gift cards, shift clock in/out.
// ---------------------------------------------------------------------------

export async function createWalkinBooking(showtimeId: string): Promise<RpcResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_walkin_booking", {
    p_showtime_id: showtimeId,
  });
  if (error) return { ok: false, message: error.message };
  return data as RpcResult;
}

/** Adds items to a booking that's already been paid for (status confirmed) —
 * e.g. a customer who bought a ticket earlier comes back for more snacks. */
export async function addAddonsToBooking(
  bookingId: string,
  addonQuantities: Record<string, number>,
): Promise<RpcResult & { added_total?: number }> {
  const supabase = createClient();
  const addons = Object.entries(addonQuantities)
    .filter(([, qty]) => qty > 0)
    .map(([addon_id, quantity]) => ({ addon_id, quantity }));

  const { data, error } = await supabase.rpc("add_booking_addons", {
    p_booking_id: bookingId,
    p_addons: addons,
  });
  if (error) return { ok: false, message: error.message };
  return data as RpcResult & { added_total?: number };
}

function generateGiftCardCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "GC";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function issueGiftCard(input: {
  amount: number;
  issuedTo?: string;
  staffId: string;
}): Promise<{ ok: boolean; message?: string; giftCard?: GiftCard }> {
  const supabase = createClient();
  const code = generateGiftCardCode();
  const { data, error } = await supabase
    .from("gift_cards")
    .insert({
      code,
      initial_balance: input.amount,
      balance: input.amount,
      status: "active",
      issued_to: input.issuedTo ?? null,
      issued_by: input.staffId,
    })
    .select("*")
    .single();
  if (error) return { ok: false, message: error.message };

  await supabase.from("gift_card_transactions").insert({
    gift_card_id: data.gift_card_id,
    amount: input.amount,
    type: "issue",
    staff_id: input.staffId,
  });

  return { ok: true, giftCard: data as GiftCard };
}

export async function redeemGiftCard(input: {
  giftCard: GiftCard;
  amount: number;
  staffId: string;
}): Promise<{ ok: boolean; message?: string; balance?: number }> {
  if (input.giftCard.status !== "active") {
    return { ok: false, message: "บัตรนี้ใช้งานไม่ได้แล้ว" };
  }
  if (input.amount > input.giftCard.balance) {
    return { ok: false, message: "ยอดคงเหลือในบัตรไม่พอ" };
  }

  const supabase = createClient();
  const newBalance = input.giftCard.balance - input.amount;
  const { error } = await supabase
    .from("gift_cards")
    .update({
      balance: newBalance,
      status: newBalance === 0 ? "redeemed" : "active",
    })
    .eq("gift_card_id", input.giftCard.gift_card_id);
  if (error) return { ok: false, message: error.message };

  await supabase.from("gift_card_transactions").insert({
    gift_card_id: input.giftCard.gift_card_id,
    amount: input.amount,
    type: "redeem",
    staff_id: input.staffId,
  });

  return { ok: true, balance: newBalance };
}
