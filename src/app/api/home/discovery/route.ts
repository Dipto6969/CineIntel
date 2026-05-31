import { NextResponse } from "next/server";
import {
  discoverMovies,
  discoverTV,
  getPopularMovies,
  getTrending,
} from "@/services/tmdb";
import type { TMDbSearchResult } from "@/types/tmdb";
import {
  DISCOVERY_PRESETS,
  DISCOVERY_SECTION_ORDER,
  type DiscoverySectionKey,
} from "@/features/discovery/saved-queries";

type HomeDiscoverySection = {
  key: DiscoverySectionKey;
  title: string;
  description: string;
  exploreHref: string;
  items: TMDbSearchResult[];
};

function filterPreviewItems(items: TMDbSearchResult[]) {
  return items.filter((item) => item.backdrop_path || item.poster_path);
}

function mergeCriticallyAcclaimed(movieResults: TMDbSearchResult[], tvResults: TMDbSearchResult[]) {
  return [...movieResults, ...tvResults]
    .filter((item) => (item.vote_average ?? 0) >= 8 && ((item as any).vote_count ?? 0) >= 5000)
    .sort((a, b) => {
      const scoreDelta = (b.vote_average ?? 0) - (a.vote_average ?? 0);
      if (Math.abs(scoreDelta) > 0.01) return scoreDelta;
      return ((b as any).vote_count ?? 0) - ((a as any).vote_count ?? 0);
    });
}

export async function GET() {
  try {
    const [trending, popularMovies, mustWatchSeries, acclaimedMovies, acclaimedSeries] = await Promise.all([
      getTrending("day", 1),
      getPopularMovies(1),
      discoverTV({
        "vote_average.gte": "8",
        "vote_count.gte": "1000",
        sort_by: "vote_average.desc",
        page: "1",
      }),
      discoverMovies({
        "vote_average.gte": "8",
        "vote_count.gte": "5000",
        sort_by: "vote_average.desc",
        page: "1",
      }),
      discoverTV({
        "vote_average.gte": "8",
        "vote_count.gte": "5000",
        sort_by: "vote_average.desc",
        page: "1",
      }),
    ]);

    const sections: HomeDiscoverySection[] = [
      {
        key: "trending" as const,
        title: DISCOVERY_PRESETS.trending.title,
        description: DISCOVERY_PRESETS.trending.description,
        exploreHref: DISCOVERY_PRESETS.trending.exploreHref,
        items: filterPreviewItems(trending.results).slice(0, DISCOVERY_PRESETS.trending.previewLimit),
      },
      {
        key: "popular-movies" as const,
        title: DISCOVERY_PRESETS["popular-movies"].title,
        description: DISCOVERY_PRESETS["popular-movies"].description,
        exploreHref: DISCOVERY_PRESETS["popular-movies"].exploreHref,
        items: filterPreviewItems(popularMovies.results).slice(0, DISCOVERY_PRESETS["popular-movies"].previewLimit),
      },
      {
        key: "must-watch-series" as const,
        title: DISCOVERY_PRESETS["must-watch-series"].title,
        description: DISCOVERY_PRESETS["must-watch-series"].description,
        exploreHref: DISCOVERY_PRESETS["must-watch-series"].exploreHref,
        items: filterPreviewItems(mustWatchSeries.results).slice(0, DISCOVERY_PRESETS["must-watch-series"].previewLimit),
      },
      {
        key: "critically-acclaimed" as const,
        title: DISCOVERY_PRESETS["critically-acclaimed"].title,
        description: DISCOVERY_PRESETS["critically-acclaimed"].description,
        exploreHref: DISCOVERY_PRESETS["critically-acclaimed"].exploreHref,
        items: filterPreviewItems(
          mergeCriticallyAcclaimed(acclaimedMovies.results, acclaimedSeries.results)
        ).slice(0, DISCOVERY_PRESETS["critically-acclaimed"].previewLimit),
      },
    ].sort((a, b) => DISCOVERY_SECTION_ORDER.indexOf(a.key) - DISCOVERY_SECTION_ORDER.indexOf(b.key));

    return NextResponse.json({ sections });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load homepage discovery sections";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
