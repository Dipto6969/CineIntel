import type { FilterState } from "@/lib/search/filter-schema";

export type DiscoverySectionKey =
  | "trending"
  | "popular-movies"
  | "must-watch-series"
  | "critically-acclaimed";

export type DiscoveryPreset = {
  key: DiscoverySectionKey;
  title: string;
  description: string;
  exploreHref: string;
  previewLimit: number;
  buildPreviewFilters: () => Record<string, string>;
  buildDefaultFilters: () => Partial<FilterState>;
};

function buildHref(section: DiscoverySectionKey, params: Record<string, string>) {
  const searchParams = new URLSearchParams({ section, ...params });
  return `/discover?${searchParams.toString()}`;
}

export const DISCOVERY_PRESETS: Record<DiscoverySectionKey, DiscoveryPreset> = {
  trending: {
    key: "trending",
    title: "Trending Right Now",
    description: "The most talked-about movies and series currently gaining attention.",
    exploreHref: buildHref("trending", { type: "all" }),
    previewLimit: 7,
    buildPreviewFilters: () => ({}),
    buildDefaultFilters: () => ({
      sort: "popularity",
      types: ["movie", "tv"],
    }),
  },
  "popular-movies": {
    key: "popular-movies",
    title: "Popular Movies",
    description: "Movies currently popular among audiences worldwide.",
    exploreHref: buildHref("popular-movies", { type: "movie" }),
    previewLimit: 7,
    buildPreviewFilters: () => ({}),
    buildDefaultFilters: () => ({
      contentType: "movie",
      types: ["movie"],
      sort: "popularity",
    }),
  },
  "must-watch-series": {
    key: "must-watch-series",
    title: "Must Watch Series",
    description: "Highly recommended television series with strong audience reception.",
    exploreHref: buildHref("must-watch-series", { type: "series" }),
    previewLimit: 7,
    buildPreviewFilters: () => ({
      withVoteAverageGte: "8",
      withVoteCountGte: "1000",
    }),
    buildDefaultFilters: () => ({
      contentType: "series",
      types: ["tv"],
      tmdbMin: 8,
      voteCountMin: 1000,
      sort: "rating",
    }),
  },
  "critically-acclaimed": {
    key: "critically-acclaimed",
    title: "Highly Rated & Critically Acclaimed",
    description: "Exceptional titles recognized for outstanding quality and audience appreciation.",
    exploreHref: buildHref("critically-acclaimed", {}),
    previewLimit: 7,
    buildPreviewFilters: () => ({
      withVoteAverageGte: "8",
      withVoteCountGte: "5000",
    }),
    buildDefaultFilters: () => ({
      types: ["movie", "tv"],
      tmdbMin: 8,
      voteCountMin: 5000,
      sort: "rating",
    }),
  },
};

export const DISCOVERY_SECTION_ORDER: DiscoverySectionKey[] = [
  "trending",
  "popular-movies",
  "must-watch-series",
  "critically-acclaimed",
];

export function getDiscoveryPreset(section?: string | null) {
  return section && section in DISCOVERY_PRESETS
    ? DISCOVERY_PRESETS[section as DiscoverySectionKey]
    : DISCOVERY_PRESETS.trending;
}

export function buildDiscoveryPresetFilters(section?: string | null) {
  return getDiscoveryPreset(section).buildDefaultFilters();
}
