"use client";

import { X } from "lucide-react";
import { usePosSessionStore } from "@/lib/store/posSessionStore";
import { formatDate, formatTime } from "@/lib/format";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] font-medium uppercase tracking-wider text-text-faint">
        {label}
      </p>
      <p className="truncate text-sm font-semibold text-text">{value}</p>
    </div>
  );
}

export default function PosTopBar() {
  const showtime = usePosSessionStore((s) => s.showtime);
  const movieTitle = usePosSessionStore((s) => s.movieTitle);
  const clear = usePosSessionStore((s) => s.clear);

  return (
    <header className="flex items-center gap-8 border-b border-border bg-bg-elevated px-6 py-3">
      <Stat
        label="Current Showtime"
        value={
          showtime
            ? `${formatDate(showtime.start_time)}, ${formatTime(showtime.start_time)}`
            : "ยังไม่ได้เลือกรอบฉาย"
        }
      />
      <Stat label="Auditorium" value={showtime?.hall_name ?? "-"} />
      <Stat label="Screen Type" value={showtime?.screen_type?.toUpperCase() ?? "-"} />
      <Stat label="Feature Presentation" value={movieTitle ?? "-"} />

      {showtime && (
        <button
          onClick={clear}
          title="เปลี่ยนรอบฉาย"
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-accent"
        >
          <X className="h-3.5 w-3.5" /> เปลี่ยนรอบฉาย
        </button>
      )}
    </header>
  );
}
