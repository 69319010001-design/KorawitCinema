"use client";

import clsx from "clsx";
import type { Hall, Seat, SeatType } from "@/lib/types";

function seatTypeCode(seat: Seat, seatTypes: SeatType[]) {
  return seatTypes.find((t) => t.seat_type_id === seat.seat_type_id)?.code;
}

export default function SeatMap({
  hall,
  seats,
  seatTypes,
  selectedIds,
  unavailableIds,
  onToggle,
}: {
  hall: Hall;
  seats: Seat[];
  seatTypes: SeatType[];
  selectedIds: Set<string>;
  unavailableIds: Set<string>;
  onToggle: (seat: Seat) => void;
}) {
  const rows = Array.from(new Set(seats.map((s) => s.seat_row))).sort();

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="h-1.5 w-full max-w-sm rounded-full"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--color-gold), transparent)",
          boxShadow: "0 0 24px 4px var(--color-gold)",
        }}
      />
      <p className="text-xs tracking-[0.3em] text-text-faint">SCREEN</p>

      <div className="flex flex-col gap-2 overflow-x-auto pb-2">
        {rows.map((row) => (
          <div key={row} className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-center text-xs text-text-faint">
              {row}
            </span>
            <div
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${hall.total_columns}, minmax(0, 1.75rem))`,
              }}
            >
              {seats
                .filter((s) => s.seat_row === row)
                .map((seat) => {
                  const code = seatTypeCode(seat, seatTypes);
                  const isCouple = code === "COUPLE";
                  const isVip = code === "VIP";
                  const selected = selectedIds.has(seat.seat_id);
                  const unavailable = unavailableIds.has(seat.seat_id);

                  return (
                    <button
                      key={seat.seat_id}
                      type="button"
                      disabled={unavailable}
                      onClick={() => onToggle(seat)}
                      title={`${seat.seat_row}${seat.seat_column} · ${code}`}
                      style={{
                        gridColumn: `${seat.seat_column} / span ${isCouple ? 2 : 1}`,
                      }}
                      className={clsx(
                        "h-7 rounded-md border text-[10px] font-medium transition-all",
                        unavailable &&
                          "cursor-not-allowed border-transparent bg-seat-taken text-text-faint/40",
                        !unavailable &&
                          selected &&
                          "border-accent bg-seat-selected text-white shadow-[0_0_0_2px_rgba(225,29,60,0.35)]",
                        !unavailable &&
                          !selected &&
                          isVip &&
                          "border-gold/50 bg-transparent text-gold hover:bg-gold/10",
                        !unavailable &&
                          !selected &&
                          isCouple &&
                          "border-seat-couple/50 bg-transparent text-seat-couple hover:bg-seat-couple/10",
                        !unavailable &&
                          !selected &&
                          !isVip &&
                          !isCouple &&
                          "border-border-strong bg-transparent text-text-muted hover:border-text-muted hover:text-text",
                      )}
                    >
                      {seat.seat_column}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[11px] text-text-muted">
        <Legend swatchClass="border border-border-strong" label="ว่าง" />
        <Legend swatchClass="border border-gold/50 text-gold" label="VIP" />
        <Legend
          swatchClass="border border-seat-couple/50 text-seat-couple"
          label="คู่รัก"
        />
        <Legend swatchClass="bg-seat-selected border-accent" label="เลือกอยู่" />
        <Legend swatchClass="bg-seat-taken border-transparent" label="ไม่ว่าง" />
      </div>
    </div>
  );
}

function Legend({
  swatchClass,
  label,
}: {
  swatchClass: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={clsx("h-3.5 w-3.5 rounded", swatchClass)} />
      {label}
    </span>
  );
}
