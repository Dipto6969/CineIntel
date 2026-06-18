"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronRight, Users } from "lucide-react";
import type { TMDbCastMember } from "@/types/media";

function profileUrl(path: string | null, size: "w185" | "w342" = "w185") {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

type CastSectionProps = {
  cast: TMDbCastMember[];
};

export function CastSection({ cast }: CastSectionProps) {
  const [visibleCount, setVisibleCount] = useState(8);

  const visibleCast = useMemo(() => cast.slice(0, visibleCount), [cast, visibleCount]);
  const hasMore = visibleCount < cast.length;

  return (
    <section className="glass-panel rounded-3xl p-6">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-xs uppercase tracking-[0.3em] text-zinc-400">Top Cast</h2>
          <span className="text-xs text-zinc-600">
            {cast.length ? `${cast.length} total` : "No cast data"}
          </span>
        </div>

        {hasMore ? (
          <button
            type="button"
            onClick={() => setVisibleCount((current) => Math.min(current + 8, cast.length))}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-[oklch(0.70_0.16_195)]/30 hover:text-white"
            aria-label="Show 8 more cast members"
          >
            Show 8 more
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {visibleCast.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4">
          {visibleCast.map((member) => {
            const headshot = profileUrl(member.profile_path, "w185");
            return (
              <div key={member.id} className="group">
                <div className="aspect-3/4 rounded-2xl overflow-hidden bg-black/30 border border-white/10 relative">
                  {headshot ? (
                    <Image
                      src={headshot}
                      alt={member.name}
                      fill
                      sizes="(max-width: 768px) 40vw, 160px"
                      unoptimized
                      className="object-cover opacity-90 group-hover:opacity-100 transition"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-zinc-700">
                      <Users className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="mt-2 text-sm font-bold text-white truncate">{member.name}</div>
                <div className="text-xs text-zinc-500 truncate">{member.character || "Cast"}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No cast data.</p>
      )}
    </section>
  );
}