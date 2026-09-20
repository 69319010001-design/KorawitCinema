"use client";

import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import clsx from "clsx";

export default function CountdownTimer({
  expiresAt,
  onExpire,
}: {
  expiresAt: string;
  onExpire?: () => void;
}) {
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, new Date(expiresAt).getTime() - Date.now()),
  );
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    const tick = () => {
      const ms = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setRemainingMs(ms);
      if (ms === 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const urgent = totalSeconds <= 60;

  return (
    <div
      className={clsx(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold tabular-nums",
        urgent
          ? "border-accent/40 bg-accent-muted text-accent animate-pulse-soft"
          : "border-border-strong bg-bg-elevated-2 text-text",
      )}
    >
      <Timer className="h-4 w-4" />
      {minutes}:{seconds.toString().padStart(2, "0")}
    </div>
  );
}
