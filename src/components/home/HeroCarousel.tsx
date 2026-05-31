"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, ChevronLeft, ChevronRight, Loader2, PlayCircle, Sparkles } from "lucide-react";
import type { TMDbSearchResult } from "@/types/tmdb";
import { GENRE_MAP } from "@/types/media";

type HeroCarouselProps = {
  items: TMDbSearchResult[];
  sourceLabel: string;
  watchlistedIds?: string[];
  busyWatchlistId?: string | null;
  onAddToWatchlist?: (item: TMDbSearchResult) => void;
};

const ROTATE_INTERVAL_MS = 9000;
const MAX_SLIDES = 10;

function getTitle(item: TMDbSearchResult) {
  return item.media_type === "movie" ? item.title || "Untitled" : item.name || "Untitled";
}

function getYear(item: TMDbSearchResult) {
  const date = item.media_type === "movie" ? item.release_date : item.first_air_date;
  return date ? date.slice(0, 4) : "";
}

function posterUrl(path: string | null, size: "w500" | "w780" = "w500") {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function backdropUrl(path: string | null, size: "w1280" | "original" = "w1280") {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function mediaItemKey(item: TMDbSearchResult) {
  return `${item.id}_${item.media_type}`;
}

function buildSlides(items: TMDbSearchResult[]) {
  const slides = items.filter((item) => item.backdrop_path || item.poster_path).slice(0, MAX_SLIDES);
  if (slides.length <= 1) return slides;

  const hasMovie = slides.some((item) => item.media_type === "movie");
  const hasTv = slides.some((item) => item.media_type === "tv");

  if (!hasMovie) {
    const movie = items.find((item) => item.media_type === "movie" && (item.backdrop_path || item.poster_path));
    if (movie && !slides.some((item) => item.id === movie.id && item.media_type === movie.media_type)) {
      slides[slides.length - 1] = movie;
    }
  }

  if (!hasTv) {
    const tv = items.find((item) => item.media_type === "tv" && (item.backdrop_path || item.poster_path));
    if (tv && !slides.some((item) => item.id === tv.id && item.media_type === tv.media_type)) {
      slides[slides.length - 1] = tv;
    }
  }

  return slides.slice(0, MAX_SLIDES);
}

export function HeroCarousel({
  items,
  sourceLabel,
  watchlistedIds,
  busyWatchlistId,
  onAddToWatchlist,
}: HeroCarouselProps) {
  const slides = useMemo(() => buildSlides(items), [items]);
  const watchlistedSet = useMemo(() => new Set(watchlistedIds || []), [watchlistedIds]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [remainingMs, setRemainingMs] = useState(ROTATE_INTERVAL_MS);

  useEffect(() => {
    setActiveIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) {
      setRemainingMs(0);
      return;
    }

    setRemainingMs(ROTATE_INTERVAL_MS);
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setRemainingMs(Math.max(0, ROTATE_INTERVAL_MS - (Date.now() - startedAt)));
    }, 100);

    return () => window.clearInterval(timer);
  }, [activeIndex, slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;

    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, ROTATE_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [activeIndex, slides.length]);

  const currentSlide = slides[activeIndex] || slides[0] || null;

  const goToSlide = (index: number) => {
    if (slides.length === 0) return;
    setActiveIndex((index + slides.length) % slides.length);
  };

  const handleWatchlistClick = (item: TMDbSearchResult) => {
    if (!onAddToWatchlist) return;
    void onAddToWatchlist(item);
  };

  if (!currentSlide) {
    return (
      <section className="relative isolate overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#050608] px-6 py-16 md:px-12 md:py-20 shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">
            <Sparkles className="h-3 w-3 text-[oklch(0.70_0.16_195)]" />
            {sourceLabel}
          </div>
          <h1 className="text-4xl font-black text-white md:text-6xl">No featured titles yet</h1>
          <p className="mx-auto max-w-2xl text-zinc-400">
            The carousel will appear here once the trending dataset is loaded.
          </p>
        </div>
      </section>
    );
  }

  const genres = (currentSlide.genre_ids || [])
    .map((genreId) => GENRE_MAP[genreId])
    .filter(Boolean)
    .slice(0, 3);
  const title = getTitle(currentSlide);
  const year = getYear(currentSlide);
  const isWatchlisted = watchlistedSet.has(mediaItemKey(currentSlide));
  const isBusy = busyWatchlistId === mediaItemKey(currentSlide);
  const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const progress = slides.length > 1 ? ((ROTATE_INTERVAL_MS - remainingMs) / ROTATE_INTERVAL_MS) * 100 : 100;

  return (
    <section
      className="group/hero relative isolate overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#050608] shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
      aria-label="Hero carousel"
    >
      <div className="absolute inset-0 bg-[#050608]" />

      {slides.map((item, index) => {
        const isActive = index === activeIndex;
        const backdrop = backdropUrl(item.backdrop_path);

        return (
          <div
            key={`${item.media_type}-${item.id}`}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${isActive ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            {backdrop ? (
              <img
                src={backdrop}
                alt={`${getTitle(item)} backdrop`}
                className="h-full w-full object-cover object-center opacity-65"
                loading="eager"
              />
            ) : null}
          </div>
        );
      })}

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(10,14,18,0.12),transparent_35%),linear-gradient(90deg,rgba(5,6,8,0.95)_0%,rgba(5,6,8,0.82)_42%,rgba(5,6,8,0.4)_72%,rgba(5,6,8,0.2)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050608] via-transparent to-[#050608]/20" />

      <div className="relative z-10 mx-auto flex min-h-[720px] max-w-[1600px] flex-col justify-between gap-8 px-6 py-8 md:px-12 md:py-10 lg:min-h-[820px]">
        <div className="flex items-center justify-between gap-4 pt-16 md:pt-20 lg:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.70_0.16_195)]/25 bg-black/35 px-3 py-1 backdrop-blur-md">
            <Sparkles className="h-3 w-3 text-[oklch(0.70_0.16_195)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-100">
              {sourceLabel} Spotlight
            </span>
          </div>
        </div>

        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1.12fr)_minmax(280px,0.88fr)] lg:gap-12">
          <div className="max-w-3xl space-y-5 md:space-y-6">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-300/90">
              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
                {currentSlide.media_type === "movie" ? "Movie" : "Series"}
              </span>
              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
                {year || "New"}
              </span>
              {genres.slice(0, 1).map((genre) => (
                <span key={genre} className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
                  {genre}
                </span>
              ))}
            </div>

            <h1 className="text-5xl font-black leading-[0.96] tracking-tighter text-white drop-shadow-2xl md:text-7xl lg:text-8xl">
              {title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-zinc-300">
              <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                ★ {currentSlide.vote_average.toFixed(1)}
              </span>
              {genres.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {genres.map((genre) => (
                    <span key={genre} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-300">
                      {genre}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <p className="max-w-2xl text-base leading-7 text-zinc-200/90 md:text-lg md:leading-8">
              {currentSlide.overview || "Overview unavailable for this title."}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href={`/media/${currentSlide.id}?type=${currentSlide.media_type}`}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-extrabold text-black shadow-xl transition hover:bg-zinc-200 active:scale-95"
              >
                <PlayCircle className="h-4 w-4" />
                View Details
              </Link>
              {onAddToWatchlist ? (
                <button
                  type="button"
                  onClick={() => handleWatchlistClick(currentSlide)}
                  disabled={isWatchlisted || isBusy}
                  className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-extrabold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                    isWatchlisted
                      ? "border-[oklch(0.78_0.14_75)]/35 bg-[oklch(0.78_0.14_75)]/10 text-[oklch(0.84_0.13_75)]"
                      : "border-white/10 bg-white/5 text-white hover:border-[oklch(0.78_0.14_75)]/35 hover:bg-[oklch(0.78_0.14_75)]/10 hover:text-[oklch(0.84_0.13_75)]"
                  }`}
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className="h-4 w-4" />}
                  {isWatchlisted ? "In Watchlist" : "Add to Watchlist"}
                </button>
              ) : (
                <Link
                  href="/watchlist"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-extrabold text-white transition hover:border-[oklch(0.78_0.14_75)]/35 hover:bg-[oklch(0.78_0.14_75)]/10 hover:text-[oklch(0.84_0.13_75)] active:scale-95"
                >
                  <Bookmark className="h-4 w-4" />
                  Add to Watchlist
                </Link>
              )}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[360px] lg:max-w-[420px]">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/40 shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/30" />
              <div className="aspect-[2/3] w-full">
                {posterUrl(currentSlide.poster_path) ? (
                  <img
                    src={posterUrl(currentSlide.poster_path) || ""}
                    alt={`${title} poster`}
                    className="h-full w-full object-cover"
                    loading="eager"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#11131a] text-xs font-semibold text-zinc-500">
                    NO POSTER
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm font-semibold text-zinc-400">
              <span>
                Slide {activeIndex + 1} of {slides.length}
              </span>
              <span className="text-zinc-300">★ {currentSlide.vote_average.toFixed(1)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 pb-2">
          <div className="flex items-center justify-between gap-4">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full w-full rounded-full bg-[oklch(0.70_0.16_195)]"
                style={{
                  transform: `scaleX(${progress / 100})`,
                  transformOrigin: "left",
                  transition: "transform 100ms linear",
                }}
              />
            </div>
            <div className="hidden gap-2 md:flex">
              <button
                type="button"
                onClick={() => goToSlide(activeIndex - 1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/90 transition hover:border-white/20 hover:bg-white/10"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => goToSlide(activeIndex + 1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/90 transition hover:border-white/20 hover:bg-white/10"
                aria-label="Next slide"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {slides.map((item, index) => {
              const active = index === activeIndex;
              return (
                <button
                  key={`${item.media_type}-${item.id}-indicator`}
                  type="button"
                  onClick={() => goToSlide(index)}
                  className={`min-w-[44px] rounded-full border px-3 py-2 text-xs font-bold transition ${
                    active
                      ? "border-[oklch(0.70_0.16_195)]/40 bg-[oklch(0.70_0.16_195)]/15 text-[oklch(0.82_0.13_195)]"
                      : "border-white/10 bg-black/35 text-zinc-400 hover:border-white/20 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                  aria-pressed={active}
                >
                  {String(index + 1).padStart(2, "0")}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-[1600px] px-6 pb-5 md:px-12 md:pb-6" />
    </section>
  );
}