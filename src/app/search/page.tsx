"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  Bookmark,
  CheckCircle2,
  Filter,
  Search,
  Users,
  X,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { SearchSuggestInput } from "@/components/shared/SearchSuggestInput";
import type {
  SearchEntity,
  SearchEntityType,
  SearchGroup,
  UniversalSearchResponse,
} from "@/types/universal-search";
import { GENRE_MAP } from "@/types/media";
import {
  DEFAULT_FILTERS,
  parseFiltersFromParams,
  serializeFiltersToParams,
} from "@/lib/search/filter-schema";
import type { ContentType, FilterState } from "@/lib/search/filter-schema";
import { applyQueryClauses, parseAdvancedQuery } from "@/lib/search/query-parser";

const ENTITY_LABELS: Record<SearchEntityType, string> = {
  movie: "Movies",
  tv: "Series",
  person: "People",
  collection: "Collections",
  keyword: "Keywords",
  company: "Companies",
  network: "Networks",
};

const ENTITY_ORDER: SearchEntityType[] = [
  "movie",
  "tv",
  "person",
  "collection",
  "keyword",
  "company",
  "network",
];

const PER_GROUP_LIMIT = 12;

type InventoryItem = {
  id: string;
  media_item_id: string;
  status: "completed" | "dropped" | "on_hold" | "plan_to_watch";
};

const GENRE_OPTIONS = Array.from(new Set(Object.values(GENRE_MAP))).sort((a, b) => a.localeCompare(b));

const CONTENT_TYPE_OPTIONS: Array<{ value: ContentType; label: string }> = [
  { value: "movie", label: "Movies" },
  { value: "series", label: "Series" },
  { value: "anime", label: "Anime" },
  { value: "documentary", label: "Documentary" },
  { value: "mini-series", label: "Mini-series" },
];

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  movie: "Movies",
  series: "Series",
  anime: "Anime",
  documentary: "Documentary",
  "mini-series": "Mini-series",
};

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

function getTodayInputValue() {
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localNow.toISOString().slice(0, 10);
}

function getEntityLink(entity: SearchEntity) {
  if (entity.type === "movie" || entity.type === "tv") {
    return `/media/${entity.id}?type=${entity.type}`;
  }
  return `/search?q=${encodeURIComponent(entity.title)}&scope=${entity.type}`;
}

function buildDecadeOptions() {
  const decades: number[] = [];
  const currentYear = new Date().getFullYear();
  const start = 1950;
  for (let year = start; year <= currentYear; year += 10) {
    decades.push(year);
  }
  return decades.reverse();
}

function hasAdditionalSearchCriteria(filters: FilterState) {
  return Boolean(
    filters.query.trim() ||
      filters.genres.length ||
      filters.yearMin ||
      filters.yearMax ||
      filters.decade ||
      filters.language ||
      filters.countries.length ||
      filters.runtimeMin ||
      filters.runtimeMax ||
      filters.imdbMin ||
      filters.tmdbMin ||
      filters.voteCountMin ||
      filters.releaseStatus !== "any" ||
      filters.director.length ||
      filters.actor.length ||
      filters.studio.length ||
      filters.keywords.length ||
      filters.franchise.length ||
      filters.awardsOnly
  );
}

function getSearchValidationMessage(filters: FilterState) {
  if (!filters.contentType) {
    return "Select a content type to start searching.";
  }
  if (!hasAdditionalSearchCriteria(filters)) {
    return "Add at least one filter to search.";
  }
  return null;
}

function buildActiveSearchChips(filters: FilterState) {
  const chips: Array<{ key: string; label: string }> = [];

  if (filters.contentType) {
    chips.push({ key: "contentType", label: CONTENT_TYPE_LABELS[filters.contentType] });
  }
  if (filters.query.trim()) {
    chips.push({ key: "query", label: `Search: ${filters.query.trim()}` });
  }
  filters.genres.forEach((genre) => chips.push({ key: `genre-${genre}`, label: `Genre: ${genre}` }));
  if (filters.yearMin) chips.push({ key: "yearMin", label: `Year min: ${filters.yearMin}` });
  if (filters.yearMax) chips.push({ key: "yearMax", label: `Year max: ${filters.yearMax}` });
  if (filters.decade) chips.push({ key: "decade", label: `${filters.decade}s` });
  if (filters.language) chips.push({ key: "language", label: `Language: ${filters.language}` });
  filters.countries.forEach((country) => chips.push({ key: `country-${country}`, label: `Country: ${country}` }));
  if (filters.runtimeMin) chips.push({ key: "runtimeMin", label: `Runtime min: ${filters.runtimeMin}` });
  if (filters.runtimeMax) chips.push({ key: "runtimeMax", label: `Runtime max: ${filters.runtimeMax}` });
  if (filters.imdbMin) chips.push({ key: "imdbMin", label: `IMDb ${filters.imdbMin}+` });
  if (filters.tmdbMin) chips.push({ key: "tmdbMin", label: `TMDb ${filters.tmdbMin}+` });
  if (filters.voteCountMin) chips.push({ key: "voteCountMin", label: `Votes ${filters.voteCountMin}+` });
  if (filters.releaseStatus !== "any") chips.push({ key: "status", label: `Status: ${filters.releaseStatus}` });
  filters.director.forEach((value) => chips.push({ key: `director-${value}`, label: `Director: ${value}` }));
  filters.actor.forEach((value) => chips.push({ key: `actor-${value}`, label: `Actor: ${value}` }));
  filters.studio.forEach((value) => chips.push({ key: `studio-${value}`, label: `Studio: ${value}` }));
  filters.keywords.forEach((value) => chips.push({ key: `keyword-${value}`, label: `Keyword: ${value}` }));
  filters.franchise.forEach((value) => chips.push({ key: `franchise-${value}`, label: `Franchise: ${value}` }));
  if (filters.awardsOnly) chips.push({ key: "awardsOnly", label: "Awards only" });
  if (filters.sort !== "relevance") chips.push({ key: "sort", label: `Sort: ${filters.sort.replace("_", " ")}` });

  return chips;
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsedFilters = useMemo(() => parseFiltersFromParams(searchParams), [searchParams]);
  const searchParamSignature = searchParams.toString();
  const searchFilterSignature = useMemo(() => {
    const parsed = parseFiltersFromParams(searchParams);
    return serializeFiltersToParams(parsed).toString();
  }, [searchParams]);
  const initialFilters = useMemo<FilterState>(
    () => ({
      ...DEFAULT_FILTERS,
      ...parsedFilters,
      types: [],
      contentType: parsedFilters.contentType,
    }),
    [parsedFilters]
  );

  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [page, setPage] = useState(1);
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new Map<string, { ts: number; data: UniversalSearchResponse }>());
  const cacheTtlMs = 2 * 60 * 1000;
  const filterSignature = useMemo(() => serializeFiltersToParams(filters).toString(), [filters]);
  const validationMessage = useMemo(() => getSearchValidationMessage(filters), [filters]);

  useEffect(() => {
    setFilters(initialFilters);
  }, [searchFilterSignature, initialFilters]);

  const inventoryByMediaId = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    inventory.forEach((item) => map.set(item.media_item_id, item));
    return map;
  }, [inventory]);

  const executeSearch = useCallback(async (nextFilters: FilterState, nextPage: number) => {
    const message = getSearchValidationMessage(nextFilters);
    if (message) {
      setErrorMsg(message);
      setGroups([]);
      setHasMore(false);
      return;
    }

    const params = serializeFiltersToParams(nextFilters);
    params.set("page", String(nextPage));
    params.set("include", "imdb");
    params.set("limit", String(PER_GROUP_LIMIT));

    const cacheKey = `${params.toString()}`;
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

    try {
      const response = await fetch(`/api/search/universal?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "Search failed");
      }
      const data = (await response.json()) as UniversalSearchResponse;
      cacheRef.current.set(cacheKey, { ts: Date.now(), data });
      setGroups(data.groups || []);
      setHasMore(data.hasMore);
      const urlParams = serializeFiltersToParams(nextFilters);
      urlParams.set("page", String(nextPage));
      router.push(`/search?${urlParams.toString()}`);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "Search failed";
      setErrorMsg(message);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (page !== 1 && filterSignature !== searchFilterSignature) {
      setPage(1);
      return;
    }

    if (validationMessage) {
      setErrorMsg(validationMessage);
      setGroups([]);
      setHasMore(false);
      return;
    }

    const timer = window.setTimeout(() => {
      void executeSearch(filters, page);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [executeSearch, filterSignature, filters, page, validationMessage]);

  const refreshInventory = useCallback(async () => {
    try {
      const response = await fetch("/api/inventory");
      if (!response.ok) return;
      const data = (await response.json()) as InventoryItem[];
      setInventory(data);
    } catch {
      setInventory([]);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshInventory();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshInventory]);

  const handleAdd = async (
    entity: SearchEntity,
    status: "completed" | "plan_to_watch"
  ) => {
    setErrorMsg(null);
    const id = mediaItemId(entity);
    const key = `${id}-${status}`;
    const existing = inventoryByMediaId.get(id);
    setSavingKeys((prev) => ({ ...prev, [key]: true }));

    try {
      const response = await fetch(existing ? `/api/inventory/${existing.id}` : "/api/inventory", {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: entity.id,
          mediaType: entity.type,
          status,
          watchDates: status === "completed" ? [getTodayInputValue()] : [],
        }),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "Failed to update inventory");
      }
      await refreshInventory();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update inventory";
      setErrorMsg(message);
    } finally {
      setSavingKeys((prev) => ({ ...prev, [key]: false }));
    }
  };

  const visibleGroups = useMemo(() => {
    const selectedType: SearchEntityType | null =
      filters.contentType === "movie" ? "movie" : filters.contentType ? "tv" : null;

    return groups
      .filter((group) => (selectedType ? group.type === selectedType : group.type === "movie" || group.type === "tv"))
      .sort((a, b) => ENTITY_ORDER.indexOf(a.type) - ENTITY_ORDER.indexOf(b.type));
  }, [filters.contentType, groups]);

  const hasResults = visibleGroups.some((group) => group.results.length > 0);
  const activeChips = useMemo(() => buildActiveSearchChips(filters), [filters]);

  const searchLabel = useMemo(() => {
    if (validationMessage) return validationMessage;
    if (loading) return "Scanning TMDb...";
    if (!hasResults) return "No results";
    return `Entities detected: ${visibleGroups.reduce((sum, group) => sum + group.results.length, 0)}`;
  }, [hasResults, loading, validationMessage, visibleGroups]);

  const handleApplyFilters = () => {
    const parsed = parseAdvancedQuery(filters.query);
    const merged = applyQueryClauses({ ...filters, query: parsed.text }, parsed.clauses);
    setFilters(merged);
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ ...DEFAULT_FILTERS, types: [], contentType: undefined });
    setGroups([]);
    setPage(1);
    router.push("/search");
  };

  const decades = useMemo(() => buildDecadeOptions(), []);

  return (
    <div className="min-h-screen w-full bg-[#050608] text-zinc-100 flex flex-col font-sans selection:bg-[oklch(0.70_0.16_195)]/30 selection:text-white pb-10">
      <Navbar transparentOnTop={false} showSearch={false} initialSearchQuery={filters.query} />

      <main className="flex-1 max-w-400 mx-auto w-full px-6 md:px-12 py-10 mt-24 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
        <aside className="glass-panel rounded-3xl p-5 space-y-6 h-fit">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-500">Filters</div>
            <button
              type="button"
              onClick={clearFilters}
              className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-200"
            >
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
                      contentType: option.value,
                      tvSubtype: option.value === "mini-series" ? "mini_series" : "any",
                    }));
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-xs font-semibold transition text-left ${
                    filters.contentType === option.value
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
              {GENRE_OPTIONS.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => {
                    setFilters((prev) => ({
                      ...prev,
                      genres: prev.genres.includes(genre)
                        ? prev.genres.filter((item) => item !== genre)
                        : [...prev.genres, genre],
                    }));
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
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Year Min</div>
              <input
                type="number"
                value={filters.yearMin || ""}
                onChange={(event) => setFilters((prev) => ({ ...prev, yearMin: Number(event.target.value) || undefined }))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
              />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Year Max</div>
              <input
                type="number"
                value={filters.yearMax || ""}
                onChange={(event) => setFilters((prev) => ({ ...prev, yearMax: Number(event.target.value) || undefined }))}
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
                {decades.map((decade) => (
                  <option key={decade} value={decade}>
                    {decade}s
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Language</div>
              <input
                value={filters.language || ""}
                onChange={(event) => setFilters((prev) => ({ ...prev, language: event.target.value || undefined }))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
                placeholder="Korean"
              />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Country</div>
              <input
                value={filters.countries.join(", ")}
                onChange={(event) => setFilters((prev) => ({
                  ...prev,
                  countries: event.target.value
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                }))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
                placeholder="South Korea"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Runtime Min</div>
              <input
                type="number"
                value={filters.runtimeMin || ""}
                onChange={(event) => setFilters((prev) => ({ ...prev, runtimeMin: Number(event.target.value) || undefined }))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
                placeholder="90"
              />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Runtime Max</div>
              <input
                type="number"
                value={filters.runtimeMax || ""}
                onChange={(event) => setFilters((prev) => ({ ...prev, runtimeMax: Number(event.target.value) || undefined }))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
                placeholder="150"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">IMDb Min</div>
              <input
                type="number"
                step="0.1"
                value={filters.imdbMin || ""}
                onChange={(event) => setFilters((prev) => ({ ...prev, imdbMin: Number(event.target.value) || undefined }))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
              />
            </div>
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
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Status</div>
            <select
              value={filters.releaseStatus}
              onChange={(event) => setFilters((prev) => ({ ...prev, releaseStatus: event.target.value as FilterState["releaseStatus"] }))}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
            >
              <option value="any">Any</option>
              <option value="released">Released</option>
              <option value="upcoming">Upcoming</option>
              <option value="airing">Airing</option>
              <option value="ended">Ended</option>
            </select>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-2">Advanced</div>
            <div className="space-y-2">
              <input
                value={filters.director.join(", ")}
                onChange={(event) => setFilters((prev) => ({
                  ...prev,
                  director: event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                }))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
                placeholder="director:nolan"
              />
              <input
                value={filters.actor.join(", ")}
                onChange={(event) => setFilters((prev) => ({
                  ...prev,
                  actor: event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                }))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
                placeholder="actor:jake"
              />
              <input
                value={filters.studio.join(", ")}
                onChange={(event) => setFilters((prev) => ({
                  ...prev,
                  studio: event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                }))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
                placeholder="studio:A24"
              />
              <input
                value={filters.keywords.join(", ")}
                onChange={(event) => setFilters((prev) => ({
                  ...prev,
                  keywords: event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                }))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
                placeholder="keyword:time travel"
              />
              <input
                value={filters.franchise.join(", ")}
                onChange={(event) => setFilters((prev) => ({
                  ...prev,
                  franchise: event.target.value.split(",").map((value) => value.trim()).filter(Boolean),
                }))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200"
                placeholder="franchise:MCU"
              />
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, awardsOnly: !prev.awardsOnly }))}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition ${
                  filters.awardsOnly
                    ? "border-[oklch(0.70_0.16_195)]/40 text-[oklch(0.70_0.16_195)] bg-[oklch(0.70_0.16_195)]/10"
                    : "border-white/10 text-zinc-500 hover:text-zinc-200"
                }`}
              >
                Awards only
                {filters.awardsOnly ? <X className="w-3 h-3" /> : null}
              </button>
            </div>
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
            onClick={handleApplyFilters}
            className="w-full rounded-xl bg-[oklch(0.70_0.16_195)] text-black font-bold py-2 text-sm hover:bg-[oklch(0.75_0.15_195)] transition"
          >
            Apply Filters
          </button>
        </aside>

        <section>
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[oklch(0.70_0.16_195)]/10 border border-[oklch(0.70_0.16_195)]/20 rounded-full text-xs text-[oklch(0.70_0.16_195)] font-semibold mb-4">
              <Search className="w-3.5 h-3.5" />
              <span>Universal Media Search</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-4 leading-tight">
              {filters.contentType ? CONTENT_TYPE_LABELS[filters.contentType] : "Explore everything TMDb knows"}
            </h1>
            <p className="text-zinc-400 text-lg max-w-2xl leading-relaxed">
              {filters.contentType
                ? `Showing only ${CONTENT_TYPE_LABELS[filters.contentType]} results for the selected filter set.`
                : "Search movies, series, people, collections, and keywords from a single command center."}
            </p>
          </div>

          <div className="glass-panel rounded-2xl p-5 mb-8">
            <div className="flex flex-col gap-4">
              <SearchSuggestInput
                key={filters.query}
                initialQuery={filters.query}
                onSearch={(term) => {
                  const next = { ...filters, query: term };
                  setFilters(next);
                  setPage(1);
                }}
                shellClassName="w-full flex items-center gap-3 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 focus-within:border-[oklch(0.70_0.16_195)] focus-within:ring-1 focus-within:ring-[oklch(0.70_0.16_195)] transition-all duration-300"
                inputClassName="flex-1 min-w-0 bg-transparent border-none outline-none text-white placeholder-zinc-500 text-sm"
                placeholder="Search titles, people, collections..."
              />
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 text-xs text-zinc-400">
                  <Filter className="w-3.5 h-3.5" />
                  Filters enabled
                </div>
                <div className="text-xs text-zinc-500">{searchLabel}</div>
              </div>
              {activeChips.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {activeChips.map((chip) => (
                    <span
                      key={chip.key}
                      className="inline-flex items-center rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-semibold text-zinc-300"
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              ) : null}
              {errorMsg && (
                <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
                  {errorMsg}
                </div>
              )}
            </div>
          </div>

          {loading && !hasResults ? (
            <div className="text-sm text-zinc-500">Searching across TMDb...</div>
          ) : null}

          {!loading && !hasResults && filters.query.trim() ? (
            <p className="text-sm text-zinc-500">No matches yet. Try another query.</p>
          ) : null}

          {visibleGroups.map((group) => (
            <section key={group.type} className="mb-12">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                  {group.label}
                </h2>
                <span className="text-xs text-zinc-500">{group.total.toLocaleString()} total</span>
              </div>

              {(group.type === "movie" || group.type === "tv" || group.type === "collection") && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {group.results.map((entity) => {
                    const image = getEntityImage(entity);
                    const isMovieOrTv = entity.type === "movie" || entity.type === "tv";
                    const id = mediaItemId(entity);
                    const existing = inventoryByMediaId.get(id);
                    const isWatchlisted = existing?.status === "plan_to_watch";
                    const isCompleted = existing?.status === "completed";
                    const isSavingWatchlist = savingKeys[`${id}-plan_to_watch`];
                    const isSavingInventory = savingKeys[`${id}-completed`];

                    return (
                      <div key={`${entity.type}-${entity.id}`} className="group/card relative flex flex-col gap-3">
                        <Link href={getEntityLink(entity)}>
                          <div className="aspect-2/3 w-full rounded-2xl overflow-hidden bg-[#11131a] border border-white/5 relative transition-all duration-300 group-hover/card:scale-105 group-hover/card:shadow-[0_8px_30px_rgba(0,0,0,0.5)] group-hover/card:z-10 group-hover/card:border-white/20">
                            {image ? (
                              <Image
                                src={image}
                                alt={entity.title}
                                fill
                                sizes="(max-width: 1024px) 40vw, 200px"
                                className="object-cover transition-transform duration-500 group-hover/card:scale-110 opacity-90 group-hover/card:opacity-100"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-zinc-700 font-semibold">NO ART</div>
                            )}
                            <div className="absolute top-2 left-2 right-2 flex justify-between z-20">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase backdrop-blur-md bg-black/60 border border-white/10 text-white shadow-sm">
                                {entity.type === "collection" ? "COLLECTION" : entity.type === "movie" ? "MOVIE" : "SERIES"}
                              </span>
                            </div>
                            {isMovieOrTv && (
                              <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 pointer-events-none">
                                <p className="text-white font-bold text-sm line-clamp-2 leading-tight drop-shadow-md">{entity.title}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs font-bold text-amber-400 drop-shadow-md">★ {entity.rating || "--"}</span>
                                  <span className="text-xs font-medium text-zinc-300 drop-shadow-md">{entity.year || "--"}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </Link>
                        <div className="flex items-center justify-between px-1 gap-2">
                          <h3 className="text-sm font-semibold text-white leading-tight line-clamp-1 group-hover/card:text-[oklch(0.70_0.16_195)] transition">
                            {entity.title}
                          </h3>
                          {isMovieOrTv && (
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleAdd(entity, "plan_to_watch");
                                }}
                                disabled={isSavingWatchlist}
                                className={`p-1.5 rounded-lg border transition-all z-20 ${
                                  isWatchlisted
                                    ? "border-[oklch(0.78_0.14_75)]/40 text-[oklch(0.78_0.14_75)] bg-[oklch(0.78_0.14_75)]/10"
                                    : "border-white/10 text-zinc-300 hover:border-[oklch(0.78_0.14_75)]/50 hover:text-[oklch(0.78_0.14_75)] bg-black/40 hover:bg-[oklch(0.78_0.14_75)]/10"
                                }`}
                                title={isWatchlisted ? "In Watchlist" : "Add to Watchlist"}
                              >
                                {isWatchlisted ? <CheckCircle2 className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleAdd(entity, "completed");
                                }}
                                disabled={isSavingInventory}
                                className={`p-1.5 rounded-lg border transition-all z-20 ${
                                  isCompleted
                                    ? "border-[oklch(0.75_0.15_140)]/40 text-[oklch(0.75_0.15_140)] bg-[oklch(0.75_0.15_140)]/10"
                                    : "border-white/10 text-zinc-300 hover:border-[oklch(0.75_0.15_140)]/50 hover:text-[oklch(0.75_0.15_140)] bg-black/40 hover:bg-[oklch(0.75_0.15_140)]/10"
                                }`}
                                title={isCompleted ? "In Inventory" : "Add to Inventory"}
                              >
                                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {group.type === "person" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.results.map((entity) => {
                    const image = getEntityImage(entity);
                    return (
                      <div
                        key={`${entity.type}-${entity.id}`}
                        className="flex gap-4 rounded-2xl border border-white/10 bg-black/30 p-4"
                      >
                        <div className="h-20 w-16 rounded-xl overflow-hidden bg-black/40 border border-white/10 relative">
                          {image ? (
                            <Image src={image} alt={entity.title} fill sizes="80px" className="object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-zinc-600">
                              <Users className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white truncate">{entity.title}</div>
                          <div className="text-xs text-zinc-500 mt-1">
                            {entity.role || "Person"}
                          </div>
                          {entity.knownFor?.length ? (
                            <div className="text-xs text-zinc-400 mt-2 truncate">
                              Known for: {entity.knownFor.join(", ")}
                            </div>
                          ) : null}
                          <a
                            href={`https://www.themoviedb.org/person/${entity.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex text-xs font-semibold text-[oklch(0.70_0.16_195)] hover:text-[oklch(0.78_0.14_195)]"
                          >
                            View Full Filmography
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {(group.type === "keyword" || group.type === "company" || group.type === "network") && (
                <div className="flex flex-wrap gap-2">
                  {group.results.map((entity) => (
                    <Link
                      key={`${entity.type}-${entity.id}`}
                      href={getEntityLink(entity)}
                      className="px-3 py-1 rounded-full text-xs border border-white/10 bg-black/30 text-zinc-300 hover:text-white hover:border-white/20 transition"
                    >
                      {entity.title}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}

          <div className="mt-8 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => {
                const nextPage = Math.max(1, page - 1);
                setPage(nextPage);
                void executeSearch(filters, nextPage);
              }}
              disabled={page <= 1}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent transition"
            >
              Previous
            </button>
            <div className="text-sm text-zinc-500">Page {page}</div>
            <button
              type="button"
              onClick={() => {
                const nextPage = page + 1;
                setPage(nextPage);
                void executeSearch(filters, nextPage);
              }}
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

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080a0f]" />}>
      <SearchContent />
    </Suspense>
  );
}
