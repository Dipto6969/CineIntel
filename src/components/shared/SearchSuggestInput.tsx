"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Search, Star } from "lucide-react";

type SearchEntityType = "movie" | "tv" | "person" | "collection";

type SearchEntity = {
  id: number;
  title: string;
  type: SearchEntityType;
  year?: string | null;
  rating?: number | null;
  imagePath?: string | null;
  posterPath?: string | null;
  profilePath?: string | null;
  backdropPath?: string | null;
  subtitle?: string | null;
};

type SearchGroup = {
  type: SearchEntityType;
  label: string;
  results: SearchEntity[];
};

type UniversalSearchResponse = {
  groups?: SearchGroup[];
};

type SearchSuggestInputProps = {
  initialQuery?: string;
  compact?: boolean;
  shellClassName?: string;
  inputClassName?: string;
  placeholder?: string;
  dropdownPlacement?: "below" | "above";
  onSearch?: (query: string) => void;
};

function getEntityImage(entity: SearchEntity) {
  const path = entity.posterPath || entity.profilePath || entity.backdropPath || entity.imagePath;
  return path ? `https://image.tmdb.org/t/p/w185${path}` : null;
}

function getEntityMeta(entity: SearchEntity) {
  if (entity.type === "movie" || entity.type === "tv") {
    return [entity.type === "movie" ? "Movie" : "Series", entity.year || "--"].join(" · ");
  }
  return entity.subtitle || "";
}

export function SearchSuggestInput({
  initialQuery = "",
  compact = false,
  shellClassName = "",
  inputClassName = "",
  placeholder = "Search movies, series, actors, genres...",
  dropdownPlacement = "below",
  onSearch,
}: SearchSuggestInputProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [activePage, setActivePage] = useState(0);
  const [activeType, setActiveType] = useState<SearchEntityType>("movie");
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new Map<string, { ts: number; data: UniversalSearchResponse }>());
  const cacheTtlMs = 2 * 60 * 1000;

  const suggestionPageSize = useMemo(() => (compact ? 6 : 7), [compact]);
  const perGroupLimit = useMemo(() => suggestionPageSize * 3, [suggestionPageSize]);
  const skeletonCount = useMemo(() => (compact ? 3 : 4), [compact]);
  const visibleTypes: SearchEntityType[] = ["movie", "tv", "person", "collection"];

  const filteredGroups = useMemo(
    () => groups.filter((group) => visibleTypes.includes(group.type)),
    [groups]
  );

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      const timer = window.setTimeout(() => {
        setGroups([]);
        setIsSuggesting(false);
        setIsOpen(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const cacheKey = `${trimmed.toLowerCase()}::${perGroupLimit}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.ts < cacheTtlMs) {
      setGroups(cached.data.groups || []);
      setIsSuggesting(false);
      setIsOpen(true);
      return;
    }

    setIsSuggesting(true);
    setIsOpen(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search/universal?q=${encodeURIComponent(trimmed)}&include=imdb&limit=${perGroupLimit}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error("Suggestion search failed");
        const data = (await response.json()) as UniversalSearchResponse;
        cacheRef.current.set(cacheKey, { ts: Date.now(), data });
        setGroups(data.groups || []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setGroups([]);
      } finally {
        setIsSuggesting(false);
      }
    }, 240);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, perGroupLimit]);

  useEffect(() => {
    setActiveIndex(-1);
    setActivePage(0);
  }, [groups, activeType, query]);

  useEffect(() => {
    const activeGroupExists = filteredGroups.some((group) => group.type === activeType && group.results.length > 0);
    if (!activeGroupExists) {
      const firstAvailable = filteredGroups.find((group) => group.results.length > 0);
      if (firstAvailable) {
        setActiveType(firstAvailable.type);
      }
    }
  }, [activeType, filteredGroups]);

  const activeGroup = filteredGroups.find((group) => group.type === activeType);
  const activeGroupResults = activeGroup?.results || [];
  const pageCount = Math.max(1, Math.ceil(activeGroupResults.length / suggestionPageSize));
  const visibleResults = activeGroupResults.slice(
    activePage * suggestionPageSize,
    activePage * suggestionPageSize + suggestionPageSize
  );

  useEffect(() => {
    if (activePage > pageCount - 1) {
      setActivePage(Math.max(0, pageCount - 1));
    }
  }, [activePage, pageCount]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const goToEntity = (entity: SearchEntity) => {
    setIsOpen(false);
    if (entity.type === "movie" || entity.type === "tv") {
      router.push(`/media/${entity.id}?type=${entity.type}`);
      return;
    }
    router.push(`/search?q=${encodeURIComponent(entity.title)}&scope=${entity.type}`);
  };

  const submitSearch = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setIsOpen(false);
    setActiveIndex(-1);
    setActivePage(0);
    if (onSearch) {
      onSearch(trimmed);
      return;
    }
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitSearch();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || visibleResults.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % visibleResults.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? visibleResults.length - 1 : current - 1));
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      goToEntity(visibleResults[activeIndex]);
    }
    if (event.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative w-full">
      <form onSubmit={handleSubmit} className={shellClassName}>
        <Search className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors shrink-0" />
        <input
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            setActiveIndex(-1);
            setActivePage(0);
            if (value.trim().length >= 2) {
              setIsSuggesting(true);
              setIsOpen(true);
            } else {
              setGroups([]);
              setIsSuggesting(false);
              setIsOpen(false);
            }
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setIsOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 140);
          }}
          onKeyDown={handleKeyDown}
          className={inputClassName}
          placeholder={placeholder}
        />
        <button
          type="submit"
          className={`shrink-0 rounded-full bg-[oklch(0.70_0.16_195)] text-black font-bold hover:bg-[oklch(0.75_0.15_195)] transition active:scale-95 ${
            compact ? "px-2.5 sm:px-3 py-1.5 text-xs" : "px-3 sm:px-4 py-2 text-sm"
          }`}
        >
          <span className="hidden sm:inline">Search</span>
          <span className="sm:hidden">Go</span>
        </button>
      </form>

      {isOpen && (
        <div
          className={`absolute left-0 right-0 isolate overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d12] shadow-[0_24px_60px_rgba(0,0,0,0.65)] z-120 ${
            dropdownPlacement === "above" ? "bottom-full mb-3" : "top-full mt-3"
          }`}
        >
          {isSuggesting ? (
            <div className="p-2 space-y-1">
              {Array.from({ length: skeletonCount }).map((_, index) => (
                <div key={index} className="flex items-center gap-3 rounded-xl px-3 py-2">
                  <div className="h-14 w-10 rounded-lg bg-white/10 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 rounded-full bg-white/10 animate-pulse" />
                    <div className="h-2 w-1/3 rounded-full bg-white/5 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : activeGroup ? (
            <div className="p-2">
              <div className="flex flex-wrap items-center gap-2 px-2 pt-2 pb-3 border-b border-white/5">
                {filteredGroups
                  .filter((group) => group.results.length > 0)
                  .map((group) => (
                    <button
                      key={group.type}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setActiveType(group.type);
                        setActiveIndex(-1);
                        setActivePage(0);
                      }}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.2em] border transition ${
                        activeType === group.type
                          ? "border-[oklch(0.70_0.16_195)]/40 text-[oklch(0.70_0.16_195)] bg-[oklch(0.70_0.16_195)]/10"
                          : "border-white/10 text-zinc-500 hover:text-zinc-200"
                      }`}
                    >
                      {group.label}
                    </button>
                  ))}
              </div>

              <div className="pt-2">
                {visibleResults.map((entity, index) => {
                  const image = getEntityImage(entity);
                  const isActive = index === activeIndex;
                  const meta = getEntityMeta(entity);

                  return (
                    <button
                      type="button"
                      key={`${entity.type}-${entity.id}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => goToEntity(entity)}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                        isActive ? "bg-white/12" : "hover:bg-white/8"
                      }`}
                    >
                      <div className="h-14 w-10 rounded-lg bg-black/40 border border-white/10 overflow-hidden shrink-0 relative">
                        {image ? (
                          <Image src={image} alt="" fill sizes="40px" unoptimized className="object-cover" />
                        ) : (
                          <div className="h-full w-full" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-bold text-white">{entity.title}</div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-500">
                          {meta ? <span className="truncate">{meta}</span> : null}
                          {(entity.type === "movie" || entity.type === "tv") && (
                            <span className="inline-flex items-center gap-1 text-amber-300">
                              <Star className="w-3 h-3 fill-current" />
                              {entity.rating || "--"}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {pageCount > 1 ? (
                  <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-white/5 text-[11px] text-zinc-500">
                    <span>
                      Page {activePage + 1} of {pageCount}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setActivePage((current) => Math.max(0, current - 1));
                          setActiveIndex(-1);
                        }}
                        disabled={activePage === 0}
                        className="rounded-lg border border-white/10 px-2.5 py-1 text-zinc-300 disabled:opacity-40 disabled:hover:bg-transparent hover:bg-white/5 transition"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setActivePage((current) => Math.min(pageCount - 1, current + 1));
                          setActiveIndex(-1);
                        }}
                        disabled={activePage >= pageCount - 1}
                        className="rounded-lg border border-white/10 px-2.5 py-1 text-zinc-300 disabled:opacity-40 disabled:hover:bg-transparent hover:bg-white/5 transition"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="px-4 py-4 text-sm text-zinc-500">No quick matches yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
