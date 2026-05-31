"use client";

import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, Bookmark, Filter, Search, CheckCircle2, X } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { SearchSuggestInput } from "@/components/shared/SearchSuggestInput";
import type { SearchEntity, SearchGroup, UniversalSearchResponse } from "@/types/universal-search";
import { GENRE_MAP } from "@/types/media";
import {
  DEFAULT_FILTERS,
  parseFiltersFromParams,
  serializeFiltersToParams,
} from "@/lib/search/filter-schema";
import type { ContentType, FilterState } from "@/lib/search/filter-schema";
import { getDiscoveryPreset } from "@/features/discovery/saved-queries";

const CONTENT_TYPE_OPTIONS: Array<{ value: "all" | ContentType; label: string }> = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "series", label: "Series" },
  { value: "anime", label: "Anime" },
  { value: "documentary", label: "Documentary" },
  { value: "mini-series", label: "Mini-series" },
];

function posterUrl(path: string | null, size: "w185" | "w342" = "w342") {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function profileUrl(path: string | null, size: "w185" | "w342" = "w185") {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function getEntityImage(entity: SearchEntity) {
  if (!entity.imagePath) return null;
  return entity.imageType === "profile" ? profileUrl(entity.imagePath) : posterUrl(entity.imagePath);
}

function mediaItemId(entity: SearchEntity) {
  return `${entity.id}_${entity.type}`;
}

function buildDecadeOptions() {
  const decades: number[] = [];
  const currentYear = new Date().getFullYear();
  for (let year = 1950; year <= currentYear; year += 10) {
    decades.push(year);
  }
  return decades.reverse();
}

function buildActiveChips(filters: FilterState, sectionTitle: string) {
  const chips: Array<{ key: string; label: string }> = [];
  chips.push({ key: "section", label: sectionTitle });
  if (filters.contentType) chips.push({ key: "contentType", label: filters.contentType });
  if (filters.query.trim()) chips.push({ key: "query", label: `Search: ${filters.query.trim()}` });
  filters.genres.forEach((genre) => chips.push({ key: `genre-${genre}`, label: genre }));
  if (filters.tmdbMin) chips.push({ key: "tmdbMin", label: `TMDb ${filters.tmdbMin}+` });
  if (filters.voteCountMin) chips.push({ key: "voteCountMin", label: `Votes ${filters.voteCountMin}+` });
  if (filters.sort !== "relevance") chips.push({ key: "sort", label: filters.sort.replace("_", " ") });
  return chips;
}

function resolveInitialFilters(searchParams: URLSearchParams) {
  const section = searchParams.get("section");
  const preset = getDiscoveryPreset(section);
  const parsed = parseFiltersFromParams(searchParams);
  const typeAlias = searchParams.get("type");
  const explicitContentType = typeAlias && typeAlias !== "all" ? (typeAlias as FilterState["contentType"]) : undefined;

  const base: FilterState = { ...DEFAULT_FILTERS, ...preset.buildDefaultFilters() } as FilterState;
  const explicitOverrides: Partial<FilterState> = {};

  if (searchParams.has("q")) explicitOverrides.query = parsed.query;
  if (searchParams.has("contentType")) explicitOverrides.contentType = parsed.contentType;
  if (searchParams.has("types")) explicitOverrides.types = parsed.types;
  if (searchParams.has("genres")) explicitOverrides.genres = parsed.genres;
  if (searchParams.has("yearMin")) explicitOverrides.yearMin = parsed.yearMin;
  if (searchParams.has("yearMax")) explicitOverrides.yearMax = parsed.yearMax;
  if (searchParams.has("decade")) explicitOverrides.decade = parsed.decade;
  if (searchParams.has("language")) explicitOverrides.language = parsed.language;
  if (searchParams.has("countries")) explicitOverrides.countries = parsed.countries;
  if (searchParams.has("runtimeMin")) explicitOverrides.runtimeMin = parsed.runtimeMin;
  if (searchParams.has("runtimeMax")) explicitOverrides.runtimeMax = parsed.runtimeMax;
  if (searchParams.has("imdbMin")) explicitOverrides.imdbMin = parsed.imdbMin;
  if (searchParams.has("tmdbMin")) explicitOverrides.tmdbMin = parsed.tmdbMin;
  if (searchParams.has("voteCountMin")) explicitOverrides.voteCountMin = parsed.voteCountMin;
  if (searchParams.has("status")) explicitOverrides.releaseStatus = parsed.releaseStatus;
  if (searchParams.has("tvSubtype")) explicitOverrides.tvSubtype = parsed.tvSubtype;
  if (searchParams.has("sort")) explicitOverrides.sort = parsed.sort;
  if (searchParams.has("director")) explicitOverrides.director = parsed.director;
  if (searchParams.has("actor")) explicitOverrides.actor = parsed.actor;
  if (searchParams.has("studio")) explicitOverrides.studio = parsed.studio;
  if (searchParams.has("keywords")) explicitOverrides.keywords = parsed.keywords;
  if (searchParams.has("franchise")) explicitOverrides.franchise = parsed.franchise;
  if (searchParams.has("awardsOnly")) explicitOverrides.awardsOnly = parsed.awardsOnly;
  if (searchParams.has("personalRatingMin")) explicitOverrides.personalRatingMin = parsed.personalRatingMin;
  if (searchParams.has("favoritesOnly")) explicitOverrides.favoritesOnly = parsed.favoritesOnly;
  if (searchParams.has("inventorySort")) explicitOverrides.inventorySort = parsed.inventorySort;

  const merged = { ...base, ...explicitOverrides } as FilterState;
  const contentType = explicitContentType ?? merged.contentType;

  return {
    ...merged,
    contentType,
    types: contentType === "movie"
      ? ["movie"]
      : contentType === "series"
        ? ["tv"]
        : searchParams.has("types")
          ? parsed.types
          : merged.types,
  } satisfies FilterState;
}

function DiscoveryResults({
  title,
  description,
  section,
  onReset,
  filters,
  setFilters,
  page,
  setPage,
  groups,
  hasMore,
  loading,
  errorMsg,
}: {
  title: string;
  description: string;
  section: string;
  onReset: () => void;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  groups: SearchGroup[];
  hasMore: boolean;
  loading: boolean;
  errorMsg: string | null;
}) {
  const decadeOptions = useMemo(() => buildDecadeOptions(), []);
  const activeChips = useMemo(() => buildActiveChips(filters, title), [filters, title]);
  const visibleGroups = useMemo(() => {
    if (filters.contentType === "movie") {
      return groups.filter((group) => group.type === "movie");
    }

    if (filters.contentType === "series") {
      return groups.filter((group) => group.type === "tv");
    }

    return groups.filter((group) => group.results.length > 0);
  }, [filters.contentType, groups]);

  return (
    <div className="min-h-screen w-full bg-[#050608] text-zinc-100 flex flex-col font-sans selection:bg-[oklch(0.70_0.16_195)]/30 selection:text-white pb-10">
      <Navbar transparentOnTop={false} showSearch={false} initialSearchQuery={filters.query} />

      <main className="flex-1 max-w-400 mx-auto w-full px-6 md:px-12 py-10 mt-24 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <aside className="glass-panel rounded-3xl p-5 space-y-6 h-fit">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Discovery</div>
              <div className="mt-2 text-sm font-semibold text-white">{section}</div>
            </div>
            <button type="button" onClick={onReset} className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-200">
              Reset
            </button>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Content Type</div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 divide-y divide-white/10">
              {CONTENT_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setFilters((prev) => ({
                      ...prev,
                      contentType: option.value === "all" ? undefined : option.value,
                      types:
                        option.value === "movie"
                          ? ["movie"]
                          : option.value === "series"
                            ? ["tv"]
                            : ["movie", "tv"],
                    }));
                    setPage(1);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold transition text-left ${
                    (option.value === "all" && !filters.contentType) || filters.contentType === option.value
                      ? "text-[oklch(0.70_0.16_195)] bg-[oklch(0.70_0.16_195)]/12"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Genres</div>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-auto pr-1">
              {Array.from(new Set(Object.values(GENRE_MAP))).sort((a, b) => a.localeCompare(b)).map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => {
                    setFilters((prev) => ({
                      ...prev,
                      genres: prev.genres.includes(genre)
                        ? prev.genres.filter((entry) => entry !== genre)
                        : [...prev.genres, genre],
                    }));
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                    filters.genres.includes(genre)
                      ? "border-[oklch(0.70_0.16_195)]/40 text-[oklch(0.70_0.16_195)] bg-[oklch(0.70_0.16_195)]/10"
                      : "border-white/10 text-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">TMDb Min</div>
              <input
                type="number"
                step="0.1"
                value={filters.tmdbMin || ""}
                onChange={(event) => setFilters((prev) => ({ ...prev, tmdbMin: Number(event.target.value) || undefined }))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
              />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Vote Count Min</div>
              <input
                type="number"
                value={filters.voteCountMin || ""}
                onChange={(event) => setFilters((prev) => ({ ...prev, voteCountMin: Number(event.target.value) || undefined }))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
              />
            </div>
            <div className="col-span-2">
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Decade</div>
              <select
                value={filters.decade || ""}
                onChange={(event) => setFilters((prev) => ({ ...prev, decade: Number(event.target.value) || undefined }))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
              >
                <option value="">Any</option>
                {decadeOptions.map((decade) => (
                  <option key={decade} value={decade}>{decade}s</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Search</div>
            <SearchSuggestInput
              key={filters.query}
              initialQuery={filters.query}
              onSearch={(term) => {
                setFilters((prev) => ({ ...prev, query: term }));
                setPage(1);
              }}
              shellClassName="w-full flex items-center gap-3 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 focus-within:border-[oklch(0.70_0.16_195)] focus-within:ring-1 focus-within:ring-[oklch(0.70_0.16_195)] transition-all duration-300"
              inputClassName="flex-1 min-w-0 bg-transparent border-none outline-none text-white placeholder-zinc-500 text-sm"
              placeholder="Titles, people, keywords..."
            />
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Sort</div>
            <select
              value={filters.sort}
              onChange={(event) => setFilters((prev) => ({ ...prev, sort: event.target.value as FilterState["sort"] }))}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
            >
              <option value="relevance">Relevance</option>
              <option value="popularity">Popularity</option>
              <option value="release_date">Release Date</option>
              <option value="rating">TMDb Rating</option>
              <option value="runtime">Runtime</option>
              <option value="title">Alphabetical</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setPage(1);
            }}
            className="w-full rounded-xl bg-[oklch(0.70_0.16_195)] text-black font-bold py-2 text-sm hover:bg-[oklch(0.75_0.15_195)] transition"
          >
            Apply Filters
          </button>
        </aside>

        <section>
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[oklch(0.70_0.16_195)]/10 border border-[oklch(0.70_0.16_195)]/20 rounded-full text-xs text-[oklch(0.70_0.16_195)] font-semibold mb-4">
              <Search className="w-3.5 h-3.5" />
              <span>Discovery</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-4 leading-tight">{title}</h1>
            <p className="text-zinc-400 text-lg max-w-2xl leading-relaxed">{description}</p>
          </div>

          <div className="glass-panel rounded-2xl p-5 mb-8">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 text-xs text-zinc-400">
                <Filter className="w-3.5 h-3.5" />
                <span>Filters enabled</span>
              </div>
              {activeChips.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {activeChips.map((chip) => (
                    <span key={chip.key} className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-semibold text-zinc-300">
                      {chip.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            {errorMsg ? (
              <div className="mt-4 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{errorMsg}</div>
            ) : null}
            {loading && !errorMsg ? (
              <div className="mt-4 text-sm text-zinc-500">Loading discovery results...</div>
            ) : null}
          </div>

          {visibleGroups.length > 0 ? visibleGroups.map((group) => (
            <section key={group.type} className="mb-12">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs uppercase tracking-[0.3em] text-zinc-500">{group.label}</h2>
                <span className="text-xs text-zinc-500">{group.total.toLocaleString()} total</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {group.results.map((entity) => {
                  const image = getEntityImage(entity);
                  return (
                    <Link key={mediaItemId(entity)} href={`/media/${entity.id}?type=${entity.type}`} className="group/card relative flex flex-col gap-3">
                      <div className="aspect-2/3 w-full rounded-2xl overflow-hidden bg-[#11131a] border border-white/5 relative transition-all duration-300 group-hover/card:scale-105 group-hover/card:shadow-[0_8px_30px_rgba(0,0,0,0.5)] group-hover/card:z-10 group-hover/card:border-white/20">
                        {image ? (
                          <Image src={image} alt={entity.title} fill sizes="(max-width: 1024px) 40vw, 200px" className="object-cover transition-transform duration-500 group-hover/card:scale-110 opacity-90 group-hover/card:opacity-100" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-zinc-700 font-semibold">NO ART</div>
                        )}
                        <div className="absolute top-2 left-2 right-2 flex justify-between z-20">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase backdrop-blur-md bg-black/60 border border-white/10 text-white shadow-sm">
                            {entity.type === "movie" ? "MOVIE" : "SERIES"}
                          </span>
                        </div>
                        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 pointer-events-none">
                          <p className="text-white font-bold text-sm line-clamp-2 leading-tight drop-shadow-md">{entity.title}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs font-bold text-amber-400 drop-shadow-md">★ {entity.rating || "--"}</span>
                            <span className="text-xs font-medium text-zinc-300 drop-shadow-md">{entity.year || "--"}</span>
                          </div>
                        </div>
                      </div>
                      <h3 className="text-sm font-semibold text-white leading-tight line-clamp-1 group-hover/card:text-[oklch(0.70_0.16_195)] transition">{entity.title}</h3>
                    </Link>
                  );
                })}
              </div>
            </section>
          )) : !loading ? (
            <div className="glass-panel rounded-2xl p-8 text-center text-zinc-400">
              <div className="text-sm font-semibold text-white mb-2">No results for this preset</div>
              <p className="text-sm leading-6">
                Try loosening the filters or choose a different discovery section.
              </p>
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent transition"
            >
              Previous
            </button>
            <div className="text-sm text-zinc-500">Page {page}</div>
            <button
              type="button"
              onClick={() => setPage((current) => current + 1)}
              disabled={!hasMore}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent transition"
            >
              Next
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function DiscoveryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilters = useMemo(() => resolveInitialFilters(searchParams), [searchParams]);
  const section = searchParams.get("section") || "Trending Right Now";
  const preset = getDiscoveryPreset(searchParams.get("section"));

  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [page, setPage] = useState(1);
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new Map<string, { ts: number; data: UniversalSearchResponse }>());
  const cacheTtlMs = 2 * 60 * 1000;

  useEffect(() => {
    setFilters(initialFilters);
    setPage(1);
  }, [initialFilters]);

  useEffect(() => {
    const params = serializeFiltersToParams(filters);
    params.set("section", searchParams.get("section") || preset.key);
    if (searchParams.get("type")) {
      params.set("type", searchParams.get("type") || "all");
    }
    const nextQs = params.toString();
    const currentQs = searchParams.toString();
    if (nextQs !== currentQs) {
      router.replace(`/discover?${nextQs}`);
    }
  }, [filters, preset.key, router, searchParams]);

  useEffect(() => {
    const params = serializeFiltersToParams(filters);
    params.set("section", searchParams.get("section") || preset.key);
    if (searchParams.get("type")) {
      params.set("type", searchParams.get("type") || "all");
    }
    params.set("page", String(page));
    params.set("limit", "20");
    const cacheKey = params.toString();
    const cached = cacheRef.current.get(cacheKey);

    if (cached && Date.now() - cached.ts < cacheTtlMs) {
      setGroups(cached.data.groups || []);
      setHasMore(cached.data.hasMore);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/universal?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(errorPayload.error || "Discovery failed");
        }
        const data = (await response.json()) as UniversalSearchResponse;
        cacheRef.current.set(cacheKey, { ts: Date.now(), data });
        setGroups(data.groups || []);
        setHasMore(data.hasMore);
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const message = error instanceof Error ? error.message : "Discovery failed";
        setErrorMsg(message);
        setGroups([]);
      } finally {
        setLoading(false);
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [filters, page, preset.key, searchParams]);

  const reset = () => {
    const nextFilters = { ...DEFAULT_FILTERS, ...preset.buildDefaultFilters() } as FilterState;
    setFilters(nextFilters);
    setPage(1);
  };

    return (
      <DiscoveryResults
        title={preset.title}
        description={preset.description}
        section={section}
        onReset={reset}
        filters={filters}
        setFilters={setFilters}
        page={page}
        setPage={setPage}
        groups={groups}
        hasMore={hasMore}
        loading={loading}
        errorMsg={errorMsg}
      />
    );
}

export default function DiscoveryBrowser() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080a0f]" />}>
      <DiscoveryPageContent />
    </Suspense>
  );
}
