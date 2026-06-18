"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/auth-provider";
import { Navbar } from "@/components/layout/Navbar";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import {
  ChevronRight,
  Film,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import type { TMDbSearchResponse, TMDbSearchResult } from "@/types/tmdb";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, FreeMode, Mousewheel } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/free-mode";
import type { DiscoverySectionKey } from "@/features/discovery/saved-queries";

type HomeDiscoverySection = {
  key: DiscoverySectionKey;
  title: string;
  description: string;
  exploreHref: string;
  items: TMDbSearchResult[];
};

type InventoryRecord = {
  id: string;
  media_item_id: string;
  status: "completed" | "dropped" | "on_hold" | "plan_to_watch";
};

function posterUrl(path: string | null, size: "w342" = "w342") {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function getTitle(item: TMDbSearchResult) {
  return item.media_type === "movie" ? item.title || "Untitled" : item.name || "Untitled";
}

function getYear(item: TMDbSearchResult) {
  const date = item.media_type === "movie" ? item.release_date : item.first_air_date;
  return date ? date.slice(0, 4) : "";
}

function buildHeroItems(items: TMDbSearchResult[]) {
  const candidates = items.filter((item) => item.backdrop_path || item.poster_path);
  const selected = candidates.slice(0, 10);
  if (selected.length <= 1) {
    return selected;
  }

  const hasMovie = selected.some((item) => item.media_type === "movie");
  const hasTv = selected.some((item) => item.media_type === "tv");

  if (!hasMovie) {
    const movie = candidates.find((item) => item.media_type === "movie");
    if (movie) {
      selected[selected.length - 1] = movie;
    }
  }

  if (!hasTv) {
    const tv = candidates.find((item) => item.media_type === "tv");
    if (tv) {
      selected[selected.length - 1] = tv;
    }
  }

  return selected;
}

function DiscoveryShelf({
  title,
  description,
  items,
  href,
}: {
  title: string;
  description: string;
  items: TMDbSearchResult[];
  href: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-4 pt-10">
      <div className="flex items-end justify-between px-6 md:px-12 w-full max-w-400 mx-auto">
        <div className="space-y-1">
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">{title}</h2>
          <p className="text-sm text-zinc-500 max-w-2xl leading-relaxed">{description}</p>
        </div>
        <Link href={href} className="text-xs font-semibold text-zinc-400 hover:text-white transition flex items-center gap-1 group">
          Explore all <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
      <div className="w-full relative px-6 md:px-12 max-w-400 mx-auto group">
        <Swiper
          modules={[Navigation, FreeMode, Mousewheel]}
          navigation
          freeMode={true}
          mousewheel={{ forceToAxis: true }}
          slidesPerView="auto"
          spaceBetween={16}
          className="media-swiper pb-8!"
        >
          {items.map((item) => {
            const po = posterUrl(item.poster_path);
            return (
              <SwiperSlide key={`${item.media_type}-${item.id}`} className="w-35! md:w-50!">
                <Link
                  href={`/media/${item.id}?type=${item.media_type}`}
                  className="group/card relative block"
                >
                  <div className="aspect-2/3 w-full rounded-2xl overflow-hidden bg-[#11131a] border border-white/5 relative transition-all duration-300 group-hover/card:scale-105 group-hover/card:shadow-[0_8px_30px_rgba(0,0,0,0.5)] group-hover/card:z-10 group-hover/card:border-white/20">
                    {po ? (
                      <Image
                        src={po}
                        alt={getTitle(item)}
                        fill
                        sizes="(max-width: 768px) 35vw, 200px"
                        unoptimized
                        className="object-cover transition-transform duration-500 group-hover/card:scale-110 opacity-90 group-hover/card:opacity-100"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs font-semibold">NO ART</div>
                    )}
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                      <p className="text-white font-bold text-sm line-clamp-2 leading-tight drop-shadow-md">{getTitle(item)}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs font-bold text-amber-400 drop-shadow-md">★ {item.vote_average.toFixed(1)}</span>
                        <span className="text-xs font-medium text-zinc-300 drop-shadow-md">{getYear(item)}</span>
                      </div>
                    </div>
                    {/* Persistent Rating Badge */}
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md rounded-md px-1.5 py-0.5 border border-white/10 group-hover/card:opacity-0 transition-opacity">
                      <span className="text-[10px] font-bold text-white">{item.vote_average.toFixed(1)}</span>
                    </div>
                  </div>
                </Link>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </div>
    </section>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [trending, setTrending] = useState<TMDbSearchResult[]>([]);
  const [sections, setSections] = useState<HomeDiscoverySection[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [savingWatchlistId, setSavingWatchlistId] = useState<string | null>(null);

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        const res = await fetch("/api/trending?timeWindow=day");
        if (res.ok) {
          const data = await res.json() as TMDbSearchResponse;
          setTrending(data.results || []);
        }
      } catch (err) {
        console.error("Failed to load trending", err);
      }
    };
    fetchHomeData();
  }, []);

  useEffect(() => {
    const fetchDiscoverySections = async () => {
      try {
        const response = await fetch("/api/home/discovery");
        if (!response.ok) return;
        const payload = (await response.json()) as { sections?: HomeDiscoverySection[] };
        setSections(payload.sections || []);
      } catch {
        setSections([]);
      }
    };

    void fetchDiscoverySections();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const fetchInventory = async () => {
      try {
        const response = await fetch("/api/inventory");
        if (!response.ok) return;
        const data = (await response.json()) as InventoryRecord[];
        setInventory(data);
      } catch {
        setInventory([]);
      }
    };

    void fetchInventory();
  }, [user]);

  const visibleInventory = useMemo(() => (user ? inventory : []), [user, inventory]);

  const inventoryByMediaId = useMemo(() => {
    const map = new Map<string, InventoryRecord>();
    visibleInventory.forEach((item) => map.set(item.media_item_id, item));
    return map;
  }, [visibleInventory]);

  const watchlistedIds = useMemo(
    () => visibleInventory.filter((item) => item.status === "plan_to_watch").map((item) => item.media_item_id),
    [visibleInventory]
  );

  const heroItems = useMemo(() => buildHeroItems(trending), [trending]);

  const handleAddToWatchlist = async (item: TMDbSearchResult) => {
    const key = `${item.id}_${item.media_type}`;
    const existing = inventoryByMediaId.get(key);
    setSavingWatchlistId(key);

    try {
      const response = await fetch(existing ? `/api/inventory/${existing.id}` : "/api/inventory", {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: item.id,
          mediaType: item.media_type,
          status: "plan_to_watch",
          watchDates: [],
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "Failed to update watchlist");
      }

      const refreshResponse = await fetch("/api/inventory");
      if (refreshResponse.ok) {
        const refreshed = (await refreshResponse.json()) as InventoryRecord[];
        setInventory(refreshed);
      }
    } catch (error) {
      console.error("Failed to update watchlist", error);
    } finally {
      setSavingWatchlistId(null);
    }
  };
  return (
    <div className="min-h-screen w-full bg-[#050608] text-zinc-100 font-sans selection:bg-[oklch(0.70_0.16_195)]/30 selection:text-white pb-10">
      
      <Navbar transparentOnTop={true} />

      {/* Hero Section */}
      <section className="relative w-full mb-10 overflow-hidden px-6 md:px-12 max-w-400 mx-auto">
        <HeroCarousel
          items={heroItems}
          sourceLabel="Trending"
          watchlistedIds={watchlistedIds}
          busyWatchlistId={savingWatchlistId}
          onAddToWatchlist={handleAddToWatchlist}
        />
      </section>

      {/* Dynamic Discovery Rows */}
      <main className="relative z-20 pb-20 -mt-16 sm:-mt-24 space-y-4">
        {sections.map((section) => (
          <DiscoveryShelf
            key={section.key}
            title={section.title}
            description={section.description}
            items={section.items}
            href={section.exploreHref}
          />
        ))}

        {/* Global Filter / Command Center CTA */}
        <section className="px-6 md:px-12 max-w-400 mx-auto mt-32 text-center">
          <div className="p-8 md:p-20 rounded-[3rem] bg-linear-to-tr from-[oklch(0.70_0.16_195)]/20 via-[#0a0c10] to-[#050608] border border-[oklch(0.70_0.16_195)]/20 relative overflow-hidden group shadow-2xl">
            <div className="absolute top-0 right-0 w-160 h-160 bg-[oklch(0.70_0.16_195)]/10 rounded-full blur-[120px] pointer-events-none transition-opacity duration-700 group-hover:opacity-80" />
            <div className="absolute bottom-0 left-0 w-120 h-120 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
            
            <div className="relative z-10">
              <Sparkles className="w-12 h-12 text-[oklch(0.70_0.16_195)] mx-auto mb-8 opacity-90 drop-shadow-lg" />
              <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight drop-shadow-xl">
                Looking for something specific?
              </h2>
              <p className="text-zinc-400 max-w-2xl mx-auto mb-10 text-lg md:text-xl leading-relaxed">
                Our advanced discovery engine lets you filter by mood, decade, genre, language, and precise ratings to build your ultimate universe.
              </p>
              <Link
                href="/search"
                className="inline-flex items-center gap-3 px-10 py-5 rounded-full bg-[oklch(0.70_0.16_195)] text-black text-lg font-extrabold hover:bg-[oklch(0.75_0.15_140)] transition-all shadow-[0_0_40px_rgba(0,180,216,0.3)] hover:shadow-[0_0_60px_rgba(0,180,216,0.5)] active:scale-95"
              >
                Launch Query Terminal
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Elegant Footer */}
      <footer className="border-t border-white/5 pt-12 pb-20 px-6 md:px-12 w-full max-w-400 mx-auto bg-[#050608] relative z-20">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
            <Film className="w-5 h-5 text-zinc-300" />
            <span className="font-black text-sm tracking-[0.2em] text-zinc-300 uppercase">CineIntel OS</span>
          </div>
          <p className="text-xs text-zinc-600 font-medium text-center md:text-left max-w-lg">
            Data and imagery provided by TMDb. This product uses the TMDb API but is not endorsed or certified by TMDb.
          </p>
          <div className="flex items-center gap-6 text-sm font-semibold text-zinc-500">
            <Link href="#" className="hover:text-white transition">About</Link>
            <Link href="#" className="hover:text-white transition">Privacy</Link>
            <Link href="#" className="hover:text-white transition">GitHub</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}