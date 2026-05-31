import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureMediaCached } from "@/lib/media/register-media";
import type { MediaType } from "@/types/media";

type InventoryCreateBody = {
  tmdbId?: number;
  mediaType?: MediaType;
  mediaItemId?: string;
  status: "completed" | "dropped" | "on_hold" | "plan_to_watch";
  rating?: number | null;
  watchDates?: string[];
  notes?: string | null;
  review?: string | null;
  isFavorite?: boolean;
  languageWatchedIn?: string | null;
  tagIds?: string[];
};

type InventoryUpdateBody = Partial<Omit<InventoryCreateBody, "tmdbId" | "mediaType" | "mediaItemId">>;

type TagValue = { id: string; name: string };

type TagLink = {
  inventory_id: string;
  tag: TagValue | TagValue[] | null;
};

function sanitizeWatchDates(value?: string[]): string[] {
  if (!value) return [];
  return value.map((item) => item.trim()).filter((item) => item.length > 0);
}

function computeRewatchCount(watchDates: string[]): number {
  return watchDates.length > 1 ? watchDates.length - 1 : 0;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { supabase, user };
}

async function registerMedia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tmdbId: number,
  mediaType: MediaType
) {
  return ensureMediaCached(supabase, tmdbId, mediaType);
}

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, user } = auth;

  const { data: inventory, error } = await supabase
    .from("user_inventory")
    .select("*, media_item:media_items(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!inventory || inventory.length === 0) {
    return NextResponse.json([]);
  }

  const inventoryIds = inventory.map((item) => item.id);

  const { data: tagLinks, error: tagError } = await supabase
    .from("inventory_tags")
    .select("inventory_id, tag:tags(id, name)")
    .in("inventory_id", inventoryIds);

  if (tagError) {
    return NextResponse.json({ error: tagError.message }, { status: 500 });
  }

  const tagsByInventory = new Map<string, { id: string; name: string }[]>();
  (tagLinks as TagLink[] | null)?.forEach((link) => {
    if (!link.tag) return;
    const existing = tagsByInventory.get(link.inventory_id) || [];
    const tags = Array.isArray(link.tag) ? link.tag : [link.tag];
    existing.push(...tags);
    tagsByInventory.set(link.inventory_id, existing);
  });

  const enriched = inventory.map((item) => ({
    ...item,
    tags: tagsByInventory.get(item.id) || [],
  }));

  return NextResponse.json(enriched);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, user } = auth;

  let body: InventoryCreateBody | null = null;

  try {
    body = (await request.json()) as InventoryCreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || !body.status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  if (!body.mediaItemId && (!body.tmdbId || !body.mediaType)) {
    return NextResponse.json(
      { error: "Provide mediaItemId or tmdbId + mediaType" },
      { status: 400 }
    );
  }

  const mediaType = body.mediaType;

  if (mediaType && mediaType !== "movie" && mediaType !== "tv") {
    return NextResponse.json(
      { error: "mediaType must be 'movie' or 'tv'" },
      { status: 400 }
    );
  }

  if (body.tmdbId && mediaType) {
    try {
      await registerMedia(supabase, body.tmdbId, mediaType);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Register failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const mediaItemId =
    body.mediaItemId || `${body.tmdbId}_${body.mediaType}`;

  const watchDates = sanitizeWatchDates(body.watchDates);

  const payload = {
    user_id: user.id,
    media_item_id: mediaItemId,
    status: body.status,
    rating: body.rating ?? null,
    watch_dates: watchDates,
    rewatch_count: computeRewatchCount(watchDates),
    notes: body.notes ?? null,
    review: body.review ?? null,
    language_watched_in: body.languageWatchedIn ?? "en",
    is_favorite: body.isFavorite ?? false,
  };

  const { data: inserted, error } = await supabase
    .from("user_inventory")
    .insert(payload)
    .select("*, media_item:media_items(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.tagIds && body.tagIds.length > 0) {
    const tagLinks = body.tagIds.map((tagId) => ({
      inventory_id: inserted.id,
      tag_id: tagId,
    }));

    const { error: tagError } = await supabase
      .from("inventory_tags")
      .insert(tagLinks);

    if (tagError) {
      return NextResponse.json({ error: tagError.message }, { status: 500 });
    }
  }

  const { data: tagLinks, error: tagFetchError } = await supabase
    .from("inventory_tags")
    .select("inventory_id, tag:tags(id, name)")
    .eq("inventory_id", inserted.id);

  if (tagFetchError) {
    return NextResponse.json({ error: tagFetchError.message }, { status: 500 });
  }

  const tags = (tagLinks as TagLink[] | null)
    ?.flatMap((link) => {
      if (!link.tag) return [];
      return Array.isArray(link.tag) ? link.tag : [link.tag];
    })
    .filter(Boolean);

  return NextResponse.json({ ...inserted, tags: tags || [] }, { status: 201 });
}

export type { InventoryUpdateBody };
