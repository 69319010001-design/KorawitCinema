// Mirrors KorawitCinema_schema.md — field names kept snake_case to match the
// Postgres/Supabase column names 1:1, so this layer swaps to real Supabase
// queries later without renaming anything.

export type UserRole = "customer" | "staff" | "admin";
export type MemberTier = "basic" | "silver" | "gold";

export interface AppUser {
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: UserRole;
  member_tier: MemberTier;
  points_balance: number;
  created_at: string;
}

export interface Cinema {
  cinema_id: string;
  name: string;
  address: string;
  city: string;
}

export type ScreenType = "standard" | "imax" | "4dx" | "dolby";

export interface Hall {
  hall_id: string;
  cinema_id: string;
  name: string;
  screen_type: ScreenType;
  total_rows: number;
  total_columns: number;
}

export type SeatTypeCode = "STANDARD" | "VIP" | "COUPLE";

export interface SeatType {
  seat_type_id: string;
  code: SeatTypeCode;
  label: string;
  price_multiplier: number;
}

export interface Seat {
  seat_id: string;
  hall_id: string;
  seat_row: string;
  seat_column: number;
  seat_type_id: string;
  is_active: boolean;
}

export type MovieStatus = "now_showing" | "coming_soon" | "ended";

export interface Genre {
  genre_id: string;
  name: string;
}

export interface Movie {
  movie_id: string;
  title: string;
  title_local: string;
  duration_min: number;
  synopsis: string;
  age_rating: string;
  release_date: string;
  status: MovieStatus;
  genre_names: string[];
  gradient: [string, string];
}

export type LanguageAudio = "original" | "dubbed_thai";
export type Subtitle = "thai" | "english" | "none";
export type ShowtimeStatus = "open" | "soldout" | "cancelled";

export interface Showtime {
  showtime_id: string;
  movie_id: string;
  hall_id: string;
  language_audio: LanguageAudio;
  subtitle: Subtitle;
  start_time: string;
  end_time: string;
  base_price: number;
  status: ShowtimeStatus;
}

export interface ShowtimePricing {
  showtime_id: string;
  seat_type_id: string;
  price: number;
}

export type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "cancelled"
  | "expired";
export type SeatHoldStatus = "held" | "booked" | "released";

export interface Addon {
  addon_id: string;
  name: string;
  price: number;
  image_url: string | null;
}

export interface BookingAddon {
  booking_id: string;
  addon_id: string;
  quantity: number;
  price_each: number;
}

export interface BookingSeat {
  booking_seat_id: string;
  booking_id: string;
  showtime_id: string;
  seat_id: string;
  price: number;
  status: SeatHoldStatus;
  held_at: string;
}

export interface Payment {
  payment_id: string;
  booking_id: string;
  method: "credit_card" | "promptpay" | "true_money" | "line_pay";
  amount: number;
  provider_ref: string;
  paid_at: string | null;
  status: "pending" | "success" | "failed" | "refunded";
}

export interface Booking {
  booking_id: string;
  user_id: string;
  showtime_id: string;
  booking_code: string;
  status: BookingStatus;
  total_amount: number;
  discount_amount: number;
  promotion_id: string | null;
  created_at: string;
  expires_at: string;
}

export interface Promotion {
  promotion_id: string;
  code: string;
  description: string;
  discount_type: "percent" | "fixed_amount";
  discount_value: number;
  is_active: boolean;
}

export type GiftCardStatus = "active" | "redeemed" | "cancelled";

export interface GiftCard {
  gift_card_id: string;
  code: string;
  initial_balance: number;
  balance: number;
  status: GiftCardStatus;
  issued_to: string | null;
  issued_by: string | null;
  created_at: string;
}

export type GiftCardTxnType = "issue" | "redeem" | "reload";

export interface GiftCardTransaction {
  gift_card_txn_id: string;
  gift_card_id: string;
  amount: number;
  type: GiftCardTxnType;
  staff_id: string | null;
  created_at: string;
}

export interface StaffShift {
  shift_id: string;
  staff_id: string;
  clock_in: string;
  clock_out: string | null;
  starting_cash: number | null;
  ending_cash: number | null;
  notes: string | null;
}

export interface BookingWithDetail extends Booking {
  movie_title: string;
  cinema_name: string;
  hall_name: string;
  start_time: string;
}
