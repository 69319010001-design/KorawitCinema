"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { CalendarDays, CheckCircle2, Clapperboard, MapPin, Ticket } from "lucide-react";
import AuthGuard from "@/components/AuthGuard";
import { fetchShowtimeDetail, fetchSeatsForHall } from "@/lib/queries";
import type { ShowtimeDetail } from "@/lib/queries";
import { fetchBooking, fetchBookingSeats } from "@/lib/mutations";
import { formatDateLong, formatTime } from "@/lib/format";
import type { Booking, BookingSeat, Seat } from "@/lib/types";

function TicketContent({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [mySeats, setMySeats] = useState<BookingSeat[]>([]);
  const [detail, setDetail] = useState<ShowtimeDetail | null>(null);
  const [hallSeats, setHallSeats] = useState<Seat[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const b = await fetchBooking(bookingId);
      if (cancelled) return;
      setBooking(b);
      if (!b) {
        setLoading(false);
        return;
      }
      const [seats, d] = await Promise.all([
        fetchBookingSeats(bookingId),
        fetchShowtimeDetail(b.showtime_id),
      ]);
      if (cancelled) return;
      setMySeats(seats);
      setDetail(d);
      if (d) {
        const seatRows = await fetchSeatsForHall(d.hall.hall_id);
        if (!cancelled) setHallSeats(seatRows);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const seatLabels = useMemo(() => {
    return mySeats
      .map((bs) => hallSeats.find((s) => s.seat_id === bs.seat_id))
      .filter(Boolean)
      .sort(
        (a, b) =>
          a!.seat_row.localeCompare(b!.seat_row) || a!.seat_column - b!.seat_column,
      )
      .map((s) => `${s!.seat_row}${s!.seat_column}`);
  }, [hallSeats, mySeats]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-text-faint">
        กำลังโหลด...
      </div>
    );
  }

  if (!booking || !detail || booking.status !== "confirmed") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-text-muted">ไม่พบตั๋วนี้ หรือยังไม่ได้ชำระเงิน</p>
        <button
          onClick={() => router.push("/pos/reservations")}
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
        >
          ดูประวัติการจอง
        </button>
      </div>
    );
  }

  const { showtime, movie, hall, cinema } = detail;

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-6">
      <div className="mb-5 flex flex-col items-center gap-1.5 text-success">
        <CheckCircle2 className="h-10 w-10" />
        <p className="text-sm font-semibold">ชำระเงินสำเร็จ</p>
      </div>

      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-bg-elevated">
        <div
          className="flex items-center gap-3 p-4"
          style={{
            background: `linear-gradient(135deg, ${movie.gradient[0]}, ${movie.gradient[1]})`,
          }}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/25">
            <Clapperboard className="h-5 w-5 text-white" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{movie.title_local}</p>
            <p className="truncate text-xs text-white/70">{movie.title}</p>
          </div>
        </div>

        <div className="space-y-3 p-4 text-sm">
          <InfoRow icon={MapPin} text={`${cinema.name} · ${hall.name}`} />
          <InfoRow
            icon={CalendarDays}
            text={`${formatDateLong(showtime.start_time)} · ${formatTime(showtime.start_time)} น.`}
          />
          <InfoRow icon={Ticket} text={`ที่นั่ง ${seatLabels.join(", ")}`} />
        </div>

        <div className="relative flex items-center py-1">
          <span className="absolute -left-3 h-6 w-6 rounded-full bg-bg" />
          <div className="flex-1 border-t border-dashed border-border" />
          <span className="absolute -right-3 h-6 w-6 rounded-full bg-bg" />
        </div>

        <div className="flex flex-col items-center gap-2 p-6">
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG value={`KORAWITCINEMA:${booking.booking_code}`} size={148} />
          </div>
          <p className="font-mono text-lg font-bold tracking-[0.2em]">
            {booking.booking_code}
          </p>
          <p className="text-center text-xs text-text-faint">
            แสดง QR นี้ที่จุดสแกนหน้าโรงภาพยนตร์
          </p>
        </div>
      </div>

      <div className="mt-6 flex w-full max-w-sm gap-3">
        <button
          onClick={() => router.push("/pos/reservations")}
          className="flex-1 rounded-xl border border-border-strong py-2.5 text-sm font-medium text-text-muted hover:text-text"
        >
          ประวัติการจอง
        </button>
        <button
          onClick={() => router.push("/")}
          className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          กลับหน้าแรก
        </button>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 text-text-muted">
      <Icon className="h-4 w-4 shrink-0 text-text-faint" />
      <span>{text}</span>
    </div>
  );
}

export default function TicketPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  return (
    <AuthGuard>
      <TicketContent bookingId={bookingId} />
    </AuthGuard>
  );
}
