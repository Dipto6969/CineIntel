// ========================================
// CineIntel Media Type Definitions
// ========================================

export type MediaType = "movie" | "tv";

export type WatchStatus = "completed" | "dropped" | "on_hold" | "plan_to_watch";

// --- TMDb API Response Types ---

export interface TMDbSearchResult {
  id: number;
  media_type: MediaType;
  title?: string; // movie
  name?: string; // tv
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string; // movie
  first_air_date?: string; // tv
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  original_language: string;
}

export interface TMDbMovieDetail {
  id: number;
  imdb_id: string | null;
  belongs_to_collection?: { id: number; name: string } | null;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number;
  genres: { id: number; name: string }[];
  production_companies: { id: number; name: string; logo_path: string | null; origin_country: string }[];
  production_countries: { iso_3166_1: string; name: string }[];
  spoken_languages: { iso_639_1: string; english_name: string; name: string }[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  status: string;
  tagline: string;
  budget: number;
  revenue: number;
  credits?: {
    cast: TMDbCastMember[];
    crew: TMDbCrewMember[];
  };
  keywords?: {
    keywords: { id: number; name: string }[];
  };
  alternative_titles?: {
    titles: { iso_3166_1: string; title: string; type: string }[];
  };
  recommendations?: {
    results: TMDbSearchResult[];
  };
  "watch/providers"?: {
    results: Record<string, TMDbWatchProvider>;
  };
  external_ids?: TMDbExternalIds;
}

export interface TMDbTVDetail {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  last_air_date: string;
  episode_run_time: number[];
  number_of_seasons: number;
  number_of_episodes: number;
  genres: { id: number; name: string }[];
  production_companies: { id: number; name: string; logo_path: string | null; origin_country: string }[];
  production_countries: { iso_3166_1: string; name: string }[];
  spoken_languages: { iso_639_1: string; english_name: string; name: string }[];
  vote_average: number;
  vote_count: number;
  popularity: number;
  status: string;
  tagline: string;
  type: string;
  credits?: {
    cast: TMDbCastMember[];
    crew: TMDbCrewMember[];
  };
  keywords?: {
    results: { id: number; name: string }[];
  };
  alternative_titles?: {
    results: { iso_3166_1: string; title: string; type: string }[];
  };
  recommendations?: {
    results: TMDbSearchResult[];
  };
  "watch/providers"?: {
    results: Record<string, TMDbWatchProvider>;
  };
  external_ids?: TMDbExternalIds;
}

export interface TMDbExternalIds {
  imdb_id: string | null;
  freebase_mid?: string | null;
  freebase_id?: string | null;
  tvdb_id?: number | null;
  tvrage_id?: number | null;
  wikidata_id?: string | null;
  facebook_id?: string | null;
  instagram_id?: string | null;
  twitter_id?: string | null;
}

export interface TMDbCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TMDbCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDbWatchProvider {
  link: string;
  flatrate?: { provider_name: string; logo_path: string; provider_id: number }[];
  rent?: { provider_name: string; logo_path: string; provider_id: number }[];
  buy?: { provider_name: string; logo_path: string; provider_id: number }[];
}

// --- CineIntel Internal Types ---

export interface MediaItem {
  id: string; // Format: '{tmdb_id}_{media_type}'
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  original_title: string | null;
  alternative_titles: { iso: string; title: string }[];
  release_date: string | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: string[];
  languages: string[];
  countries: string[];
  runtime: number | null;
  popularity: number | null;
  vote_average: number | null;
  cast_list: string[];
  directors: string[];
  studios: string[];
  created_at: string;
}

export interface UserInventoryItem {
  id: string;
  user_id: string;
  media_item_id: string;
  status: WatchStatus;
  rating: number | null;
  watch_dates: string[];
  rewatch_count: number;
  notes: string | null;
  review: string | null;
  language_watched_in: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  media_item?: MediaItem;
  tags?: Tag[];
}

export interface Tag {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

export interface UserList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

// --- Normalized Display Types ---

export interface NormalizedMedia {
  id: number;
  mediaType: MediaType;
  title: string;
  originalTitle: string;
  overview: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string;
  year: string;
  voteAverage: number;
  popularity: number;
  genreIds: number[];
}

export function normalizeSearchResult(item: TMDbSearchResult): NormalizedMedia {
  const isMovie = item.media_type === "movie";
  const title = isMovie ? item.title! : item.name!;
  const originalTitle = isMovie ? item.original_title! : item.original_name!;
  const releaseDate = isMovie ? item.release_date || "" : item.first_air_date || "";

  return {
    id: item.id,
    mediaType: item.media_type,
    title,
    originalTitle,
    overview: item.overview,
    posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
    releaseDate,
    year: releaseDate ? releaseDate.substring(0, 4) : "",
    voteAverage: Math.round(item.vote_average * 10) / 10,
    popularity: item.popularity,
    genreIds: item.genre_ids,
  };
}

// --- Genre Map ---

export const GENRE_MAP: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  // TV genres
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};
