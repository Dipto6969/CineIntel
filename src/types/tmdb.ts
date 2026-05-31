export interface TMDbSearchResult {
  id: number;
  media_type: "movie" | "tv";
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  genre_ids?: number[];
  imdb_rating?: string | null;
  imdb_votes?: string | null;
}

export interface TMDbSearchResponse {
  results: TMDbSearchResult[];
  total_results: number;
  page: number;
  total_pages: number;
}
