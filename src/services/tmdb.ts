// ========================================
// CineIntel TMDb API Service Wrapper
// ========================================

import type {
  TMDbSearchResult,
  TMDbMovieDetail,
  TMDbTVDetail,
  MediaType,
} from "@/types/media";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

function getHeaders(): HeadersInit {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token || token === "your-tmdb-read-access-token") {
    throw new Error(
      "TMDB_READ_ACCESS_TOKEN is not configured. Add it to your .env.local file."
    );
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function tmdbFetch<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    headers: getHeaders(),
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `TMDb API error: ${response.status} ${response.statusText} - ${errorBody}`
    );
  }

  return response.json() as Promise<T>;
}

// ---- Search ----

interface TMDbSearchResponse {
  page: number;
  results: TMDbSearchResult[];
  total_pages: number;
  total_results: number;
}

interface TMDbPersonSearchResponse {
  page: number;
  results: {
    id: number;
    name: string;
    profile_path: string | null;
    known_for_department: string | null;
    popularity: number | null;
    known_for?: Array<{
      id: number;
      media_type: "movie" | "tv";
      title?: string;
      name?: string;
      release_date?: string;
      first_air_date?: string;
    }>;
  }[];
  total_pages: number;
  total_results: number;
}

interface TMDbCollectionSearchResponse {
  page: number;
  results: {
    id: number;
    name: string;
    poster_path: string | null;
    backdrop_path: string | null;
  }[];
  total_pages: number;
  total_results: number;
}

interface TMDbKeywordSearchResponse {
  page: number;
  results: {
    id: number;
    name: string;
  }[];
  total_pages: number;
  total_results: number;
}

interface TMDbCompanySearchResponse {
  page: number;
  results: {
    id: number;
    name: string;
    logo_path: string | null;
    origin_country: string | null;
  }[];
  total_pages: number;
  total_results: number;
}

interface TMDbNetworkSearchResponse {
  page: number;
  results: {
    id: number;
    name: string;
    logo_path: string | null;
    origin_country: string | null;
  }[];
  total_pages: number;
  total_results: number;
}

export async function searchMulti(
  query: string,
  page: number = 1
): Promise<TMDbSearchResponse> {
  const data = await tmdbFetch<TMDbSearchResponse>("/search/multi", {
    query,
    page: String(page),
    include_adult: "false",
    language: "en-US",
  });

  // Filter to only movies and TV shows
  data.results = data.results.filter(
    (item) => item.media_type === "movie" || item.media_type === "tv"
  );

  return data;
}

export async function searchMovies(
  query: string,
  page: number = 1
): Promise<TMDbSearchResponse> {
  const data = await tmdbFetch<TMDbSearchResponse>("/search/movie", {
    query,
    page: String(page),
    include_adult: "false",
    language: "en-US",
  });

  // Tag all results as movies
  data.results = data.results.map((item) => ({
    ...item,
    media_type: "movie" as MediaType,
  }));

  return data;
}

export async function searchTV(
  query: string,
  page: number = 1
): Promise<TMDbSearchResponse> {
  const data = await tmdbFetch<TMDbSearchResponse>("/search/tv", {
    query,
    page: String(page),
    include_adult: "false",
    language: "en-US",
  });

  // Tag all results as tv
  data.results = data.results.map((item) => ({
    ...item,
    media_type: "tv" as MediaType,
  }));

  return data;
}

export async function searchPeople(
  query: string,
  page: number = 1
): Promise<TMDbPersonSearchResponse> {
  return tmdbFetch<TMDbPersonSearchResponse>("/search/person", {
    query,
    page: String(page),
    include_adult: "false",
    language: "en-US",
  });
}

export async function searchCollections(
  query: string,
  page: number = 1
): Promise<TMDbCollectionSearchResponse> {
  return tmdbFetch<TMDbCollectionSearchResponse>("/search/collection", {
    query,
    page: String(page),
    language: "en-US",
  });
}

export async function searchKeywords(
  query: string,
  page: number = 1
): Promise<TMDbKeywordSearchResponse> {
  return tmdbFetch<TMDbKeywordSearchResponse>("/search/keyword", {
    query,
    page: String(page),
  });
}

export async function searchCompanies(
  query: string,
  page: number = 1
): Promise<TMDbCompanySearchResponse> {
  return tmdbFetch<TMDbCompanySearchResponse>("/search/company", {
    query,
    page: String(page),
  });
}

export async function searchNetworks(
  query: string,
  page: number = 1
): Promise<TMDbNetworkSearchResponse> {
  return tmdbFetch<TMDbNetworkSearchResponse>("/search/network", {
    query,
    page: String(page),
  });
}

// ---- Details ----

export async function getMovieDetails(movieId: number): Promise<TMDbMovieDetail> {
  return tmdbFetch<TMDbMovieDetail>(`/movie/${movieId}`, {
    append_to_response: "credits,keywords,alternative_titles,recommendations,watch/providers,external_ids",
    language: "en-US",
  });
}

export async function getTVDetails(tvId: number): Promise<TMDbTVDetail> {
  return tmdbFetch<TMDbTVDetail>(`/tv/${tvId}`, {
    append_to_response: "credits,keywords,alternative_titles,recommendations,watch/providers,external_ids",
    language: "en-US",
  });
}

// ---- External IDs ----

type TMDbExternalIdsResponse = {
  imdb_id: string | null;
};

export async function getExternalIds(
  mediaType: MediaType,
  id: number
): Promise<TMDbExternalIdsResponse> {
  const endpoint = mediaType === "movie" ? `/movie/${id}/external_ids` : `/tv/${id}/external_ids`;
  return tmdbFetch<TMDbExternalIdsResponse>(endpoint);
}

// ---- Trending ----

interface TMDbTrendingResponse {
  page: number;
  results: TMDbSearchResult[];
  total_pages: number;
  total_results: number;
}

export async function getTrending(
  timeWindow: "day" | "week" = "day",
  page: number = 1
): Promise<TMDbTrendingResponse> {
  const data = await tmdbFetch<TMDbTrendingResponse>(
    `/trending/all/${timeWindow}`,
    { page: String(page), language: "en-US" }
  );

  // Filter to movies and TV
  data.results = data.results.filter(
    (item) => item.media_type === "movie" || item.media_type === "tv"
  );

  return data;
}

export async function getPopularMovies(page: number = 1): Promise<TMDbSearchResponse> {
  const data = await tmdbFetch<TMDbSearchResponse>("/movie/popular", {
    page: String(page),
    language: "en-US",
  });

  data.results = data.results.map((item) => ({
    ...item,
    media_type: "movie" as MediaType,
  }));

  return data;
}

// ---- Discovery ----

export async function discoverMovies(
  params: Record<string, string> = {}
): Promise<TMDbSearchResponse> {
  const data = await tmdbFetch<TMDbSearchResponse>("/discover/movie", {
    include_adult: "false",
    language: "en-US",
    sort_by: "popularity.desc",
    ...params,
  });

  data.results = data.results.map((item) => ({
    ...item,
    media_type: "movie" as MediaType,
  }));

  return data;
}

export async function discoverTV(
  params: Record<string, string> = {}
): Promise<TMDbSearchResponse> {
  const data = await tmdbFetch<TMDbSearchResponse>("/discover/tv", {
    include_adult: "false",
    language: "en-US",
    sort_by: "popularity.desc",
    ...params,
  });

  data.results = data.results.map((item) => ({
    ...item,
    media_type: "tv" as MediaType,
  }));

  return data;
}

// ---- Image Helpers ----

export function posterUrl(path: string | null, size: "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "original" = "w342"): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function backdropUrl(path: string | null, size: "w300" | "w780" | "w1280" | "original" = "w1280"): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function profileUrl(path: string | null, size: "w45" | "w185" | "h632" | "original" = "w185"): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
