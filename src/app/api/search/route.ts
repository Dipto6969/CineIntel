import { NextResponse } from "next/server";
import { searchMulti, searchMovies, searchTV, getExternalIds } from "@/services/tmdb";
import { getOmdbByImdbId } from "@/services/omdb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const type = searchParams.get("type"); // "movie" | "tv" | null (multi)
  const include = searchParams.get("include");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : null;

  if (!query || query.trim().length === 0) {
    return NextResponse.json(
      { error: "Query parameter 'q' is required" },
      { status: 400 }
    );
  }

  try {
    let data;
    if (type === "movie") {
      data = await searchMovies(query, page);
    } else if (type === "tv") {
      data = await searchTV(query, page);
    } else {
      data = await searchMulti(query, page);
    }

    if (include === "imdb") {
      const baseResults = limit ? data.results.slice(0, limit) : data.results;
      const enrichedResults = await Promise.all(
        baseResults.map(async (item) => {
          try {
            const externalIds = await getExternalIds(item.media_type, item.id);
            if (!externalIds?.imdb_id) return item;
            const omdb = await getOmdbByImdbId(externalIds.imdb_id);
            return {
              ...item,
              imdb_rating: omdb?.imdbRating ?? null,
              imdb_votes: omdb?.imdbVotes ?? null,
            };
          } catch {
            return item;
          }
        })
      );

      return NextResponse.json({
        ...data,
        results: enrichedResults,
      });
    }

    if (limit) {
      data.results = data.results.slice(0, limit);
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
