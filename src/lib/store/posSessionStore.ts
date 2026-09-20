"use client";

import { create } from "zustand";
import type { ShowtimeWithVenue } from "../queries";

const STORAGE_KEY = "pos-session-showtime";

interface PosSessionState {
  showtime: ShowtimeWithVenue | null;
  movieTitle: string | null;
  setShowtime: (showtime: ShowtimeWithVenue, movieTitle: string) => void;
  clear: () => void;
}

function loadInitial(): { showtime: ShowtimeWithVenue; movieTitle: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const initial = loadInitial();

export const usePosSessionStore = create<PosSessionState>()((set) => ({
  showtime: initial?.showtime ?? null,
  movieTitle: initial?.movieTitle ?? null,

  setShowtime: (showtime, movieTitle) => {
    set({ showtime, movieTitle });
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ showtime, movieTitle }));
    } catch {
      // sessionStorage unavailable — session bar just won't survive a refresh
    }
  },

  clear: () => {
    set({ showtime: null, movieTitle: null });
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
}));
