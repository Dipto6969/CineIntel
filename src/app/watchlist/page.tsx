"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/auth-provider";
import { Navbar } from "@/components/layout/Navbar";
import {
  Bookmark,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";

type MediaType = "movie" | "tv";
type WatchStatus = "completed" | "dropped" | "on_hold" | "plan_to_watch";

type MediaItem = {
  id: string;
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  original_title: string | null;
  release_date: string | null;
  poster_path: string | null;
  vote_average: number | null;
  runtime: number | null;
};

type InventoryItem = {
  id: string;
  status: WatchStatus;
  rating: number | null;
  watch_dates: string[];
  rewatch_count: number;
  notes: string | null;
  is_favorite: boolean;
  media_item?: MediaItem | null;
};

const STATUS_STYLES: Record<WatchStatus, string> = {
  completed: "text-[oklch(0.75_0.15_140)] border-[oklch(0.75_0.15_140)]/30",
  plan_to_watch: "text-[oklch(0.78_0.14_75)] border-[oklch(0.78_0.14_75)]/30",
  on_hold: "text-[oklch(0.68_0.15_230)] border-[oklch(0.68_0.15_230)]/30",
  dropped: "text-[oklch(0.65_0.18_25)] border-[oklch(0.65_0.18_25)]/30",
};

function posterUrl(path: string | null, size: "w342" = "w342") {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export default function WatchlistPage() {
  const { loading } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const watchlistItems = useMemo(
    () => inventory.filter((item) => item.status === "plan_to_watch"),
    [inventory]
  );

  const confirmDeleteWatchlist = () =>
    window.confirm("Remove this title from your watchlist? This cannot be undone.");

  const refreshInventory = async () => {
    setNotice(null);
    setIsLoadingInventory(true);
    try {
      const response = await fetch("/api/inventory");
      if (!response.ok) {
        throw new Error("Failed to load inventory");
      }
      const data = (await response.json()) as InventoryItem[];
      setInventory(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load inventory";
      setNotice(message);
    } finally {
      setIsLoadingInventory(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshInventory();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleDeleteInventory = async (inventoryId: string) => {
    setNotice(null);
    try {
      const response = await fetch(`/api/inventory/${inventoryId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to remove item");
      }
      await refreshInventory();
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "Failed to remove item");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#050608] text-white font-sans">
        <div className="w-8 h-8 border-4 border-[oklch(0.70_0.16_195)] border-t-transparent rounded-full animate-spin mb-4" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#050608] text-zinc-100 flex flex-col font-sans selection:bg-[oklch(0.70_0.16_195)]/30 selection:text-white pb-10">
      <Navbar transparentOnTop={false} />

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-6 md:px-12 py-10 mt-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[oklch(0.78_0.14_75)]/10 border border-[oklch(0.78_0.14_75)]/20 rounded-full text-xs text-[oklch(0.78_0.14_75)] font-semibold mb-4">
              <Bookmark className="w-3.5 h-3.5" />
              <span>Future Queue</span>
            </div>
            <h1 className="text-4xl font-black text-white">Your Watchlist</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Movies and series you want to watch later live here.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/inventory"
              className="flex items-center gap-2 px-4 py-2 border border-[oklch(0.75_0.15_140)]/30 rounded-xl text-xs text-[oklch(0.75_0.15_140)] hover:bg-[oklch(0.75_0.15_140)]/10 transition"
            >
              Watched Inventory
            </Link>
            <button
              onClick={refreshInventory}
              disabled={isLoadingInventory}
              className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-xl text-xs text-zinc-300 hover:bg-white/5 transition"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingInventory ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {notice && (
          <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-sm text-rose-300">
            {notice}
          </div>
        )}

        {watchlistItems.length === 0 && !isLoadingInventory ? (
          <div className="py-24 text-center border-2 border-dashed border-white/10 rounded-3xl">
            <Bookmark className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No future titles yet</h3>
            <p className="text-zinc-500 text-sm max-w-md mx-auto mb-6">
              Add movies or series you still want to watch. Already seen something? Put it in your watched inventory instead.
            </p>
            <Link href="/search" className="inline-flex items-center px-6 py-3 bg-[oklch(0.70_0.16_195)] text-black font-bold rounded-xl active:scale-95 transition">
              <Search className="w-4 h-4 mr-2" />
              Explore Collections
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {watchlistItems.map((item) => {
              const po = posterUrl(item.media_item?.poster_path || null, "w342");
              return (
                <div key={item.id} className="group/card relative flex flex-col gap-3">
                  <Link href={`/media/${item.media_item?.tmdb_id}?type=${item.media_item?.media_type}`}>
                    <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden bg-[#11131a] border border-white/5 relative transition-all duration-300 group-hover/card:scale-105 group-hover/card:shadow-[0_8px_30px_rgba(0,0,0,0.5)] group-hover/card:z-10 group-hover/card:border-white/20">
                      {po ? (
                        <img src={po} alt={item.media_item?.title || "Poster"} className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110 opacity-90 group-hover/card:opacity-100" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-zinc-700 font-semibold">NO ART</div>
                      )}
                      <div className="absolute top-2 left-2 right-2 flex justify-between z-20">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase backdrop-blur-md bg-black/60 border ${STATUS_STYLES[item.status]}`}>
                          {item.status.replace("_", " ")}
                        </span>
                      </div>
                      
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 pointer-events-none">
                        <p className="text-white font-bold text-sm line-clamp-2 leading-tight drop-shadow-md">{item.media_item?.title || "Untitled"}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {item.rating && (
                            <span className="text-xs font-bold text-amber-400 drop-shadow-md">★ {item.rating}</span>
                          )}
                          <span className="text-xs font-medium text-zinc-300 drop-shadow-md">
                            {item.media_item?.release_date?.slice(0, 4) || "--"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold text-white leading-tight line-clamp-1 group-hover/card:text-[oklch(0.70_0.16_195)] transition">
                      {item.media_item?.title || "Untitled"}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        if (!confirmDeleteWatchlist()) return;
                        handleDeleteInventory(item.id);
                      }}
                      className="opacity-0 group-hover/card:opacity-100 text-rose-400 hover:text-rose-300 transition-opacity p-1 rounded-md hover:bg-rose-500/10 z-20"
                      title="Remove from Watchlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
