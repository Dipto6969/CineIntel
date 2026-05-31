import { NextResponse } from "next/server";
import { getMovieDetails, getTVDetails } from "@/services/tmdb";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (!type || (type !== "movie" && type !== "tv")) {
    return NextResponse.json(
      { error: "Query parameter 'type' must be 'movie' or 'tv'" },
      { status: 400 }
    );
  }

  const tmdbId = parseInt(id, 10);
  if (isNaN(tmdbId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const data =
      type === "movie"
        ? await getMovieDetails(tmdbId)
        : await getTVDetails(tmdbId);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch details";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
