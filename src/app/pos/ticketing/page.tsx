"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Clock, Search } from "lucide-react";
import clsx from "clsx";
import PosterPlaceholder from "@/components/PosterPlaceholder";
import SeatMap from "@/components/SeatMap";
import CountdownTimer from "@/components/CountdownTimer";
import {
  fetchActiveSeatIds,
  fetchMovies,
  fetchSeatsForHall,
  fetchSeatTypes,
  fetchShowtimeDetail,
  fetchShowtimesForMovie,
} from "@/lib/queries";
import type { ShowtimeDetail, ShowtimeWithVenue } from "@/lib/queries";
import {
  fetchBookingSeats,
  fetchDraftBooking,
  holdSeat,
  releaseSeat,
} from "@/lib/mutations";
import { formatCurrency, formatDuration, formatTime } from "@/lib/format";
import { useAuthStore } from "@/lib/store/authStore";
import { usePosSessionStore } from "@/lib/store/posSessionStore";
import { createClient } from "@/lib/supabase/client";
import type { Booking, Movie, Seat, SeatType } from "@/lib/types";

function isLive(booking: Booking | null): booking is Booking {
  return !!booking && new Date(booking.expires_at) > new Date();
}

function MoviePicker({ onSelect }: { onSelect: (movie: Movie) => void }) {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMovies()
      .then((m) => setMovies(m.filter((x) => x.status === "now_showing")))
      .finally(() => setLoading(false));
  }, []);

  const filtered = movies.filter((m) =>
    (m.title_local + m.title).toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-bold">เลือกภาพยนตร์</h1>
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อหนัง..."
            className="w-full rounded-xl border border-border bg-bg-elevated py-2.5 pl-9 pr-3 text-sm placeholder:text-text-faint focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-text-faint">กำลังโหลด...</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {filtered.map((movie) => (
            <button
              key={movie.movie_id}
              onClick={() => onSelect(movie)}
              className="flex flex-col gap-2 text-left"
            >
              <PosterPlaceholder
                movie={movie}
                className="aspect-[2/3] w-full transition-transform active:scale-[0.98]"
              />
              <div>
                <p className="line-clamp-1 text-sm font-medium">{movie.title_local}</p>
                <p className="line-clamp-1 text-xs text-text-faint">
                  {formatDuration(movie.duration_min)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ShowtimePicker({
  movie,
  onBack,
  onSelect,
}: {
  movie: Movie;
  onBack: () => void;
  onSelect: (showtime: ShowtimeWithVenue) => void;
}) {
  const [showtimes, setShowtimes] = useState<ShowtimeWithVenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShowtimesForMovie(movie.movie_id)
      .then(setShowtimes)
      .finally(() => setLoading(false));
  }, [movie.movie_id]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} aria-label="ย้อนกลับ">
          <ChevronLeft className="h-5 w-5 text-text-muted" />
        </button>
        <div>
          <h1 className="text-lg font-bold">{movie.title_local}</h1>
          <p className="text-xs text-text-faint">{movie.title}</p>
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center text-sm text-text-faint">กำลังโหลด...</p>
      ) : showtimes.length === 0 ? (
        <p className="py-16 text-center text-sm text-text-faint">ไม่มีรอบฉายสำหรับเรื่องนี้</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {showtimes.map((s) => {
            const full = s.status === "soldout";
            return (
              <button
                key={s.showtime_id}
                disabled={full}
                onClick={() => onSelect(s)}
                className={clsx(
                  "flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors",
                  full
                    ? "cursor-not-allowed border-border/50 text-text-faint/50"
                    : "border-border-strong hover:border-accent hover:bg-accent-muted",
                )}
              >
                <span className="flex items-center gap-1.5 text-base font-bold">
                  <Clock className="h-4 w-4" /> {formatTime(s.start_time)}
                </span>
                <span className="text-xs text-text-faint">
                  {s.cinema_name} · {s.hall_name}
                </span>
                <span className="text-xs text-text-faint">
                  {formatCurrency(s.base_price)} เริ่มต้น
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SeatSelection({
  showtime,
  onBack,
}: {
  showtime: ShowtimeWithVenue;
  onBack: () => void;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user)!;
  const setSessionShowtime = usePosSessionStore((s) => s.setShowtime);
  const [notice, setNotice] = useState<string | null>(null);

  const [detail, setDetail] = useState<ShowtimeDetail | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [seatTypes, setSeatTypes] = useState<SeatType[]>([]);
  const [activeSeatIds, setActiveSeatIds] = useState<Set<string>>(new Set());
  const [draftBooking, setDraftBooking] = useState<Booking | null>(null);
  const [mySeatIds, setMySeatIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refreshBookingState = useCallback(async () => {
    const [active, draft] = await Promise.all([
      fetchActiveSeatIds(showtime.showtime_id),
      fetchDraftBooking(user.user_id, showtime.showtime_id),
    ]);
    setActiveSeatIds(active);

    if (isLive(draft)) {
      const seatRows = await fetchBookingSeats(draft.booking_id);
      setDraftBooking(draft);
      setMySeatIds(new Set(seatRows.filter((s) => s.status === "held").map((s) => s.seat_id)));
    } else {
      setDraftBooking(null);
      setMySeatIds(new Set());
    }
  }, [showtime.showtime_id, user.user_id]);

  useEffect(() => {
    let cancelled = false;
    fetchShowtimeDetail(showtime.showtime_id).then(async (d) => {
      if (cancelled) return;
      setDetail(d);
      setSessionShowtime(showtime, d?.movie.title_local ?? "");
      if (d) {
        const [seatRows, types] = await Promise.all([
          fetchSeatsForHall(d.hall.hall_id),
          fetchSeatTypes(),
        ]);
        if (cancelled) return;
        setSeats(seatRows);
        setSeatTypes(types);
        await refreshBookingState();
      }
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showtime.showtime_id]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`pos_booking_seats:${showtime.showtime_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booking_seats",
          filter: `showtime_id=eq.${showtime.showtime_id}`,
        },
        () => {
          fetchActiveSeatIds(showtime.showtime_id).then(setActiveSeatIds);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [showtime.showtime_id]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-text-faint">
        กำลังโหลด...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-text-faint">
        ไม่พบรอบฉายนี้
      </div>
    );
  }

  const { hall } = detail;
  const unavailableIds = new Set([...activeSeatIds].filter((id) => !mySeatIds.has(id)));

  async function handleToggle(seat: Seat) {
    setNotice(null);
    if (mySeatIds.has(seat.seat_id) && draftBooking) {
      await releaseSeat(draftBooking.booking_id, seat.seat_id);
      await refreshBookingState();
      return;
    }
    const result = await holdSeat(showtime.showtime_id, seat.seat_id);
    if (!result.ok) {
      setNotice(result.message ?? "ไม่สามารถเลือกที่นั่งนี้ได้");
    }
    await refreshBookingState();
  }

  const selectedSeats = seats
    .filter((s) => mySeatIds.has(s.seat_id))
    .sort((a, b) => a.seat_row.localeCompare(b.seat_row) || a.seat_column - b.seat_column);

  function handleExpire() {
    refreshBookingState();
    setNotice("หมดเวลาเลือกที่นั่ง ที่นั่งของคุณถูกปล่อยคืนแล้ว");
  }

  function handleContinue() {
    if (!draftBooking) return;
    router.push(`/bookings/${draftBooking.booking_id}/payment`);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <button onClick={onBack} aria-label="ย้อนกลับ">
          <ChevronLeft className="h-5 w-5 text-text-muted" />
        </button>
        <p className="flex-1 text-sm font-semibold">เลือกที่นั่ง</p>
        {draftBooking && (
          <CountdownTimer expiresAt={draftBooking.expires_at} onExpire={handleExpire} />
        )}
      </div>

      {notice && (
        <div className="px-4 pt-3">
          <p className="rounded-lg border border-accent/40 bg-accent-muted px-3 py-2 text-xs text-accent">
            {notice}
          </p>
        </div>
      )}

      <div className="flex-1 px-4 py-6">
        <SeatMap
          hall={hall}
          seats={seats}
          seatTypes={seatTypes}
          selectedIds={mySeatIds}
          unavailableIds={unavailableIds}
          onToggle={handleToggle}
        />
      </div>

      <div className="sticky bottom-0 border-t border-border bg-bg-elevated px-4 py-3">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-text-muted">
            {selectedSeats.length > 0
              ? selectedSeats.map((s) => `${s.seat_row}${s.seat_column}`).join(", ")
              : "ยังไม่ได้เลือกที่นั่ง"}
          </span>
          <span className="font-semibold text-text">
            {formatCurrency(draftBooking?.total_amount ?? 0)}
          </span>
        </div>
        <button
          disabled={selectedSeats.length === 0}
          onClick={handleContinue}
          className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          ดำเนินการชำระเงิน ({selectedSeats.length} ที่นั่ง)
        </button>
      </div>
    </div>
  );
}

export default function TicketingPage() {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [showtime, setShowtime] = useState<ShowtimeWithVenue | null>(null);

  if (!movie) {
    return <MoviePicker onSelect={setMovie} />;
  }
  if (!showtime) {
    return (
      <ShowtimePicker movie={movie} onBack={() => setMovie(null)} onSelect={setShowtime} />
    );
  }
  return <SeatSelection showtime={showtime} onBack={() => setShowtime(null)} />;
}
