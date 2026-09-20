import { Clapperboard } from "lucide-react";
import type { Movie } from "@/lib/types";

export default function PosterPlaceholder({
  movie,
  className = "",
}: {
  movie: Movie;
  className?: string;
}) {
  return (
    <div
      className={`relative flex items-end overflow-hidden rounded-xl ${className}`}
      style={{
        background: `linear-gradient(155deg, ${movie.gradient[0]}, ${movie.gradient[1]})`,
      }}
    >
      <div className="absolute inset-0 bg-black/15" />
      <Clapperboard
        className="absolute -right-3 -top-3 h-20 w-20 text-white/10"
        strokeWidth={1.2}
      />
      <div className="relative z-10 w-full bg-gradient-to-t from-black/70 to-transparent p-3">
        <p className="line-clamp-2 text-sm font-semibold text-white">
          {movie.title}
        </p>
        <p className="line-clamp-1 text-xs text-white/70">{movie.title_local}</p>
      </div>
      <span className="absolute left-2 top-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-gold backdrop-blur-sm">
        {movie.age_rating}
      </span>
    </div>
  );
}
