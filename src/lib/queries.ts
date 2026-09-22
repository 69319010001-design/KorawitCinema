import { createClient } from "./supabase/client";
import type {
  Addon,
  AppUser,
  BookingAddon,
  BookingWithDetail,
  Cinema,
  GiftCard,
  GiftCardTransaction,
  Hall,
  Movie,
  Promotion,
  ScreenType,
  Seat,
  SeatType,
  Showtime,
} from "./types";

// ---------------------------------------------------------------------------
// Read queries against the real Supabase schema (supabase_schema.sql +
// supabase_migration_auth_rls.sql). Replaces the old mock-data.ts.
// ---------------------------------------------------------------------------

const GRADIENTS: [string, string][] = [
  ["#1e1b4b", "#e11d3c"],
  ["#451a03", "#f2c14e"],
  ["#0f172a", "#6d28d9"],
  ["#0c4a6e", "#38bdf8"],
  ["#052e16", "#22c55e"],
  ["#3f0d12", "#fb7185"],
];

/** Movies have no poster_url yet, so pick a stable gradient from the id. */
export function gradientForId(id: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

function mapMovie(row: {
  movie_id: string;
  title: string;
  title_local: string;
  duration_min: number;
  synopsis: string | null;
  age_rating: string | null;
  release_date: string | null;
  status: Movie["status"];
  poster_url?: string | null;
  movie_genres?: { genres: { name: string } | null }[];
}): Movie {
  return {
    movie_id: row.movie_id,
    title: row.title,
    title_local: row.title_local,
    duration_min: row.duration_min,
    synopsis: row.synopsis ?? "",
    age_rating: row.age_rating ?? "",
    release_date: row.release_date ?? "",
    status: row.status,
    poster_url: row.poster_url ?? null,
    genre_names: (row.movie_genres ?? [])
      .map((mg) => mg.genres?.name)
      .filter((n): n is string => Boolean(n)),
    gradient: gradientForId(row.movie_id),
  };
}

export async function fetchMovies(): Promise<Movie[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("movies")
    .select("*, movie_genres(genres(name))")
    .order("release_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapMovie);
}

export async function fetchMovie(movieId: string): Promise<Movie | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("movies")
    .select("*, movie_genres(genres(name))")
    .eq("movie_id", movieId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMovie(data) : null;
}

export interface ShowtimeWithVenue extends Showtime {
  cinema_id: string;
  cinema_name: string;
  hall_name: string;
  screen_type: ScreenType;
}

export async function fetchShowtimesForMovie(
  movieId: string,
): Promise<ShowtimeWithVenue[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("showtimes")
    .select("*, halls(name, screen_type, cinema_id, cinemas(name))")
    .eq("movie_id", movieId)
    .order("start_time", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const hall = row.halls as unknown as {
      name: string;
      screen_type: ScreenType;
      cinema_id: string;
      cinemas: { name: string } | null;
    };
    return {
      showtime_id: row.showtime_id,
      movie_id: row.movie_id,
      hall_id: row.hall_id,
      language_audio: row.language_audio,
      subtitle: row.subtitle,
      start_time: row.start_time,
      end_time: row.end_time,
      base_price: row.base_price,
      status: row.status,
      cinema_id: hall.cinema_id,
      cinema_name: hall.cinemas?.name ?? "",
      hall_name: hall.name,
      screen_type: hall.screen_type,
    };
  });
}

export interface ShowtimeOption extends ShowtimeWithVenue {
  movie_title_local: string;
}

/** Today's open showtimes across all movies — used by the Concession page's own
 * showtime picker, so a snack sale doesn't have to be started from Ticketing. */
export async function fetchTodayShowtimeOptions(): Promise<ShowtimeOption[]> {
  const supabase = createClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { data, error } = await supabase
    .from("showtimes")
    .select("*, movies(title_local), halls(name, screen_type, cinema_id, cinemas(name))")
    .eq("status", "open")
    .gte("start_time", startOfDay.toISOString())
    .lt("start_time", endOfDay.toISOString())
    .order("start_time", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const hall = row.halls as unknown as {
      name: string;
      screen_type: ScreenType;
      cinema_id: string;
      cinemas: { name: string } | null;
    };
    const movie = row.movies as unknown as { title_local: string } | null;
    return {
      showtime_id: row.showtime_id,
      movie_id: row.movie_id,
      hall_id: row.hall_id,
      language_audio: row.language_audio,
      subtitle: row.subtitle,
      start_time: row.start_time,
      end_time: row.end_time,
      base_price: row.base_price,
      status: row.status,
      cinema_id: hall.cinema_id,
      cinema_name: hall.cinemas?.name ?? "",
      hall_name: hall.name,
      screen_type: hall.screen_type,
      movie_title_local: movie?.title_local ?? "",
    };
  });
}

export async function fetchCinemas(): Promise<Cinema[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("cinemas").select("*");
  if (error) throw error;
  return data ?? [];
}

export interface ShowtimeDetail {
  showtime: Showtime;
  movie: Movie;
  hall: Hall;
  cinema: Cinema;
}

export async function fetchShowtimeDetail(
  showtimeId: string,
): Promise<ShowtimeDetail | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("showtimes")
    .select("*, movies(*, movie_genres(genres(name))), halls(*, cinemas(*))")
    .eq("showtime_id", showtimeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const hallRow = data.halls as unknown as Hall & { cinemas: Cinema };
  const { cinemas: cinema, ...hall } = hallRow;

  return {
    showtime: {
      showtime_id: data.showtime_id,
      movie_id: data.movie_id,
      hall_id: data.hall_id,
      language_audio: data.language_audio,
      subtitle: data.subtitle,
      start_time: data.start_time,
      end_time: data.end_time,
      base_price: data.base_price,
      status: data.status,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    movie: mapMovie(data.movies as any),
    hall,
    cinema,
  };
}

export async function fetchSeatsForHall(hallId: string): Promise<Seat[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("seats")
    .select("*")
    .eq("hall_id", hallId)
    .order("seat_row", { ascending: true })
    .order("seat_column", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchSeatTypes(): Promise<SeatType[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("seat_types").select("*");
  if (error) throw error;
  return data ?? [];
}

export async function fetchShowtimePricing(
  showtimeId: string,
): Promise<Record<string, number>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("showtime_pricing")
    .select("seat_type_id, price")
    .eq("showtime_id", showtimeId);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.seat_type_id, r.price]));
}

export async function fetchAddons(): Promise<Addon[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("addons")
    .select("addon_id, name, price, image_url")
    .eq("is_active", true);
  if (error) throw error;
  return data ?? [];
}

export async function fetchActiveSeatIds(
  showtimeId: string,
): Promise<Set<string>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("active_booking_seats")
    .select("seat_id")
    .eq("showtime_id", showtimeId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.seat_id));
}

export async function fetchPromotionByCode(
  code: string,
): Promise<Promotion | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("promotions")
    .select("*")
    .ilike("code", code.trim())
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// ---------------------------------------------------------------------------
// POS: staff-facing reads. `bookings`/`booking_seats`/`booking_addons`/`payments`
// carry a "staff read all" policy (supabase_migration_pos.sql) on top of the
// existing "select own" policy, so these see every customer's rows once a
// staff/admin account is signed in.
// ---------------------------------------------------------------------------

export async function fetchAllBookingsWithDetail(): Promise<BookingWithDetail[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, showtimes(start_time, movies(title_local), halls(name, cinemas(name)))")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const showtime = row.showtimes as unknown as {
      start_time: string;
      movies: { title_local: string } | null;
      halls: { name: string; cinemas: { name: string } | null } | null;
    };
    return {
      booking_id: row.booking_id,
      user_id: row.user_id,
      showtime_id: row.showtime_id,
      booking_code: row.booking_code,
      status: row.status,
      total_amount: row.total_amount,
      discount_amount: row.discount_amount,
      promotion_id: row.promotion_id,
      created_at: row.created_at,
      expires_at: row.expires_at,
      movie_title: showtime.movies?.title_local ?? "",
      cinema_name: showtime.halls?.cinemas?.name ?? "",
      hall_name: showtime.halls?.name ?? "",
      start_time: showtime.start_time,
    };
  });
}

export async function fetchGiftCards(): Promise<GiftCard[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gift_cards")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchGiftCardByCode(code: string): Promise<GiftCard | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gift_cards")
    .select("*")
    .ilike("code", code.trim())
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function fetchGiftCardTransactions(
  giftCardId: string,
): Promise<GiftCardTransaction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gift_card_transactions")
    .select("*")
    .eq("gift_card_id", giftCardId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface BookingAddonWithDetail extends BookingAddon {
  addon_name: string;
}

export async function fetchBookingAddons(
  bookingId: string,
): Promise<BookingAddonWithDetail[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("booking_addons")
    .select("*, addons(name)")
    .eq("booking_id", bookingId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    booking_id: row.booking_id,
    addon_id: row.addon_id,
    quantity: row.quantity,
    price_each: row.price_each,
    addon_name: (row.addons as unknown as { name: string } | null)?.name ?? "",
  }));
}

// ---------------------------------------------------------------------------
// Dashboard: aggregate stats computed client-side from raw rows — matches the
// rest of this file's pattern (no RPCs/views needed, safe reads under the
// existing public-read + "staff read all" policies).
// ---------------------------------------------------------------------------

export interface DashboardAddonLine {
  name: string;
  quantity: number;
  price_each: number;
}

export interface DashboardBookingRow {
  booking_id: string;
  total_amount: number;
  created_at: string;
  movie_title: string;
  seats_booked: number;
  addons: DashboardAddonLine[];
}

/** Every confirmed sale (ticket and/or concession) since `since` — the base
 * dataset the dashboard's revenue/top-movie/top-addon/peak-hour cards derive from. */
export async function fetchConfirmedBookingsSince(
  since: Date,
): Promise<DashboardBookingRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "booking_id, total_amount, created_at, showtimes(movies(title_local)), booking_seats(status), booking_addons(quantity, price_each, addons(name))",
    )
    .eq("status", "confirmed")
    .gte("created_at", since.toISOString());
  if (error) throw error;

  return (data ?? []).map((row) => {
    const showtime = row.showtimes as unknown as {
      movies: { title_local: string } | null;
    } | null;
    const seats = (row.booking_seats ?? []) as unknown as { status: string }[];
    const addonRows = (row.booking_addons ?? []) as unknown as {
      quantity: number;
      price_each: number;
      addons: { name: string } | null;
    }[];
    return {
      booking_id: row.booking_id,
      total_amount: row.total_amount,
      created_at: row.created_at,
      movie_title: showtime?.movies?.title_local ?? "",
      seats_booked: seats.filter((s) => s.status === "booked").length,
      addons: addonRows.map((a) => ({
        name: a.addons?.name ?? "",
        quantity: a.quantity,
        price_each: a.price_each,
      })),
    };
  });
}

export interface ShowtimeOccupancy {
  showtime_id: string;
  movie_title: string;
  hall_name: string;
  start_time: string;
  booked: number;
  capacity: number;
}

/** How full each of today's showtimes is (booked seats / active seats in that hall). */
export async function fetchTodayOccupancy(): Promise<ShowtimeOccupancy[]> {
  const supabase = createClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { data: showtimeRows, error: showtimeErr } = await supabase
    .from("showtimes")
    .select("showtime_id, start_time, movies(title_local), halls(hall_id, name)")
    .gte("start_time", startOfDay.toISOString())
    .lt("start_time", endOfDay.toISOString())
    .order("start_time", { ascending: true });
  if (showtimeErr) throw showtimeErr;
  const showtimes = showtimeRows ?? [];
  if (showtimes.length === 0) return [];

  const hallIds = Array.from(
    new Set(
      showtimes.map(
        (r) => (r.halls as unknown as { hall_id: string } | null)?.hall_id,
      ),
    ),
  ).filter((id): id is string => Boolean(id));

  const { data: seatRows, error: seatErr } = await supabase
    .from("seats")
    .select("hall_id")
    .eq("is_active", true)
    .in("hall_id", hallIds);
  if (seatErr) throw seatErr;
  const capacityByHall = new Map<string, number>();
  for (const s of seatRows ?? []) {
    capacityByHall.set(s.hall_id, (capacityByHall.get(s.hall_id) ?? 0) + 1);
  }

  const showtimeIds = showtimes.map((r) => r.showtime_id);
  const { data: bookedRows, error: bookedErr } = await supabase
    .from("booking_seats")
    .select("showtime_id")
    .eq("status", "booked")
    .in("showtime_id", showtimeIds);
  if (bookedErr) throw bookedErr;
  const bookedByShowtime = new Map<string, number>();
  for (const b of bookedRows ?? []) {
    bookedByShowtime.set(b.showtime_id, (bookedByShowtime.get(b.showtime_id) ?? 0) + 1);
  }

  return showtimes.map((row) => {
    const hall = row.halls as unknown as { hall_id: string; name: string } | null;
    const movie = row.movies as unknown as { title_local: string } | null;
    return {
      showtime_id: row.showtime_id,
      movie_title: movie?.title_local ?? "",
      hall_name: hall?.name ?? "",
      start_time: row.start_time,
      booked: bookedByShowtime.get(row.showtime_id) ?? 0,
      capacity: hall ? (capacityByHall.get(hall.hall_id) ?? 0) : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Admin: user directory. Only returns rows for an admin caller — RLS
// ("admin read all users" in supabase_migration_cashier_core.sql) silently
// filters everyone else down to just their own row.
// ---------------------------------------------------------------------------

export async function fetchAllUsers(): Promise<AppUser[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
