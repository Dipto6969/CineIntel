import { NextResponse } from "next/server";
import {
  discoverMovies,
  discoverTV,
  searchCollections,
  searchCompanies,
  searchKeywords,
  searchMovies,
  searchPeople,
  searchTV,
  getExternalIds,
  getMovieDetails,
  getTVDetails,
} from "@/services/tmdb";
import { getOmdbByImdbId } from "@/services/omdb";
import { GENRE_MAP } from "@/types/media";
import { parseFiltersFromParams, normalizeFilterState } from "@/lib/search/filter-schema";
import { toLanguageCode } from "@/lib/search/language-map";
import type { SearchEntity, SearchEntityType, SearchGroup, UniversalSearchResponse } from "@/types/universal-search";
import type { TMDbSearchResult } from "@/types/media";
import { evaluateAdvancedClauses, parseAdvancedQuery, type QueryClause } from "@/lib/search/query-parser";

type MediaSearchResponse = {
  page: number;
  total_pages: number;
  total_results: number;
  results: TMDbSearchResult[];
};

const PAGE_SIZE = 20;

function getYear(date: string | undefined) {
  return date ? date.slice(0, 4) : null;
}

const GENRE_NAME_TO_ID = Object.fromEntries(
  Object.entries(GENRE_MAP).map(([key, value]) => [value.toLowerCase(), Number(key)])
);

function normalizeGenreNames(values: string[]) {
  const names = values.map((value) => value.trim().toLowerCase());
  if (names.includes("anime")) names.push("animation");
  if (names.includes("documentary")) names.push("documentary");
  return Array.from(new Set(names));
}

function resolveGenreIdGroups(values: string[], mediaType: "movie" | "tv") {
  const names = normalizeGenreNames(values);
  const groups: number[][] = [];

  for (const name of names) {
    const ids = new Set<number>();
    const genreId = GENRE_NAME_TO_ID[name];
    if (typeof genreId === "number") {
      ids.add(genreId);
    }

    if (mediaType === "tv") {
      if (name === "action" || name === "adventure") {
        const tvActionAdventureId = GENRE_NAME_TO_ID["action & adventure"];
        if (typeof tvActionAdventureId === "number") {
          ids.add(tvActionAdventureId);
        }
      }

      if (name === "science fiction" || name === "fantasy") {
        const tvSciFiFantasyId = GENRE_NAME_TO_ID["sci-fi & fantasy"];
        if (typeof tvSciFiFantasyId === "number") {
          ids.add(tvSciFiFantasyId);
        }
      }
    }

    if (ids.size > 0) {
      groups.push(Array.from(ids));
    }
  }

  return groups;
}

function buildGenreFilterValue(groups: number[][]) {
  return groups
    .map((group) => group.join("|"))
    .filter(Boolean)
    .join(",");
}

function matchesGenreGroups(itemGenreIds: number[] | undefined, groups: number[][]) {
  if (!groups.length) return true;
  if (!Array.isArray(itemGenreIds) || itemGenreIds.length === 0) return false;
  return groups.every((group) => group.some((id) => itemGenreIds.includes(id)));
}

function resolveContentTypeConfig(contentType?: string) {
  const animationGenreId = GENRE_NAME_TO_ID.animation;
  const documentaryGenreId = GENRE_NAME_TO_ID.documentary;

  switch (contentType) {
    case "movie":
      return { types: ["movie" as const], presetGenreIds: [] as number[], tvSubtype: "any" as const };
    case "series":
      return { types: ["tv" as const], presetGenreIds: [] as number[], tvSubtype: "any" as const };
    case "anime":
      return { types: ["movie" as const, "tv" as const], presetGenreIds: animationGenreId ? [animationGenreId] : [], tvSubtype: "any" as const };
    case "documentary":
      return { types: ["movie" as const, "tv" as const], presetGenreIds: documentaryGenreId ? [documentaryGenreId] : [], tvSubtype: "any" as const };
    case "mini-series":
      return { types: ["tv" as const], presetGenreIds: [] as number[], tvSubtype: "mini_series" as const };
    default:
      return { types: ["movie" as const, "tv" as const], presetGenreIds: [] as number[], tvSubtype: "any" as const };
  }
}

function matchesYear(value: string | undefined, min?: number, max?: number, decade?: number) {
  if (!value) return false;
  const year = Number(value.slice(0, 4));
  if (!Number.isFinite(year)) return false;
  if (decade && (year < decade || year >= decade + 10)) return false;
  if (min && year < min) return false;
  if (max && year > max) return false;
  return true;
}

function matchesTextQuery(
  item: { title?: string; name?: string; original_title?: string; original_name?: string; overview?: string },
  query: string
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const haystack = [item.title, item.name, item.original_title, item.original_name, item.overview]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalized);
}

function normalizeList(values: string[]) {
  return values.map((value) => value.trim().toLowerCase()).filter(Boolean);
}

function matchesReleaseStatus(
  mediaType: "movie" | "tv",
  releaseDate: string | undefined,
  status: string | undefined,
  filter: string
) {
  if (filter === "any") return true;
  const now = new Date();
  const date = releaseDate ? new Date(releaseDate) : null;

  if (filter === "released") {
    if (!date || Number.isNaN(date.getTime())) return false;
    return date <= now;
  }
  if (filter === "upcoming") {
    if (!date || Number.isNaN(date.getTime())) return false;
    return date > now;
  }

  if (mediaType === "tv") {
    const normalized = status?.toLowerCase() || "";
    if (filter === "airing") {
      return normalized.includes("returning") || normalized.includes("production") || normalized.includes("planned");
    }
    if (filter === "ended") {
      return normalized.includes("ended");
    }
  }

  return true;
}

function matchesStructuredClause(
  clause: QueryClause,
  item: any,
  detail: any,
  mediaType: "movie" | "tv"
) {
  const value = clause.value.trim().toLowerCase();
  if (!value) return false;

  switch (clause.field) {
    case "genre": {
      const itemGenres = Array.isArray(item.genre_ids) ? item.genre_ids : [];
      const detailGenres = Array.isArray(detail?.genres) ? detail.genres.map((genre: { name: string }) => genre.name.toLowerCase()) : [];
      return itemGenres.some((genreId: number) => String(GENRE_MAP[genreId] || "").toLowerCase().includes(value)) ||
        detailGenres.some((genre: string) => genre.includes(value));
    }
    case "language":
      return String(item.original_language || "").toLowerCase().includes(value);
    case "country": {
      const countries = ((detail?.production_countries || []) as Array<{ name?: string }>).map((country: { name?: string }) =>
        String(country.name || "").toLowerCase()
      );
      return countries.some((country: string) => country.includes(value));
    }
    case "director": {
      const crew = (detail?.credits?.crew || []) as Array<{ job?: string; department?: string; name?: string }>;
      return crew.some((person) =>
        (person.job === "Director" || person.department === "Directing") && String(person.name || "").toLowerCase().includes(value)
      );
    }
    case "actor":
    case "cast": {
      const cast = (detail?.credits?.cast || []) as Array<{ name?: string }>;
      return cast.some((person) => String(person.name || "").toLowerCase().includes(value));
    }
    case "studio":
    case "company": {
      const companies = (detail?.production_companies || []) as Array<{ name?: string }>;
      return companies.some((company) => String(company.name || "").toLowerCase().includes(value));
    }
    case "keyword": {
      const movieKeywords = (detail?.keywords?.keywords || []) as Array<{ name?: string }>;
      const tvKeywords = (detail?.keywords?.results || []) as Array<{ name?: string }>;
      const keywords = mediaType === "movie" ? movieKeywords : tvKeywords;
      return keywords.some((keyword) => String(keyword.name || "").toLowerCase().includes(value));
    }
    case "franchise":
    case "collection":
      return mediaType === "movie" && String(detail?.belongs_to_collection?.name || "").toLowerCase().includes(value);
    case "rating":
      return (item.vote_average ?? 0) >= Number(value);
    case "imdb":
      return Number(item.rating ?? 0) >= Number(value);
    case "year": {
      const dateValue = mediaType === "movie" ? item.release_date : item.first_air_date;
      return matchesYear(dateValue, clause.operator.includes(">") ? Number(value) : undefined, clause.operator.includes("<") ? Number(value) : undefined);
    }
    default:
      return false;
  }
}

async function resolvePersonIds(names: string[]) {
  const ids: number[] = [];
  for (const name of names) {
    const response = await searchPeople(name, 1);
    const match = response.results[0];
    if (match) ids.push(match.id);
  }
  return ids;
}

async function resolveCompanyIds(names: string[]) {
  const ids: number[] = [];
  for (const name of names) {
    const response = await searchCompanies(name, 1);
    const match = response.results[0];
    if (match) ids.push(match.id);
  }
  return ids;
}

async function resolveKeywordIds(names: string[]) {
  const ids: number[] = [];
  for (const name of names) {
    const response = await searchKeywords(name, 1);
    const match = response.results[0];
    if (match) ids.push(match.id);
  }
  return ids;
}

async function resolveCollectionIds(names: string[]) {
  const ids: number[] = [];
  for (const name of names) {
    const response = await searchCollections(name, 1);
    const match = response.results[0];
    if (match) ids.push(match.id);
  }
  return ids;
}

function isSimpleAndExpression(clauses: QueryClause[]) {
  return clauses.every((clause, index) => index === 0 || (clause.join !== "or" && !clause.negated));
}

async function applyDetailFilters(
  results: any[],
  mediaType: "movie" | "tv",
  filters: ReturnType<typeof parseFiltersFromParams>,
  collectionIds: number[],
  clauses: QueryClause[] = [],
  plainQuery = ""
): Promise<any[]> {
  if (
    filters.countries.length === 0 &&
    filters.releaseStatus === "any" &&
    filters.tvSubtype === "any" &&
    filters.runtimeMin === undefined &&
    filters.runtimeMax === undefined &&
    filters.franchise.length === 0
  ) {
    return results;
  }

  const countrySet = new Set(normalizeList(filters.countries));

  const detailed = await Promise.all(
    results.map(async (item) => {
      try {
        const detail =
          mediaType === "movie"
            ? await getMovieDetails(item.id)
            : await getTVDetails(item.id);
        return { item, detail };
      } catch {
        return null;
      }
    })
  );

  return detailed
    .filter((entry): entry is { item: TMDbSearchResult; detail: any } => Boolean(entry))
    .filter(({ item, detail }) => {
      const releaseDate = mediaType === "movie" ? detail.release_date : detail.first_air_date;
      if (!matchesReleaseStatus(mediaType, releaseDate, detail.status, filters.releaseStatus)) {
        return false;
      }

      if (filters.tvSubtype === "mini_series" && mediaType === "tv") {
        const typeValue = String(detail.type || "").toLowerCase();
        if (!typeValue.includes("mini")) return false;
      }

      if (filters.runtimeMin || filters.runtimeMax) {
        const runtimeValue = mediaType === "movie" ? detail.runtime : detail.episode_run_time?.[0];
        if (!runtimeValue) return false;
        if (filters.runtimeMin && runtimeValue < filters.runtimeMin) return false;
        if (filters.runtimeMax && runtimeValue > filters.runtimeMax) return false;
      }

      if (countrySet.size > 0) {
        const productionCountries = (detail.production_countries || []) as Array<{ name?: string }>;
        const countries: string[] = [];
        for (const country of productionCountries) {
          countries.push(String(country.name || "").toLowerCase());
        }
        const hasMatch = countries.some((country) => countrySet.has(country));
        if (!hasMatch) return false;
      }

      if (filters.franchise.length > 0 && mediaType === "movie") {
        const collectionId = detail.belongs_to_collection?.id;
        if (!collectionId || !collectionIds.includes(collectionId)) return false;
      }

      if (plainQuery && !matchesTextQuery(item, plainQuery)) {
        return false;
      }

      if (clauses.length > 0) {
        const clauseMatch = evaluateAdvancedClauses(clauses, (clause) =>
          matchesStructuredClause(clause, item, detail, mediaType)
        );
        if (!clauseMatch) return false;
      }

      return true;
    })
    .map((entry) => entry.item);
}

async function enrichImdb(entities: SearchEntity[], enabled: boolean) {
  if (!enabled || entities.length === 0) return entities;
  const cache = new Map<string, { rating: string | null; votes: string | null; awards: string | null }>();

  return Promise.all(
    entities.map(async (entity: SearchEntity): Promise<SearchEntity> => {
      if (entity.type !== "movie" && entity.type !== "tv") return entity;
      const key = `${entity.type}-${entity.id}`;
      const cached = cache.get(key);
      if (cached) {
        return { ...entity, rating: cached.rating, votes: cached.votes, awards: cached.awards } as SearchEntity;
      }

      try {
        const externalIds = await getExternalIds(entity.type, entity.id);
        if (!externalIds?.imdb_id) return entity;
        const omdb = await getOmdbByImdbId(externalIds.imdb_id);
        const rating = omdb?.imdbRating ?? null;
        const votes = omdb?.imdbVotes ?? null;
        const awards = omdb?.awards ?? null;
        cache.set(key, { rating, votes, awards });
        return { ...entity, rating, votes, awards } as SearchEntity;
      } catch {
        return entity;
      }
    })
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";
  const parsedQuery = parseAdvancedQuery(query);
  const textQuery = parsedQuery.text.trim();
  const clauses = parsedQuery.clauses;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const includeImdb = searchParams.get("include") === "imdb";
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : null;
  const filters = normalizeFilterState(parseFiltersFromParams(searchParams));
  const contentTypeConfig = resolveContentTypeConfig(filters.contentType);
  const movieGenreGroups = [
    ...resolveGenreIdGroups(filters.genres, "movie"),
    ...contentTypeConfig.presetGenreIds.map((id) => [id]),
  ];
  const tvGenreGroups = [
    ...resolveGenreIdGroups(filters.genres, "tv"),
    ...contentTypeConfig.presetGenreIds.map((id) => [id]),
  ];
  const languageCode = toLanguageCode(filters.language);
  const effectiveFilters = {
    ...filters,
    tvSubtype: filters.contentType === "mini-series" ? "mini_series" : filters.tvSubtype,
  };

  try {
    const hasFilterCriteria =
      filters.genres.length > 0 ||
      Boolean(filters.yearMin || filters.yearMax || filters.decade) ||
      Boolean(filters.runtimeMin || filters.runtimeMax) ||
      Boolean(filters.language) ||
      filters.countries.length > 0 ||
      filters.releaseStatus !== "any" ||
      filters.tvSubtype !== "any" ||
        Boolean(filters.voteCountMin) ||
      filters.director.length > 0 ||
      filters.actor.length > 0 ||
      filters.studio.length > 0 ||
      filters.keywords.length > 0 ||
      filters.franchise.length > 0 ||
      filters.awardsOnly ||
      Boolean(filters.imdbMin || filters.tmdbMin);

    const hasAdvancedClauses = clauses.length > 0;
    const useDiscoverForMedia = Boolean(filters.contentType) || hasFilterCriteria || filters.sort !== "relevance" || hasAdvancedClauses;
    const canPushStructuredFilters = isSimpleAndExpression(clauses);

    const [directorIds, actorIds, companyIds, keywordIds, collectionIds] = await Promise.all([
      filters.director.length && canPushStructuredFilters ? resolvePersonIds(filters.director) : Promise.resolve([]),
      filters.actor.length && canPushStructuredFilters ? resolvePersonIds(filters.actor) : Promise.resolve([]),
      filters.studio.length && canPushStructuredFilters ? resolveCompanyIds(filters.studio) : Promise.resolve([]),
      filters.keywords.length && canPushStructuredFilters ? resolveKeywordIds(filters.keywords) : Promise.resolve([]),
      filters.franchise.length ? resolveCollectionIds(filters.franchise) : Promise.resolve([]),
    ]);

    if (!textQuery && !hasFilterCriteria && !hasAdvancedClauses && filters.sort === "relevance") {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 }
      );
    }

    const types = filters.contentType ? contentTypeConfig.types : (filters.types.length ? filters.types : ["movie", "tv"]);
    const discoverMovieParams: Record<string, string> = {};
    const discoverTvParams: Record<string, string> = {};

    if (movieGenreGroups.length) {
      discoverMovieParams.with_genres = buildGenreFilterValue(movieGenreGroups);
    }
    if (tvGenreGroups.length) {
      discoverTvParams.with_genres = buildGenreFilterValue(tvGenreGroups);
    }
    if (textQuery && useDiscoverForMedia) {
      discoverMovieParams.with_text_query = textQuery;
      discoverTvParams.with_text_query = textQuery;
    }
    if (languageCode) {
      discoverMovieParams.with_original_language = languageCode;
      discoverTvParams.with_original_language = languageCode;
    }
    if (filters.yearMin || filters.yearMax || filters.decade) {
      const minYear = filters.decade || filters.yearMin;
      const maxYear = filters.decade ? filters.decade + 9 : filters.yearMax;
      if (minYear) {
        discoverMovieParams.primary_release_date_gte = `${minYear}-01-01`;
        discoverTvParams.first_air_date_gte = `${minYear}-01-01`;
      }
      if (maxYear) {
        discoverMovieParams.primary_release_date_lte = `${maxYear}-12-31`;
        discoverTvParams.first_air_date_lte = `${maxYear}-12-31`;
      }
    }
    if (filters.runtimeMin) {
      discoverMovieParams.with_runtime_gte = String(filters.runtimeMin);
      discoverTvParams.with_runtime_gte = String(filters.runtimeMin);
    }
    if (filters.runtimeMax) {
      discoverMovieParams.with_runtime_lte = String(filters.runtimeMax);
      discoverTvParams.with_runtime_lte = String(filters.runtimeMax);
    }
    if (filters.tmdbMin) {
      discoverMovieParams["vote_average.gte"] = String(filters.tmdbMin);
      discoverTvParams["vote_average.gte"] = String(filters.tmdbMin);
    }
    if (filters.voteCountMin) {
      discoverMovieParams["vote_count.gte"] = String(filters.voteCountMin);
      discoverTvParams["vote_count.gte"] = String(filters.voteCountMin);
    }
    if (filters.sort === "relevance" && query && useDiscoverForMedia) {
      discoverMovieParams.sort_by = "popularity.desc";
      discoverTvParams.sort_by = "popularity.desc";
    }
    if (filters.sort && filters.sort !== "relevance") {
      const sortMap: Record<string, string> = {
        popularity: "popularity.desc",
        release_date: "primary_release_date.desc",
        rating: "vote_average.desc",
        runtime: "runtime.desc",
        title: "original_title.asc",
      };
      discoverMovieParams.sort_by = sortMap[filters.sort] || "popularity.desc";
      discoverTvParams.sort_by = sortMap[filters.sort] || "popularity.desc";
    }

    if (canPushStructuredFilters) {
      if (directorIds.length) {
        discoverMovieParams.with_crew = directorIds.join(",");
        discoverTvParams.with_crew = directorIds.join(",");
      }
      if (actorIds.length) {
        discoverMovieParams.with_cast = actorIds.join(",");
        discoverTvParams.with_cast = actorIds.join(",");
      }
      if (companyIds.length) {
        discoverMovieParams.with_companies = companyIds.join(",");
      }
      if (keywordIds.length) {
        discoverMovieParams.with_keywords = keywordIds.join(",");
        discoverTvParams.with_keywords = keywordIds.join(",");
      }
    }

    const emptyList: MediaSearchResponse = { page, total_pages: 0, total_results: 0, results: [] };

    const [movies, tv] = await Promise.all([
      types.includes("movie")
      ? (useDiscoverForMedia
        ? discoverMovies({ ...discoverMovieParams, page: String(page) })
        : searchMovies(query || " ", page))
        .catch(() => emptyList)
      : Promise.resolve(emptyList),
      types.includes("tv")
      ? (useDiscoverForMedia
        ? discoverTV({ ...discoverTvParams, page: String(page) })
        : searchTV(query || " ", page))
        .catch(() => emptyList)
      : Promise.resolve(emptyList),
    ]) as [MediaSearchResponse, MediaSearchResponse];

    const filterMovieGenreGroups = movieGenreGroups;
    const filterTvGenreGroups = tvGenreGroups;
    const movieResults = movies.results as any[];
    const tvResults = tv.results as any[];

    const filteredMovieResults: any[] = await applyDetailFilters(
      movieResults
        .filter((item) => {
          if (useDiscoverForMedia && textQuery && !matchesTextQuery(item, textQuery)) return false;
          if (filterMovieGenreGroups.length && item.genre_ids) {
            const matches = matchesGenreGroups(item.genre_ids, filterMovieGenreGroups);
            if (!matches) return false;
          }
          if (!matchesYear(item.release_date, filters.yearMin, filters.yearMax, filters.decade)) return false;
          if (languageCode && item.original_language !== languageCode) return false;
          if (filters.tmdbMin && item.vote_average < filters.tmdbMin) return false;
          if (filters.voteCountMin && (item.vote_count ?? 0) < filters.voteCountMin) return false;
          return true;
        }),
      "movie",
      effectiveFilters,
      collectionIds,
      clauses,
      textQuery
    );

    const filteredTvResults: any[] = await applyDetailFilters(
      tvResults
        .filter((item) => {
          if (useDiscoverForMedia && textQuery && !matchesTextQuery(item, textQuery)) return false;
          if (filterTvGenreGroups.length && item.genre_ids) {
            const matches = matchesGenreGroups(item.genre_ids, filterTvGenreGroups);
            if (!matches) return false;
          }
          if (!matchesYear(item.first_air_date, filters.yearMin, filters.yearMax, filters.decade)) return false;
          if (languageCode && item.original_language !== languageCode) return false;
          if (filters.tmdbMin && item.vote_average < filters.tmdbMin) return false;
          if (filters.voteCountMin && (item.vote_count ?? 0) < filters.voteCountMin) return false;
          return true;
        }),
      "tv",
      effectiveFilters,
      collectionIds,
      clauses,
      textQuery
    );

    const movieEntities: SearchEntity[] = filteredMovieResults.map((item: any): SearchEntity => ({
      id: item.id,
      type: "movie",
      title: item.title || "Untitled",
      year: getYear(item.release_date),
      imagePath: item.poster_path,
      imageType: "poster",
      popularity: item.vote_average ?? null,
    }));

    const tvEntities: SearchEntity[] = filteredTvResults.map((item: any): SearchEntity => ({
      id: item.id,
      type: "tv",
      title: item.name || "Untitled",
      year: getYear(item.first_air_date),
      imagePath: item.poster_path,
      imageType: "poster",
      popularity: item.vote_average ?? null,
    }));

    const trim = <T,>(items: T[]) => (limit ? items.slice(0, limit) : items);

    const effectivePageSize = limit || PAGE_SIZE;

    const enrichedMovies = await enrichImdb(trim(movieEntities), includeImdb || Boolean(filters.imdbMin || filters.awardsOnly));
    const enrichedTv = await enrichImdb(trim(tvEntities), includeImdb || Boolean(filters.imdbMin || filters.awardsOnly));

    const applyImdbFilters = (items: SearchEntity[]) => {
      let filtered = items;
      if (filters.imdbMin) {
        filtered = filtered.filter((item) => {
          const rating = item.rating ? Number(item.rating) : 0;
          return rating >= (filters.imdbMin || 0);
        });
      }
      if (filters.awardsOnly) {
        filtered = filtered.filter((item) => Boolean(item.awards));
      }
      return filtered;
    };

    const finalMovies = applyImdbFilters(enrichedMovies);
    const finalTv = applyImdbFilters(enrichedTv);

    const groups: SearchGroup[] = [
      { type: "movie", label: "Movies", results: finalMovies, total: movies.total_results },
      { type: "tv", label: "Series", results: finalTv, total: tv.total_results },
    ];

    const totals: Record<SearchEntityType, number> = {
      movie: movies.total_results,
      tv: tv.total_results,
      person: 0,
      collection: 0,
      keyword: 0,
      company: 0,
      network: 0,
    };

    const totalCandidates = [movies.total_results, tv.total_results];

    const hasMore = totalCandidates.some((total) => total > page * effectivePageSize);

    const payload: UniversalSearchResponse = {
      query,
      page,
      pageSize: effectivePageSize,
      hasMore,
      groups,
      totals,
    };

    return NextResponse.json(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
