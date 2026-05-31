"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Archive, Bookmark, CheckCircle2, Heart, Loader2, Plus, Star, X } from "lucide-react";
import type { MediaType } from "@/types/media";
import { CUSTOM_TAG_SUGGESTIONS, formatTagLabel, normalizeTagKey } from "@/lib/tags";

type WatchStatus = "completed" | "dropped" | "on_hold" | "plan_to_watch";

type TagValue = { id: string; name: string };

type InventoryRecord = {
  id: string;
  media_item_id: string;
  status: WatchStatus;
  rating: number | null;
  watch_dates: string[];
  is_favorite: boolean;
  tags: TagValue[];
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
  const [availableTags, setAvailableTags] = useState<TagValue[]>(initialInventory?.tags || []);
  const [selectedTags, setSelectedTags] = useState<TagValue[]>(initialInventory?.tags || []);
  const [tagDraft, setTagDraft] = useState("");
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
        if (match?.tags?.length) {
          setSelectedTags(match.tags);
        }
        if (match?.rating !== null && match?.rating !== undefined) {
          setRatingDraft(String(match.rating));
        }
      } catch {
        return;
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [currentMediaItemId]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/tags");
        if (!response.ok) return;
        const data = (await response.json()) as TagValue[];
        setAvailableTags(data || []);
      } catch {
        return;
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const selectedTagKeySet = useMemo(
    () => new Set(selectedTags.map((tag) => normalizeTagKey(tag.name))),
    [selectedTags]
  );

  const allTagOptions = useMemo(() => {
    const combined = [...availableTags];
    const seen = new Set(combined.map((tag) => normalizeTagKey(tag.name)));

    for (const tagName of CUSTOM_TAG_SUGGESTIONS) {
      const key = normalizeTagKey(tagName);
      if (!seen.has(key)) {
        combined.push({ id: key, name: tagName });
        seen.add(key);
      }
    }

    return combined.sort((a, b) => a.name.localeCompare(b.name));
  }, [availableTags]);

  const addTagByName = async (rawName: string) => {
    const name = formatTagLabel(rawName);
    if (!name) return;

    const normalized = normalizeTagKey(name);
    const existingSelected = selectedTags.find((tag) => normalizeTagKey(tag.name) === normalized);
    if (existingSelected) return;

    let tag = availableTags.find((entry) => normalizeTagKey(entry.name) === normalized) || null;

    if (!tag) {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "Could not create tag");
      }

      tag = (await response.json()) as TagValue;
      setAvailableTags((current) => {
        if (current.some((entry) => normalizeTagKey(entry.name) === normalized)) return current;
        return [...current, tag as TagValue];
      });
    }

    setSelectedTags((current) => [...current, tag as TagValue].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const commitTagDraft = async () => {
    const next = tagDraft.replace(/,$/, "").trim();
    if (!next) return;

    try {
      await addTagByName(next);
      setTagDraft("");
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "Could not add tag");
    }
  };

  const toggleTag = async (tagName: string) => {
    const normalized = normalizeTagKey(tagName);
    const existing = selectedTags.find((tag) => normalizeTagKey(tag.name) === normalized);
    if (existing) {
      setSelectedTags((current) => current.filter((tag) => normalizeTagKey(tag.name) !== normalized));
      return;
    }

    await addTagByName(tagName);
  };

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
          tagIds: selectedTags.map((tag) => tag.id),
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "Could not update this title");
      }

      const updated = (await response.json()) as InventoryRecord;
      setInventory(updated);
      if (updated.tags?.length) {
        setSelectedTags(updated.tags);
      }
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

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Custom tags</div>
              <div className="text-xs text-zinc-600 mt-1">Add tags like courtroom, time travel, or psychological.</div>
            </div>
            {selectedTags.length > 0 ? (
              <button
                type="button"
                onClick={() => setSelectedTags([])}
                className="text-xs font-semibold text-zinc-500 hover:text-zinc-200"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => void toggleTag(tag.name)}
                className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.70_0.16_195)]/30 bg-[oklch(0.70_0.16_195)]/10 px-3 py-1.5 text-xs font-semibold text-[oklch(0.70_0.16_195)]"
                title="Remove tag"
              >
                {tag.name}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  void commitTagDraft();
                }
              }}
              className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[oklch(0.70_0.16_195)]"
              placeholder="Type a tag and press Enter"
            />
            <button
              type="button"
              onClick={() => void commitTagDraft()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-zinc-200 hover:border-[oklch(0.70_0.16_195)]/30 hover:text-white"
            >
              <Plus className="h-4 w-4" />
              Add Tag
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {allTagOptions.slice(0, 16).map((tag) => {
              const active = selectedTagKeySet.has(normalizeTagKey(tag.name));
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => void toggleTag(tag.name)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-[oklch(0.70_0.16_195)]/30 bg-[oklch(0.70_0.16_195)]/10 text-[oklch(0.70_0.16_195)]"
                      : "border-white/10 bg-white/5 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                  }`}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
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
