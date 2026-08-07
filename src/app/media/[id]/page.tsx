import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { MediaInventoryActions } from "@/components/media/MediaInventoryActions";
import { CastSection } from "@/components/media/CastSection";
import {
  backdropUrl,
  getMovieDetails,
  getTVDetails,
  posterUrl,
  profileUrl,
} from "@/services/tmdb";
import { getOmdbByImdbId } from "@/services/omdb";
import {
  Award,
  BadgeDollarSign,
  Building2,
  CalendarDays,
  Clock,
  Clapperboard,
  Globe2,
  Heart,
  Languages,
  Star,
  Users,
} from "lucide-react";
import type { MediaType, TMDbMovieDetail, TMDbTVDetail, WatchStatus } from "@/types/media";

function formatRuntime(minutes: number | null): string {
  if (!minutes || minutes <= 0) return "--";
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) return `${remaining}m`;
  return `${hours}h ${remaining}m`;
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "--";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatYear(dateString: string | null | undefined): string {
  return dateString ? dateString.slice(0, 4) : "--";
}

function formatStatus(value: string): string {
  return value.replace(/_/g, " ");
}

function formatBoxOfficeMillions(value: string | null | undefined): string {
  if (!value) return "--";
  const cleaned = value.replace(/[^0-9.]/g, "");
  const numericValue = Number(cleaned);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return "--";
  const millions = numericValue / 1_000_000;
  const rounded = millions >= 100 ? Math.round(millions) : Math.round(millions * 10) / 10;
  return `${rounded}M`;
}

function scoreColor(score: number): string {
  if (score >= 7.5) return "text-[oklch(0.75_0.15_140)] border-[oklch(0.75_0.15_140)]/30";
  if (score >= 6) return "text-[oklch(0.78_0.14_75)] border-[oklch(0.78_0.14_75)]/30";
  return "text-[oklch(0.65_0.18_25)] border-[oklch(0.65_0.18_25)]/30";
}

type InventorySnapshot = {
  id: string;
  media_item_id: string;
  status: WatchStatus;
  rating: number | null;
  watch_dates: string[];
  notes: string | null;
  review: string | null;
  is_favorite: boolean;
  tags: { id: string; name: string }[];
};

type TagValue = { id: string; name: string };

type TagLink = {
  tag: TagValue | TagValue[] | null;
};

async function loadUserInventory(mediaItemId: string): Promise<InventorySnapshot | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: inventory } = await supabase
    .from("user_inventory")
    .select("*")
    .eq("user_id", user.id)
    .eq("media_item_id", mediaItemId)
    .maybeSingle();

  if (!inventory) return null;

  const { data: tagLinks } = await supabase
    .from("inventory_tags")
    .select("tag:tags(id, name)")
    .eq("inventory_id", inventory.id);

  const tags =
    (tagLinks as TagLink[] | null)
      ?.flatMap((link) => {
        if (!link.tag) return [];
        return Array.isArray(link.tag) ? link.tag : [link.tag];
      }) || [];

  return {
    id: inventory.id,
    media_item_id: inventory.media_item_id,
    status: inventory.status,
    rating: inventory.rating,
    watch_dates: inventory.watch_dates || [],
    notes: inventory.notes,
    review: inventory.review,
    is_favorite: inventory.is_favorite,
    tags,
  };
}

export default async function MediaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type } = await searchParams;
  const mediaType: MediaType = type === "tv" ? "tv" : "movie";

  const tmdbId = Number(id);
  if (Number.isNaN(tmdbId)) {
    return (
      <div className="min-h-screen bg-[#050608] text-zinc-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-zinc-400">Invalid media id.</p>
          <Link className="text-sm text-[oklch(0.70_0.16_195)]" href="/">
            Return to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const detail =
    mediaType === "movie"
      ? await getMovieDetails(tmdbId)
      : await getTVDetails(tmdbId);

  const isMovie = mediaType === "movie";
  const title = isMovie
    ? (detail as TMDbMovieDetail).title
    : (detail as TMDbTVDetail).name;
  const originalTitle = isMovie
    ? (detail as TMDbMovieDetail).original_title
    : (detail as TMDbTVDetail).original_name;
  const releaseDate = isMovie
    ? (detail as TMDbMovieDetail).release_date
    : (detail as TMDbTVDetail).first_air_date;
  const runtime = isMovie
    ? (detail as TMDbMovieDetail).runtime
    : (detail as TMDbTVDetail).episode_run_time?.[0] ?? null;

  const cast = detail.credits?.cast || [];
  const directors = detail.credits?.crew?.filter((member) => member.job === "Director") || [];
  const writers = detail.credits?.crew?.filter((member) =>
    ["Writing", "Creator"].includes(member.department) ||
    ["Writer", "Screenplay", "Story", "Characters"].includes(member.job)
  ) || [];
  const studios = detail.production_companies?.slice(0, 4) || [];
  const countries = detail.production_countries?.slice(0, 4) || [];
  const languages = detail.spoken_languages?.slice(0, 4) || [];
  const providers = detail["watch/providers"]?.results?.US;
  const imdbId = isMovie
    ? (detail as TMDbMovieDetail).imdb_id || detail.external_ids?.imdb_id || null
    : detail.external_ids?.imdb_id || null;
  const omdb = imdbId ? await getOmdbByImdbId(imdbId) : null;

  const alternativeTitles = isMovie
    ? (detail as TMDbMovieDetail).alternative_titles?.titles || []
    : (detail as TMDbTVDetail).alternative_titles?.results || [];

  const recommendations = detail.recommendations?.results?.slice(0, 8) || [];

  const mediaItemId = `${tmdbId}_${mediaType}`;
  const inventorySnapshot = await loadUserInventory(mediaItemId);

  const backdrop = backdropUrl(detail.backdrop_path, "w1280");
  const poster = posterUrl(detail.poster_path, "w342");
  const titleYear = formatYear(releaseDate);
  const imdbScoreValue = omdb?.imdbRating ? Number(omdb.imdbRating) : null;
  const imdbScoreClass =
    imdbScoreValue !== null && Number.isFinite(imdbScoreValue)
      ? scoreColor(imdbScoreValue)
      : "text-zinc-400 border-white/10";
  const imdbLikeMeta = [
    mediaType === "movie" ? "Movie" : "Series",
    titleYear,
    omdb?.runtime || formatRuntime(runtime),
    omdb?.rated,
    detail.status,
  ].filter((item) => item && item !== "--");
  const personalStatus = inventorySnapshot?.status ? formatStatus(inventorySnapshot.status) : "Not tracked";

  return (
    <div className="min-h-screen bg-[#050608] text-zinc-100 relative selection:bg-[oklch(0.70_0.16_195)]/30 selection:text-white pb-10">
      <Navbar transparentOnTop={true} />
      <div className="absolute inset-0 top-0 h-150">
        {backdrop && (
          <div
            className="absolute inset-0 bg-cover bg-top backdrop-mask opacity-60 mix-blend-screen"
            style={{ backgroundImage: `url(${backdrop})` }}
          />
        )}
        <div className="absolute inset-0 bg-linear-to-b from-[#050608]/40 via-[#050608]/80 to-[#050608]" />
      </div>

      <main className="relative max-w-400 mx-auto px-4 sm:px-6 md:px-12 py-10 sm:py-12 mt-20">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <Link className="text-xs text-zinc-400 hover:text-white" href="/search">
            Back to search
          </Link>
          <span className="text-xs uppercase tracking-[0.3em] text-zinc-500">
            Media dossier
          </span>
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
              <div className="aspect-2/3 bg-black/40 flex items-center justify-center relative">
                {poster ? (
                  <Image
                    src={poster}
                    alt={`${title} poster`}
                    fill
                    sizes="(max-width: 1024px) 60vw, 300px"
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <span className="text-xs text-zinc-500">Poster unavailable</span>
                )}
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className={`rounded-2xl border bg-black/30 p-4 ${imdbScoreClass}`}>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
                    <Star className="w-4 h-4 fill-current" /> IMDb Rating
                  </div>
                  <div className="mt-2 text-3xl font-black text-white">{omdb?.imdbRating || "--"}</div>
                  <div className="text-xs text-zinc-500">IMDb / 10</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    <Users className="w-4 h-4" /> IMDb Votes
                  </div>
                  <div className="mt-2 text-2xl font-black text-white">{omdb?.imdbVotes || "--"}</div>
                  <div className="text-xs text-zinc-500">public ratings</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs text-zinc-500">Metascore</div>
                  <div className="mt-1 font-bold text-white">{omdb?.metascore || "--"}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs text-zinc-500">{isMovie ? "Box Office" : "Seasons"}</div>
                  <div className="mt-1 font-bold text-white">
                    {isMovie ? formatBoxOfficeMillions(omdb?.boxOffice) : omdb?.totalSeasons || "--"}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs text-zinc-500">Your Status</div>
                  <div className="mt-1 font-bold capitalize text-white">{personalStatus}</div>
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-8">
            <section className="glass-panel rounded-3xl p-4 sm:p-6 md:p-8">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                {imdbLikeMeta.map((item) => (
                  <span key={item} className="px-2.5 py-1 rounded-full border border-white/10 bg-white/3">
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
                <div className="max-w-4xl">
                  <h1 className="text-3xl sm:text-6xl font-black tracking-tight text-white leading-[1.02]">
                    {title}
                  </h1>
                  {detail.tagline && (
                    <p className="mt-3 text-lg text-[oklch(0.70_0.16_195)] font-semibold">
                      {detail.tagline}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-zinc-500">Original title: {originalTitle}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0 xl:min-w-90">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Released</div>
                    <div className="mt-2 text-sm font-bold text-white">{formatDate(releaseDate)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Runtime</div>
                    <div className="mt-2 text-sm font-bold text-white">{omdb?.runtime || formatRuntime(runtime)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Type</div>
                    <div className="mt-2 text-sm font-bold text-white">{mediaType === "movie" ? "Movie" : "Series"}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {detail.genres?.map((genre) => (
                  <span key={genre.id} className="px-3 py-1 rounded-full text-xs border border-white/10 bg-black/25 text-zinc-300">
                    {genre.name}
                  </span>
                ))}
              </div>

              <div className="mt-7">
                <MediaInventoryActions
                  tmdbId={tmdbId}
                  mediaType={mediaType}
                  initialInventory={inventorySnapshot}
                />
              </div>

              <p className="mt-7 text-base text-zinc-300 leading-relaxed max-w-5xl">
                {detail.overview || "Overview not available."}
              </p>
            </section>

            {(omdb?.awards || omdb?.metascore || omdb?.rated || omdb?.ratings.length) && (
              <section className="glass-panel rounded-3xl p-4 sm:p-6">
                <h2 className="text-xs uppercase tracking-[0.3em] text-zinc-400 mb-5">
                  IMDb & Awards
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4">
                    <div className="text-xs text-amber-200">IMDb Rating</div>
                    <div className="mt-2 text-3xl font-black text-white">
                      {omdb?.imdbRating || "--"}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {omdb?.imdbVotes ? `${omdb.imdbVotes} votes` : "Votes unavailable"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="text-xs text-zinc-500">Metascore</div>
                    <div className="mt-2 text-3xl font-black text-white">
                      {omdb?.metascore || "--"}
                    </div>
                    <div className="text-xs text-zinc-500">critic score</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="text-xs text-zinc-500">Rated</div>
                    <div className="mt-2 text-3xl font-black text-white">
                      {omdb?.rated || "--"}
                    </div>
                    <div className="text-xs text-zinc-500">certification</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="text-xs text-zinc-500">{isMovie ? "Box Office" : "Seasons"}</div>
                    <div className="mt-2 text-2xl font-black text-white">
                      {isMovie ? omdb?.boxOffice || "--" : omdb?.totalSeasons || "--"}
                    </div>
                    <div className="text-xs text-zinc-500">via OMDb</div>
                  </div>
                </div>
                {omdb?.awards && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      <Award className="w-4 h-4 text-[oklch(0.70_0.16_195)]" />
                      Awards
                    </div>
                    <p className="mt-2 text-sm text-zinc-300">{omdb.awards}</p>
                  </div>
                )}
                {omdb?.ratings.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {omdb.ratings.map((rating) => (
                      <span key={rating.source} className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-zinc-300">
                        {rating.source}: <span className="font-bold text-white">{rating.value}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </section>
            )}

            <section className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
              <div className="glass-panel rounded-3xl p-4 sm:p-6">
                <h2 className="text-xs uppercase tracking-[0.3em] text-zinc-400 mb-5">Credits</h2>
                <div className="divide-y divide-white/10">
                  <div className="py-4 first:pt-0 grid grid-cols-1 md:grid-cols-[140px_1fr] gap-2">
                    <div className="text-sm font-bold text-white">Director</div>
                    <div className="text-sm text-zinc-300">
                      {directors.length ? directors.slice(0, 4).map((member) => member.name).join(", ") : "Not available"}
                    </div>
                  </div>
                  <div className="py-4 grid grid-cols-1 md:grid-cols-[140px_1fr] gap-2">
                    <div className="text-sm font-bold text-white">Writers</div>
                    <div className="text-sm text-zinc-300">
                      {writers.length ? writers.slice(0, 6).map((member) => member.name).join(", ") : "Not available"}
                    </div>
                  </div>
                  <div className="py-4 grid grid-cols-1 md:grid-cols-[140px_1fr] gap-2">
                    <div className="text-sm font-bold text-white">Stars</div>
                    <div className="text-sm text-zinc-300">
                      {cast.length ? cast.slice(0, 4).map((member) => member.name).join(", ") : "Not available"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-3xl p-4 sm:p-6">
                <h2 className="text-xs uppercase tracking-[0.3em] text-zinc-400 mb-5">Your Workspace</h2>
                <div className="space-y-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-500">Status</span>
                    <span className="font-bold capitalize text-white">{personalStatus}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-500">Your rating</span>
                    <span className="font-bold text-white">{inventorySnapshot?.rating ?? "--"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-500">Favorite</span>
                    <span className="inline-flex items-center gap-2 font-bold text-white">
                      {inventorySnapshot?.is_favorite ? <Heart className="w-4 h-4 text-rose-400 fill-current" /> : null}
                      {inventorySnapshot?.is_favorite ? "Pinned" : "No"}
                    </span>
                  </div>
                  <div>
                    <div className="text-zinc-500">Watch log</div>
                    <div className="mt-1 text-white">
                      {inventorySnapshot?.watch_dates.length ? inventorySnapshot.watch_dates.join(", ") : "No dates logged"}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-500">Notes</div>
                    <div className="mt-1 text-zinc-300">{inventorySnapshot?.notes || "No notes yet."}</div>
                  </div>
                </div>
              </div>
            </section>

            <CastSection cast={cast} />

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-panel rounded-3xl p-4 sm:p-6">
                <h2 className="text-xs uppercase tracking-[0.3em] text-zinc-400 mb-5">Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <CalendarDays className="w-4 h-4 text-[oklch(0.70_0.16_195)] mb-3" />
                    <div className="text-zinc-500">Release date</div>
                    <div className="mt-1 font-bold text-white">{formatDate(releaseDate)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <Clock className="w-4 h-4 text-[oklch(0.70_0.16_195)] mb-3" />
                    <div className="text-zinc-500">{mediaType === "movie" ? "Runtime" : "Episodes"}</div>
                    <div className="mt-1 font-bold text-white">
                      {isMovie ? omdb?.runtime || formatRuntime(runtime) : `${(detail as TMDbTVDetail).number_of_episodes} episodes`}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <Globe2 className="w-4 h-4 text-[oklch(0.70_0.16_195)] mb-3" />
                    <div className="text-zinc-500">Countries</div>
                    <div className="mt-1 font-bold text-white">
                      {countries.length ? countries.map((country) => country.name).join(", ") : "--"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <Languages className="w-4 h-4 text-[oklch(0.70_0.16_195)] mb-3" />
                    <div className="text-zinc-500">Languages</div>
                    <div className="mt-1 font-bold text-white">
                      {languages.length ? languages.map((lang) => lang.english_name).join(", ") : "--"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <BadgeDollarSign className="w-4 h-4 text-[oklch(0.70_0.16_195)] mb-3" />
                    <div className="text-zinc-500">{isMovie ? "Box Office" : "Seasons"}</div>
                    <div className="mt-1 font-bold text-white">
                      {isMovie ? formatBoxOfficeMillions(omdb?.boxOffice) : `${omdb?.totalSeasons || (detail as TMDbTVDetail).number_of_seasons} seasons`}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <Award className="w-4 h-4 text-[oklch(0.70_0.16_195)] mb-3" />
                    <div className="text-zinc-500">{isMovie ? "Awards" : "Last aired"}</div>
                    <div className="mt-1 font-bold text-white">
                      {isMovie ? omdb?.awards || "--" : formatDate((detail as TMDbTVDetail).last_air_date)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-3xl p-4 sm:p-6">
                <h2 className="text-xs uppercase tracking-[0.3em] text-zinc-400 mb-5">Production</h2>
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      <Building2 className="w-4 h-4 text-[oklch(0.70_0.16_195)]" /> Studios
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {studios.length ? studios.map((studio) => (
                        <span key={studio.id} className="px-3 py-1 rounded-full border border-white/10 bg-black/25 text-xs text-zinc-300">
                          {studio.name}
                        </span>
                      )) : <span className="text-sm text-zinc-500">No studio data.</span>}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                      <Clapperboard className="w-4 h-4 text-[oklch(0.70_0.16_195)]" /> Alternate titles
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-zinc-300">
                      {alternativeTitles.slice(0, 5).map((titleItem, index) => (
                        <div key={`${titleItem.iso_3166_1}-${index}`}>{titleItem.title}</div>
                      ))}
                      {!alternativeTitles.length && <div className="text-zinc-500">No alternate titles.</div>}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Where to watch</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {providers?.flatrate?.slice(0, 6).map((provider) => {
                        const logo = profileUrl(provider.logo_path, "w45");
                        return (
                          <span key={provider.provider_id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-xs text-zinc-300">
                            {logo ? (
                              <Image
                                src={logo}
                                alt=""
                                width={20}
                                height={20}
                                className="rounded-full"
                              />
                            ) : null}
                            {provider.provider_name}
                          </span>
                        );
                      })}
                      {!providers?.flatrate?.length && <span className="text-sm text-zinc-500">No US streaming providers listed.</span>}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="glass-panel rounded-3xl p-4 sm:p-6">
              <h2 className="text-xs uppercase tracking-[0.3em] text-zinc-400 mb-5">More Like This</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4">
                {recommendations.map((item) => {
                  const itemTitle = item.title || item.name || "Untitled";
                  const itemPoster = posterUrl(item.poster_path, "w342");
                  const itemType = item.media_type || mediaType;
                  return (
                    <Link key={`${itemType}-${item.id}`} href={`/media/${item.id}?type=${itemType}`} className="group">
                      <div className="aspect-2/3 rounded-2xl overflow-hidden bg-black/30 border border-white/10 transition group-hover:scale-105 group-hover:border-white/20 relative">
                        {itemPoster ? (
                          <Image
                            src={itemPoster}
                            alt={itemTitle}
                            fill
                            sizes="(max-width: 768px) 30vw, 160px"
                            unoptimized
                            className="object-cover opacity-90 group-hover:opacity-100 transition"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs text-zinc-500">No art</div>
                        )}
                      </div>
                      <div className="mt-2 text-xs font-bold text-zinc-300 truncate">{itemTitle}</div>
                    </Link>
                  );
                })}
                {!recommendations.length && <p className="text-sm text-zinc-500">No recommendations yet.</p>}
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
