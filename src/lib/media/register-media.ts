import { getMovieDetails, getTVDetails } from "@/services/tmdb";
import type { MediaType, TMDbMovieDetail, TMDbTVDetail } from "@/types/media";
import type { SupabaseClient } from "@supabase/supabase-js";

type AlternativeTitle = { iso: string; title: string };

type MediaInsert = {
  id: string;
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  original_title: string | null;
  alternative_titles: AlternativeTitle[];
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
};

function mapMovieDetails(detail: TMDbMovieDetail): MediaInsert {
  const alternative_titles: AlternativeTitle[] =
    detail.alternative_titles?.titles?.map((item) => ({
      iso: item.iso_3166_1,
      title: item.title,
    })) || [];

  const cast_list =
    detail.credits?.cast
      ?.slice()
      .sort((a, b) => a.order - b.order)
      .slice(0, 10)
      .map((cast) => cast.name) || [];

  const directors =
    detail.credits?.crew
      ?.filter((crew) => crew.job === "Director")
      .map((crew) => crew.name) || [];

  return {
    id: `${detail.id}_movie`,
    tmdb_id: detail.id,
    media_type: "movie",
    title: detail.title,
    original_title: detail.original_title || null,
    alternative_titles,
    release_date: detail.release_date || null,
    overview: detail.overview || null,
    poster_path: detail.poster_path ?? null,
    backdrop_path: detail.backdrop_path ?? null,
    genres: detail.genres?.map((genre) => genre.name) || [],
    languages: detail.spoken_languages?.map((lang) => lang.english_name) || [],
    countries: detail.production_countries?.map((country) => country.name) || [],
    runtime: detail.runtime ?? null,
    popularity: detail.popularity ?? null,
    vote_average: detail.vote_average ?? null,
    cast_list,
    directors,
    studios: detail.production_companies?.map((company) => company.name) || [],
  };
}

function mapTVDetails(detail: TMDbTVDetail): MediaInsert {
  const alternative_titles: AlternativeTitle[] =
    detail.alternative_titles?.results?.map((item) => ({
      iso: item.iso_3166_1,
      title: item.title,
    })) || [];

  const cast_list =
    detail.credits?.cast
      ?.slice()
      .sort((a, b) => a.order - b.order)
      .slice(0, 10)
      .map((cast) => cast.name) || [];

  const directors =
    detail.credits?.crew
      ?.filter((crew) => crew.job === "Director")
      .map((crew) => crew.name) || [];

  const runtime = detail.episode_run_time?.length
    ? detail.episode_run_time[0]
    : null;

  return {
    id: `${detail.id}_tv`,
    tmdb_id: detail.id,
    media_type: "tv",
    title: detail.name,
    original_title: detail.original_name || null,
    alternative_titles,
    release_date: detail.first_air_date || null,
    overview: detail.overview || null,
    poster_path: detail.poster_path ?? null,
    backdrop_path: detail.backdrop_path ?? null,
    genres: detail.genres?.map((genre) => genre.name) || [],
    languages: detail.spoken_languages?.map((lang) => lang.english_name) || [],
    countries: detail.production_countries?.map((country) => country.name) || [],
    runtime,
    popularity: detail.popularity ?? null,
    vote_average: detail.vote_average ?? null,
    cast_list,
    directors,
    studios: detail.production_companies?.map((company) => company.name) || [],
  };
}

async function buildMediaInsert(tmdbId: number, mediaType: MediaType) {
  const details =
    mediaType === "movie" ? await getMovieDetails(tmdbId) : await getTVDetails(tmdbId);

  return mediaType === "movie"
    ? mapMovieDetails(details as TMDbMovieDetail)
    : mapTVDetails(details as TMDbTVDetail);
}

export async function ensureMediaCached(
  supabase: SupabaseClient,
  tmdbId: number,
  mediaType: MediaType
) {
  const mediaId = `${tmdbId}_${mediaType}`;

  const { data: existing, error: existingError } = await supabase
    .from("media_items")
    .select("*")
    .eq("id", mediaId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return existing;
  }

  const payload = await buildMediaInsert(tmdbId, mediaType);

  const { data: inserted, error: insertError } = await supabase
    .from("media_items")
    .insert(payload)
    .select("*")
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  return inserted;
}
