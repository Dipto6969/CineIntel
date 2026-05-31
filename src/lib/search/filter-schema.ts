import type { MediaType } from "@/types/media";

export type ReleaseStatus = "released" | "upcoming" | "airing" | "ended" | "any";
export type SortMode = "relevance" | "popularity" | "release_date" | "rating" | "runtime" | "title";
export type InventorySortMode = "personal_rating" | "recently_added" | "favorites";
export type ContentType = "movie" | "series" | "anime" | "documentary" | "mini-series";

export type FilterState = {
  query: string;
  contentType?: ContentType;
  types: MediaType[];
  genres: string[];
  yearMin?: number;
  yearMax?: number;
  decade?: number;
  language?: string;
  countries: string[];
  runtimeMin?: number;
  runtimeMax?: number;
  imdbMin?: number;
  tmdbMin?: number;
  voteCountMin?: number;
  releaseStatus: ReleaseStatus;
  tvSubtype: "any" | "mini_series";
  sort: SortMode;
  director: string[];
  actor: string[];
  studio: string[];
  keywords: string[];
  franchise: string[];
  awardsOnly: boolean;
  personalRatingMin?: number;
  favoritesOnly: boolean;
  inventorySort: InventorySortMode;
};

export const DEFAULT_FILTERS: FilterState = {
  query: "",
  contentType: undefined,
  types: ["movie", "tv"],
  genres: [],
  countries: [],
  releaseStatus: "any",
  tvSubtype: "any",
  sort: "relevance",
  director: [],
  actor: [],
  studio: [],
  keywords: [],
  franchise: [],
  awardsOnly: false,
  favoritesOnly: false,
  inventorySort: "recently_added",
};

export function parseNumber(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseList(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function serializeList(values: string[]) {
  return values.length ? values.join(",") : undefined;
}

export function parseFiltersFromParams(params: URLSearchParams): FilterState {
  return {
    ...DEFAULT_FILTERS,
    query: params.get("q") || "",
    contentType: (params.get("contentType") as ContentType) || undefined,
    types: (parseList(params.get("types")) as MediaType[]) || DEFAULT_FILTERS.types,
    genres: parseList(params.get("genres")),
    yearMin: parseNumber(params.get("yearMin")),
    yearMax: parseNumber(params.get("yearMax")),
    decade: parseNumber(params.get("decade")),
    language: params.get("language") || undefined,
    countries: parseList(params.get("countries")),
    runtimeMin: parseNumber(params.get("runtimeMin")),
    runtimeMax: parseNumber(params.get("runtimeMax")),
    imdbMin: parseNumber(params.get("imdbMin")),
    tmdbMin: parseNumber(params.get("tmdbMin")),
    voteCountMin: parseNumber(params.get("voteCountMin")),
    releaseStatus: (params.get("status") as ReleaseStatus) || "any",
    tvSubtype: (params.get("tvSubtype") as "any" | "mini_series") || "any",
    sort: (params.get("sort") as SortMode) || "relevance",
    director: parseList(params.get("director")),
    actor: parseList(params.get("actor")),
    studio: parseList(params.get("studio")),
    keywords: parseList(params.get("keywords")),
    franchise: parseList(params.get("franchise")),
    awardsOnly: params.get("awardsOnly") === "true",
    personalRatingMin: parseNumber(params.get("personalRatingMin")),
    favoritesOnly: params.get("favoritesOnly") === "true",
    inventorySort: (params.get("inventorySort") as InventorySortMode) || "recently_added",
  };
}

// Map friendly alias genres (anime, documentary) to canonical genre names
const GENRE_ALIAS_MAP: Record<string, string[]> = {
  anime: ["Animation"],
  animation: ["Animation"],
  documentary: ["Documentary"],
  doc: ["Documentary"],
};

export function normalizeGenres(genres: string[]) {
  const out = new Set<string>();
  for (const g of genres) {
    const key = g.trim().toLowerCase();
    if (!key) continue;
    if (GENRE_ALIAS_MAP[key]) {
      for (const mapped of GENRE_ALIAS_MAP[key]) out.add(mapped);
    } else {
      // preserve original casing for user-provided genres
      out.add(g);
    }
  }
  return Array.from(out);
}

export function normalizeFilterState(filters: FilterState): FilterState {
  return {
    ...filters,
    genres: normalizeGenres(filters.genres || []),
  };
}

export function serializeFiltersToParams(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.contentType) params.set("contentType", filters.contentType);
  const types = serializeList(filters.types);
  if (types) params.set("types", types);
  const genres = serializeList(filters.genres);
  if (genres) params.set("genres", genres);
  if (filters.yearMin) params.set("yearMin", String(filters.yearMin));
  if (filters.yearMax) params.set("yearMax", String(filters.yearMax));
  if (filters.decade) params.set("decade", String(filters.decade));
  if (filters.language) params.set("language", filters.language);
  const countries = serializeList(filters.countries);
  if (countries) params.set("countries", countries);
  if (filters.runtimeMin) params.set("runtimeMin", String(filters.runtimeMin));
  if (filters.runtimeMax) params.set("runtimeMax", String(filters.runtimeMax));
  if (filters.imdbMin) params.set("imdbMin", String(filters.imdbMin));
  if (filters.tmdbMin) params.set("tmdbMin", String(filters.tmdbMin));
  if (filters.voteCountMin) params.set("voteCountMin", String(filters.voteCountMin));
  if (filters.releaseStatus !== "any") params.set("status", filters.releaseStatus);
  if (filters.tvSubtype !== "any") params.set("tvSubtype", filters.tvSubtype);
  if (filters.sort !== "relevance") params.set("sort", filters.sort);
  const director = serializeList(filters.director);
  if (director) params.set("director", director);
  const actor = serializeList(filters.actor);
  if (actor) params.set("actor", actor);
  const studio = serializeList(filters.studio);
  if (studio) params.set("studio", studio);
  const keywords = serializeList(filters.keywords);
  if (keywords) params.set("keywords", keywords);
  const franchise = serializeList(filters.franchise);
  if (franchise) params.set("franchise", franchise);
  if (filters.awardsOnly) params.set("awardsOnly", "true");
  if (filters.personalRatingMin) params.set("personalRatingMin", String(filters.personalRatingMin));
  if (filters.favoritesOnly) params.set("favoritesOnly", "true");
  if (filters.inventorySort !== "recently_added") params.set("inventorySort", filters.inventorySort);
  return params;
}
