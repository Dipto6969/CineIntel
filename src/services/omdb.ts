// ========================================
// CineIntel OMDb API Service Wrapper
// ========================================

const OMDB_BASE_URL = "https://www.omdbapi.com/";

export type OMDbTitle = {
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Writer: string;
  Actors: string;
  Plot: string;
  Language: string;
  Country: string;
  Awards: string;
  Poster: string;
  Ratings: { Source: string; Value: string }[];
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  imdbID: string;
  Type: string;
  totalSeasons?: string;
  BoxOffice?: string;
  Response: "True" | "False";
  Error?: string;
};

function cleanOmdbValue(value: string | undefined): string | null {
  if (!value || value === "N/A") return null;
  return value;
}

export type NormalizedOMDbTitle = {
  imdbRating: string | null;
  imdbVotes: string | null;
  awards: string | null;
  rated: string | null;
  metascore: string | null;
  boxOffice: string | null;
  runtime: string | null;
  released: string | null;
  totalSeasons: string | null;
  ratings: { source: string; value: string }[];
};

export async function getOmdbByImdbId(imdbId: string): Promise<NormalizedOMDbTitle | null> {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey || apiKey === "your-omdb-api-key") {
    return null;
  }

  const url = new URL(OMDB_BASE_URL);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("i", imdbId);
  url.searchParams.set("plot", "short");

  const response = await fetch(url.toString(), {
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as OMDbTitle;
  if (data.Response !== "True") {
    return null;
  }

  return {
    imdbRating: cleanOmdbValue(data.imdbRating),
    imdbVotes: cleanOmdbValue(data.imdbVotes),
    awards: cleanOmdbValue(data.Awards),
    rated: cleanOmdbValue(data.Rated),
    metascore: cleanOmdbValue(data.Metascore),
    boxOffice: cleanOmdbValue(data.BoxOffice),
    runtime: cleanOmdbValue(data.Runtime),
    released: cleanOmdbValue(data.Released),
    totalSeasons: cleanOmdbValue(data.totalSeasons),
    ratings: (data.Ratings || []).map((rating) => ({
      source: rating.Source,
      value: rating.Value,
    })),
  };
}
