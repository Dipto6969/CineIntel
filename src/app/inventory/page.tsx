"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, ChevronLeft, ChevronRight, Filter, Heart, RefreshCw, Search, Trash2, X } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { useAuth } from "@/features/auth/auth-provider";
import { DEFAULT_FILTERS, FilterState } from "@/lib/search/filter-schema";
import { applyQueryClauses, evaluateAdvancedClauses, parseAdvancedQuery } from "@/lib/search/query-parser";
import { CUSTOM_TAG_SUGGESTIONS, normalizeTagKey } from "@/lib/tags";

type MediaType = "movie" | "tv";
type WatchStatus = "completed" | "dropped" | "on_hold" | "plan_to_watch";
type InventoryViewMode = "recent" | "all";

const PAGE_SIZE = 48;
const RECENT_LIMIT = 24;

type MediaItem = {
  id: string;
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  original_title: string | null;
  release_date: string | null;
  poster_path: string | null;
  vote_average: number | null;
  runtime: number | null;
  genres?: string[];
  languages?: string[];
  countries?: string[];
  cast_list?: string[];
  directors?: string[];
  studios?: string[];
};

type InventoryItem = {
  id: string;
  media_item_id: string;
  status: WatchStatus;
  rating: number | null;
  watch_dates: string[];
  rewatch_count: number;
  notes: string | null;
  is_favorite: boolean;
  created_at?: string | null;
  tags?: { id: string; name: string }[];
  media_item?: MediaItem | null;
};

function posterUrl(path: string | null, size: "w185" | "w342" | "w500" = "w342") {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function getYear(item: MediaItem | undefined | null) {
  if (!item) return "--";
  const releaseDate = item.release_date;
  return releaseDate ? releaseDate.slice(0, 4) : "--";
}

function formatRating(value: number | null) {
  if (value === null || Number.isNaN(value)) return "--";
  return value.toFixed(1);
}

function matchesInventoryClause(
  clause: Parameters<typeof evaluateAdvancedClauses>[1] extends (clause: infer C) => boolean ? C : never,
  item: InventoryItem,
  media: MediaItem
) {
  const value = clause.value.trim().toLowerCase();
  if (!value) return false;

  switch (clause.field) {
    case "genre":
      return (media.genres || []).some((genre) => genre.toLowerCase().includes(value));
    case "language":
      return (media.languages || []).some((language) => language.toLowerCase().includes(value));
    case "country":
      return (media.countries || []).some((country) => country.toLowerCase().includes(value));
    case "director":
      return (media.directors || []).some((director) => director.toLowerCase().includes(value));
    case "actor":
    case "cast":
      return (media.cast_list || []).some((actor) => actor.toLowerCase().includes(value));
    case "studio":
    case "company":
      return (media.studios || []).some((studio) => studio.toLowerCase().includes(value));
    case "keyword":
      return [media.title, media.original_title, item.notes, ...(media.genres || []), ...(media.cast_list || []), ...(media.directors || []), ...(media.studios || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(value);
    case "rating":
      return (media.vote_average ?? 0) >= Number(value);
    case "year": {
      const year = media.release_date ? Number(media.release_date.slice(0, 4)) : null;
      if (!year) return false;
      if (clause.operator.includes(">")) return year >= Number(value);
      if (clause.operator.includes("<")) return year <= Number(value);
      return year === Number(value);
    }
    default:
      return false;
  }
}

export default function InventoryPage() {
  const { loading } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_FILTERS,
    types: ["movie", "tv"],
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [viewMode, setViewMode] = useState<InventoryViewMode>("recent");
  const [currentPage, setCurrentPage] = useState(1);
  const [tagFilterDraft, setTagFilterDraft] = useState("");

  const watchedItems = useMemo(
    () => inventory.filter((item) => item.status === "completed"),
    [inventory]
  );

  const filteredWatchedItems = useMemo(() => {
    const parsed = parseAdvancedQuery(filters.query);
    const mergedFilters = applyQueryClauses({ ...filters, query: parsed.text }, parsed.clauses);
    const trimmed = mergedFilters.query.trim().toLowerCase();
    const clauses = parsed.clauses;
    const genreSet = new Set(mergedFilters.genres.map((value) => value.toLowerCase()));
    const countrySet = new Set(mergedFilters.countries.map((value) => value.toLowerCase()));
    const languageValue = mergedFilters.language?.toLowerCase();
    const tagFilterSet = new Set(
      tagFilterDraft
        .split(",")
        .map((value) => normalizeTagKey(value))
        .filter(Boolean)
    );

    return watchedItems.filter((item) => {
      const media = item.media_item;
      if (!media) return false;
      if (mergedFilters.types.length > 0 && !mergedFilters.types.includes(media.media_type)) {
        return false;
      }
      if (mergedFilters.favoritesOnly && !item.is_favorite) return false;
      if (mergedFilters.personalRatingMin && (item.rating ?? 0) < mergedFilters.personalRatingMin) {
        return false;
      }
      if (mergedFilters.tmdbMin && (media.vote_average ?? 0) < mergedFilters.tmdbMin) return false;

      if (mergedFilters.yearMin || mergedFilters.yearMax || mergedFilters.decade) {
        const year = media.release_date ? Number(media.release_date.slice(0, 4)) : null;
        if (!year) return false;
        if (mergedFilters.decade && (year < mergedFilters.decade || year >= mergedFilters.decade + 10)) return false;
        if (mergedFilters.yearMin && year < mergedFilters.yearMin) return false;
        if (mergedFilters.yearMax && year > mergedFilters.yearMax) return false;
      }

      if (mergedFilters.runtimeMin && (media.runtime ?? 0) < mergedFilters.runtimeMin) return false;
      if (mergedFilters.runtimeMax && (media.runtime ?? 0) > mergedFilters.runtimeMax) return false;

      if (genreSet.size > 0) {
        const genres = (media.genres || []).map((value) => value.toLowerCase());
        const matches = Array.from(genreSet).every((genre) => genres.includes(genre));
        if (!matches) return false;
      }

      if (countrySet.size > 0) {
        const countries = (media.countries || []).map((value) => value.toLowerCase());
        const matches = Array.from(countrySet).some((country) => countries.includes(country));
        if (!matches) return false;
      }

      if (languageValue) {
        const languages = (media.languages || []).map((value) => value.toLowerCase());
        if (!languages.some((lang) => lang.includes(languageValue))) return false;
      }

      if (mergedFilters.director.length > 0) {
        const directors = (media.directors || []).map((value) => value.toLowerCase());
        const matches = mergedFilters.director.some((value) =>
          directors.some((entry) => entry.includes(value.toLowerCase()))
        );
        if (!matches) return false;
      }

      if (mergedFilters.actor.length > 0) {
        const cast = (media.cast_list || []).map((value) => value.toLowerCase());
        const matches = mergedFilters.actor.some((value) =>
          cast.some((entry) => entry.includes(value.toLowerCase()))
        );
        if (!matches) return false;
      }

      if (mergedFilters.studio.length > 0) {
        const studios = (media.studios || []).map((value) => value.toLowerCase());
        const matches = mergedFilters.studio.some((value) =>
          studios.some((entry) => entry.includes(value.toLowerCase()))
        );
        if (!matches) return false;
      }

      if (tagFilterSet.size > 0) {
        const itemTags = (item.tags || []).map((tag) => normalizeTagKey(tag.name));
        const matches = Array.from(tagFilterSet).every((tag) => itemTags.includes(tag));
        if (!matches) return false;
      }

      if (clauses.length > 0) {
        const clauseMatch = evaluateAdvancedClauses(clauses, (clause) => matchesInventoryClause(clause, item, media));
        if (!clauseMatch) return false;
      }

      if (!trimmed) return true;
      const searchable = [
        media.title,
        media.original_title,
        media.release_date?.slice(0, 4),
        item.notes,
        ...(media.genres || []),
        ...(media.cast_list || []),
        ...(media.directors || []),
        ...(media.studios || []),
        ...(item.tags || []).map((tag) => tag.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(trimmed);
    });
  }, [filters, tagFilterDraft, watchedItems]);

  const totalPages = Math.max(1, Math.ceil(filteredWatchedItems.length / PAGE_SIZE));

  const sortedWatchedItems = useMemo(() => {
    const items = [...filteredWatchedItems];
    switch (filters.inventorySort) {
      case "personal_rating":
        return items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case "favorites":
        return items.sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite));
      case "recently_added":
      default:
        return items.sort((a, b) => {
          const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bDate - aDate;
        });
    }
  }, [filteredWatchedItems, filters.inventorySort]);

  const visibleWatchedItems = useMemo(() => {
    if (viewMode === "recent") {
      return sortedWatchedItems.slice(0, RECENT_LIMIT);
    }

    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedWatchedItems.slice(start, start + PAGE_SIZE);
  }, [currentPage, sortedWatchedItems, viewMode]);

  const stats = useMemo(() => {
    const rated = watchedItems.filter((item) => typeof item.rating === "number");
    const average =
      rated.length > 0
        ? rated.reduce((sum, item) => sum + Number(item.rating), 0) / rated.length
        : null;

    return {
      watched: watchedItems.length,
      movies: watchedItems.filter((item) => item.media_item?.media_type === "movie").length,
      series: watchedItems.filter((item) => item.media_item?.media_type === "tv").length,
      favorites: watchedItems.filter((item) => item.is_favorite).length,
      average,
    };
  }, [watchedItems]);

  const refreshInventory = async () => {
    setNotice(null);
    setIsLoadingInventory(true);
    try {
      const response = await fetch("/api/inventory");
      if (!response.ok) {
        throw new Error("Failed to load inventory");
      }
      const data = (await response.json()) as InventoryItem[];
      setInventory(data);
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "Failed to load inventory");
    } finally {
      setIsLoadingInventory(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshInventory();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, viewMode]);

  const handleDeleteInventory = async (inventoryId: string) => {
    setNotice(null);
    try {
      const response = await fetch(`/api/inventory/${inventoryId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to remove item");
      }
      await refreshInventory();
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "Failed to remove item");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#050608] text-white font-sans">
        <div className="w-8 h-8 border-4 border-[oklch(0.70_0.16_195)] border-t-transparent rounded-full animate-spin mb-4" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#050608] text-zinc-100 flex flex-col font-sans selection:bg-[oklch(0.70_0.16_195)]/30 selection:text-white pb-10">
      <Navbar transparentOnTop={false} />

      <main className="flex-1 max-w-400 mx-auto w-full px-6 md:px-12 py-10 mt-24">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[oklch(0.75_0.15_140)]/10 border border-[oklch(0.75_0.15_140)]/20 rounded-full text-xs text-[oklch(0.75_0.15_140)] font-semibold mb-4">
              <Archive className="w-3.5 h-3.5" />
              <span>Watched Inventory</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white">
              Completed titles
            </h1>
            <p className="mt-2 text-sm text-zinc-500 max-w-2xl">
              Your watched movies and series, separated from the future queue.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 min-w-0 lg:min-w-105">
            <div className="glass-panel rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Watched</div>
              <div className="mt-1 text-2xl font-black text-white">{stats.watched}</div>
            </div>
            <div className="glass-panel rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Movies</div>
              <div className="mt-1 text-2xl font-black text-white">{stats.movies}</div>
            </div>
            <div className="glass-panel rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Series</div>
              <div className="mt-1 text-2xl font-black text-white">{stats.series}</div>
            </div>
          </div>
        </div>

        {notice && (
          <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-sm text-rose-300">
            {notice}
          </div>
        )}

        <section className="glass-panel rounded-3xl p-5 mb-10">
          <div className="flex flex-col xl:flex-row xl:items-center gap-4">
            <div className="flex-1">
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">
                Inventory Search
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  value={filters.query}
                  onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
                  className="w-full pl-11 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[oklch(0.70_0.16_195)] focus:ring-1 focus:ring-[oklch(0.70_0.16_195)] transition-all duration-300 text-sm"
                  placeholder="Search only your watched inventory..."
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">
                  Type
                </div>
                <div className="flex items-center gap-2">
                  {["movie", "tv"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFilters((prev) => ({
                        ...prev,
                        types: prev.types.includes(type as MediaType)
                          ? prev.types.filter((entry) => entry !== type)
                          : [...prev.types, type as MediaType],
                      }))}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border transition ${
                        filters.types.includes(type as MediaType)
                          ? "border-[oklch(0.70_0.16_195)]/40 text-[oklch(0.70_0.16_195)] bg-[oklch(0.70_0.16_195)]/10"
                          : "border-white/10 text-zinc-500 hover:text-zinc-200"
                      }`}
                    >
                      {type === "movie" ? "Movies" : "Series"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">
                  Sort
                </div>
                <select
                  value={filters.inventorySort}
                  onChange={(event) => setFilters((prev) => ({
                    ...prev,
                    inventorySort: event.target.value as FilterState["inventorySort"],
                  }))}
                  className="w-full md:w-40 bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-sm text-zinc-200"
                >
                  <option value="recently_added">Recently added</option>
                  <option value="personal_rating">Your rating</option>
                  <option value="favorites">Favorites</option>
                </select>
              </div>

              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">
                  View
                </div>
                <div className="flex rounded-xl border border-white/10 bg-black/40 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("recent")}
                    className={`px-3 py-2 text-sm font-semibold rounded-lg transition ${
                      viewMode === "recent"
                        ? "bg-white/10 text-white"
                        : "text-zinc-500 hover:text-zinc-200"
                    }`}
                  >
                    Recent
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("all")}
                    className={`px-3 py-2 text-sm font-semibold rounded-lg transition ${
                      viewMode === "all"
                        ? "bg-[oklch(0.70_0.16_195)]/20 text-[oklch(0.70_0.16_195)]"
                        : "text-zinc-500 hover:text-zinc-200"
                    }`}
                  >
                    Show All
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <div className="text-xs text-zinc-500">
              Showing {visibleWatchedItems.length} of {filteredWatchedItems.length} matching inventory titles.
              {viewMode === "recent" && filteredWatchedItems.length > RECENT_LIMIT
                ? " Switch to Show All for paginated browsing."
                : ""}
            </div>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 rounded-xl border border-[oklch(0.70_0.16_195)]/30 bg-[oklch(0.70_0.16_195)]/10 px-4 py-2 text-xs font-bold text-[oklch(0.70_0.16_195)] hover:bg-[oklch(0.70_0.16_195)]/15 transition"
            >
              Add watched titles
            </Link>
          </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Filters</div>
          <button
            type="button"
            onClick={() => setAdvancedOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:border-white/20 transition"
          >
            <Filter className="w-3.5 h-3.5" />
            Advanced
          </button>
        </div>

        {advancedOpen && (
            <div className="mt-6 border-t border-white/10 pt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">Genres</div>
                <input
                  value={filters.genres.join(", ")}
                  onChange={(event) => setFilters((prev) => ({
                    ...prev,
                    genres: event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                  }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
                  placeholder="Thriller, Mystery"
                />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">Language</div>
                <input
                  value={filters.language || ""}
                  onChange={(event) => setFilters((prev) => ({ ...prev, language: event.target.value || undefined }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
                  placeholder="Korean"
                />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">Custom tags</div>
                <input
                  value={tagFilterDraft}
                  onChange={(event) => setTagFilterDraft(event.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
                  placeholder="courtroom, time travel"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {CUSTOM_TAG_SUGGESTIONS.slice(0, 12).map((tag) => {
                    const active = tagFilterDraft
                      .split(",")
                      .map((value) => normalizeTagKey(value))
                      .includes(normalizeTagKey(tag));
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const current = tagFilterDraft
                            .split(",")
                            .map((value) => value.trim())
                            .filter(Boolean)
                            .filter((value) => normalizeTagKey(value) !== normalizeTagKey(tag));
                          if (active) {
                            setTagFilterDraft(current.join(", "));
                          } else {
                            setTagFilterDraft([...current, tag].join(", "));
                          }
                        }}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                          active
                            ? "border-[oklch(0.70_0.16_195)]/30 bg-[oklch(0.70_0.16_195)]/10 text-[oklch(0.70_0.16_195)]"
                            : "border-white/10 text-zinc-500 hover:text-zinc-200"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">Country</div>
                <input
                  value={filters.countries.join(", ")}
                  onChange={(event) => setFilters((prev) => ({
                    ...prev,
                    countries: event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                  }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
                  placeholder="South Korea"
                />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">Year range</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={filters.yearMin || ""}
                    onChange={(event) => setFilters((prev) => ({ ...prev, yearMin: Number(event.target.value) || undefined }))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
                    placeholder="2010"
                  />
                  <input
                    type="number"
                    value={filters.yearMax || ""}
                    onChange={(event) => setFilters((prev) => ({ ...prev, yearMax: Number(event.target.value) || undefined }))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
                    placeholder="2020"
                  />
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">Runtime (min)</div>
                <input
                  type="number"
                  value={filters.runtimeMin || ""}
                  onChange={(event) => setFilters((prev) => ({ ...prev, runtimeMin: Number(event.target.value) || undefined }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
                  placeholder="90"
                />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">Your rating min</div>
                <input
                  type="number"
                  step="0.5"
                  value={filters.personalRatingMin || ""}
                  onChange={(event) => setFilters((prev) => ({ ...prev, personalRatingMin: Number(event.target.value) || undefined }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
                  placeholder="8"
                />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-2">Favorites only</div>
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, favoritesOnly: !prev.favoritesOnly }))}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                    filters.favoritesOnly
                      ? "border-[oklch(0.70_0.16_195)]/40 text-[oklch(0.70_0.16_195)] bg-[oklch(0.70_0.16_195)]/10"
                      : "border-white/10 text-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  Favorites
                  {filters.favoritesOnly ? <X className="w-3 h-3" /> : null}
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void refreshInventory()}
              className="inline-flex items-center gap-2 px-4 py-2 border border-white/10 rounded-xl text-xs text-zinc-300 hover:bg-white/5 transition active:scale-95 w-max"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingInventory ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {filteredWatchedItems.length === 0 && !isLoadingInventory ? (
            <div className="py-24 text-center border-2 border-dashed border-white/10 rounded-3xl">
              <Archive className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {watchedItems.length === 0 ? "No watched titles yet" : "No matching inventory titles"}
              </h3>
              <p className="text-zinc-500 text-sm max-w-md mx-auto">
                {watchedItems.length === 0
                  ? "Use the main search page or any detail page to add watched titles to inventory."
                  : "Try a different title search or switch the movie/series filter."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {visibleWatchedItems.map((item) => {
                  const poster = posterUrl(item.media_item?.poster_path || null, "w342");
                  const title = item.media_item?.title || "Untitled";
                  const href = `/media/${item.media_item?.tmdb_id}?type=${item.media_item?.media_type}`;

                  return (
                    <div key={item.id} className="group/card relative flex flex-col gap-3">
                      <Link href={href}>
                        <div className="aspect-2/3 w-full rounded-2xl overflow-hidden bg-[#11131a] border border-white/5 relative transition-all duration-300 group-hover/card:scale-105 group-hover/card:shadow-[0_8px_30px_rgba(0,0,0,0.5)] group-hover/card:z-10 group-hover/card:border-white/20">
                          {poster ? (
                            <img src={poster} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110 opacity-90 group-hover/card:opacity-100" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-zinc-700 font-semibold">NO ART</div>
                          )}
                          <div className="absolute top-2 left-2 right-2 flex items-start justify-between z-20 gap-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase backdrop-blur-md bg-black/60 border border-[oklch(0.75_0.15_140)]/30 text-[oklch(0.75_0.15_140)]">
                              {item.media_item?.media_type === "tv" ? "Series" : "Movie"}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {item.rating !== null && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide backdrop-blur-md bg-black/60 border border-amber-400/30 text-amber-300">
                                  ★ {formatRating(item.rating)}
                                </span>
                              )}
                              {item.is_favorite && (
                                <span className="p-1 rounded-full backdrop-blur-md bg-black/60 border border-rose-400/30 text-rose-300">
                                  <Heart className="w-3 h-3 fill-current" />
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 pointer-events-none">
                            <p className="text-white font-bold text-sm line-clamp-2 leading-tight drop-shadow-md">{title}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs font-medium text-zinc-300 drop-shadow-md">
                                {item.watch_dates?.[0] || getYear(item.media_item)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                      <div className="flex items-center justify-between px-1 gap-2">
                        <h3 className="text-sm font-semibold text-white leading-tight line-clamp-1 group-hover/card:text-[oklch(0.70_0.16_195)] transition">
                          {title}
                        </h3>
                          {item.tags?.length ? (
                            <div className="text-[11px] text-zinc-500 line-clamp-1">
                              {item.tags.slice(0, 2).map((tag) => tag.name).join(", ")}
                              {item.tags.length > 2 ? ` +${item.tags.length - 2}` : ""}
                            </div>
                          ) : null}
                        <button
                          onClick={(event) => {
                            event.preventDefault();
                            handleDeleteInventory(item.id);
                          }}
                          className="shrink-0 opacity-0 group-hover/card:opacity-100 text-rose-400 hover:text-rose-300 transition-opacity p-1 rounded-md hover:bg-rose-500/10 z-20"
                          title="Remove from inventory"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {viewMode === "all" && totalPages > 1 && (
                <div className="mt-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-white/10 pt-6">
                  <div className="text-sm text-zinc-500">
                    Page {currentPage} of {totalPages} · {PAGE_SIZE} titles per page
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent transition"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent transition"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
