"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Archive, Bookmark, CheckCircle2, Heart, Loader2, Star } from "lucide-react";
import type { MediaType } from "@/types/media";

type WatchStatus = "completed" | "dropped" | "on_hold" | "plan_to_watch";

type InventoryRecord = {
  id: string;
  media_item_id: string;
  status: WatchStatus;
  rating: number | null;
  watch_dates: string[];
  is_favorite: boolean;
};

type MediaInventoryActionsProps = {
  tmdbId: number;
  mediaType: MediaType;
  initialInventory: InventoryRecord | null;
};

function getTodayInputValue() {
  const now = new Date();
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localNow.toISOString().slice(0, 10);
}

function mediaItemId(tmdbId: number, mediaType: MediaType) {
  return `${tmdbId}_${mediaType}`;
}

export function MediaInventoryActions({
  tmdbId,
  mediaType,
  initialInventory,
}: MediaInventoryActionsProps) {
  const [inventory, setInventory] = useState<InventoryRecord | null>(initialInventory);
  const [ratingDraft, setRatingDraft] = useState(
    initialInventory?.rating !== null && initialInventory?.rating !== undefined
      ? String(initialInventory.rating)
      : "8"
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const currentMediaItemId = useMemo(() => mediaItemId(tmdbId, mediaType), [tmdbId, mediaType]);
  const isWatchlisted = inventory?.status === "plan_to_watch";
  const isCompleted = inventory?.status === "completed";
  const isFavorite = Boolean(inventory?.is_favorite);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/inventory");
        if (!response.ok) return;
        const data = (await response.json()) as InventoryRecord[];
        const match = data.find((item) => item.media_item_id === currentMediaItemId) || null;
        setInventory(match);
        if (match?.rating !== null && match?.rating !== undefined) {
          setRatingDraft(String(match.rating));
        }
      } catch {
        return;
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [currentMediaItemId]);

  const saveInventory = async (
    action: string,
    payload: {
      status?: WatchStatus;
      rating?: number | null;
      watchDates?: string[];
      isFavorite?: boolean;
    }
  ) => {
    setNotice(null);
    setBusyAction(action);

    try {
      const response = await fetch(inventory ? `/api/inventory/${inventory.id}` : "/api/inventory", {
        method: inventory ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId,
          mediaType,
          status: payload.status || inventory?.status || "completed",
          rating: payload.rating !== undefined ? payload.rating : inventory?.rating ?? null,
          watchDates:
            payload.watchDates !== undefined
              ? payload.watchDates
              : inventory?.watch_dates || [],
          isFavorite:
            payload.isFavorite !== undefined
              ? payload.isFavorite
              : inventory?.is_favorite ?? false,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "Could not update this title");
      }

      const updated = (await response.json()) as InventoryRecord;
      setInventory(updated);
      setNotice("Saved");
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "Could not update this title");
    } finally {
      setBusyAction(null);
    }
  };

  const saveRating = () => {
    const parsedRating = Number(ratingDraft);
    if (!Number.isFinite(parsedRating)) {
      setNotice("Enter a valid rating");
      return;
    }

    void saveInventory("rate", {
      rating: Math.min(10, Math.max(0, parsedRating)),
      status: inventory?.status || "completed",
    });
  };

  const actionButtonClass =
    "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="glass-panel rounded-3xl p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void saveInventory("inventory", { status: "completed" })}
            disabled={busyAction !== null}
            className={`${actionButtonClass} ${
              isCompleted
                ? "border-[oklch(0.75_0.15_140)]/40 bg-[oklch(0.75_0.15_140)]/10 text-[oklch(0.75_0.15_140)]"
                : "border-white/10 bg-white/5 text-zinc-200 hover:border-[oklch(0.75_0.15_140)]/40 hover:text-[oklch(0.75_0.15_140)]"
            }`}
          >
            {busyAction === "inventory" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            Add to Inventory
          </button>

          <button
            type="button"
            onClick={() =>
              void saveInventory("watched", {
                status: "completed",
                watchDates: inventory?.watch_dates?.length
                  ? inventory.watch_dates
                  : [getTodayInputValue()],
              })
            }
            disabled={busyAction !== null}
            className={`${actionButtonClass} border-[oklch(0.75_0.15_140)]/30 bg-[oklch(0.75_0.15_140)]/10 text-[oklch(0.75_0.15_140)] hover:bg-[oklch(0.75_0.15_140)]/15`}
          >
            {busyAction === "watched" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Mark Watched
          </button>

          <button
            type="button"
            onClick={() => void saveInventory("watchlist", { status: "plan_to_watch", watchDates: [] })}
            disabled={busyAction !== null}
            className={`${actionButtonClass} ${
              isWatchlisted
                ? "border-[oklch(0.78_0.14_75)]/40 bg-[oklch(0.78_0.14_75)]/10 text-[oklch(0.78_0.14_75)]"
                : "border-white/10 bg-white/5 text-zinc-200 hover:border-[oklch(0.78_0.14_75)]/40 hover:text-[oklch(0.78_0.14_75)]"
            }`}
          >
            {busyAction === "watchlist" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className="h-4 w-4" />}
            Add to Watchlist
          </button>

          <button
            type="button"
            onClick={() => void saveInventory("favorite", { isFavorite: !isFavorite })}
            disabled={busyAction !== null}
            className={`${actionButtonClass} ${
              isFavorite
                ? "border-rose-400/40 bg-rose-500/10 text-rose-300"
                : "border-white/10 bg-white/5 text-zinc-200 hover:border-rose-400/40 hover:text-rose-300"
            }`}
          >
            {busyAction === "favorite" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />}
            Favorite
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <Star className="h-4 w-4 shrink-0 text-amber-300 fill-current" />
            <span className="text-sm font-bold text-zinc-300">Rate</span>
            <input
              type="number"
              min="0"
              max="10"
              step="0.5"
              value={ratingDraft}
              onChange={(event) => setRatingDraft(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none"
            />
            <span className="text-xs text-zinc-500">/10</span>
          </label>
          <button
            type="button"
            onClick={saveRating}
            disabled={busyAction !== null}
            className={`${actionButtonClass} border-[oklch(0.70_0.16_195)]/40 bg-[oklch(0.70_0.16_195)]/15 text-[oklch(0.70_0.16_195)] hover:bg-[oklch(0.70_0.16_195)]/25`}
          >
            {busyAction === "rate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
            Save Rating
          </button>
        </div>

        {notice && (
          <div className="text-xs font-semibold text-zinc-400">
            {notice}
          </div>
        )}
      </div>
    </div>
  );
}
