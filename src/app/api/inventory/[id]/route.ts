import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type InventoryUpdateBody = {
  status?: "completed" | "dropped" | "on_hold" | "plan_to_watch";
  rating?: number | null;
  watchDates?: string[];
  notes?: string | null;
  review?: string | null;
  isFavorite?: boolean;
  languageWatchedIn?: string | null;
};

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, user } = auth;
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Inventory id is required" }, { status: 400 });
  }

  let body: InventoryUpdateBody & { tagIds?: string[] } | null = null;

  try {
    body = (await request.json()) as InventoryUpdateBody & { tagIds?: string[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body) {
    return NextResponse.json({ error: "Request body is required" }, { status: 400 });
  }

  const watchDates = sanitizeWatchDates(body.watchDates);

  const payload: Record<string, unknown> = {};

  if (body.status) payload.status = body.status;
  if (body.rating !== undefined) payload.rating = body.rating;
  if (body.notes !== undefined) payload.notes = body.notes;
  if (body.review !== undefined) payload.review = body.review;
  if (body.isFavorite !== undefined) payload.is_favorite = body.isFavorite;
  if (body.languageWatchedIn !== undefined) {
    payload.language_watched_in = body.languageWatchedIn;
  }
  if (body.watchDates !== undefined) {
    payload.watch_dates = watchDates;
    payload.rewatch_count = computeRewatchCount(watchDates);
  }

  const { data: updated, error } = await supabase
    .from("user_inventory")
    .update(payload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*, media_item:media_items(*)")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.tagIds) {
    const { error: deleteError } = await supabase
      .from("inventory_tags")
      .delete()
      .eq("inventory_id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    if (body.tagIds.length > 0) {
      const tagLinks = body.tagIds.map((tagId) => ({
        inventory_id: id,
        tag_id: tagId,
      }));

      const { error: tagInsertError } = await supabase
        .from("inventory_tags")
        .insert(tagLinks);

      if (tagInsertError) {
        return NextResponse.json({ error: tagInsertError.message }, { status: 500 });
      }
    }
  }

  const { data: tagLinks, error: tagError } = await supabase
    .from("inventory_tags")
    .select("inventory_id, tag:tags(id, name)")
    .eq("inventory_id", id);

  if (tagError) {
    return NextResponse.json({ error: tagError.message }, { status: 500 });
  }

  const tags = (tagLinks as TagLink[] | null)
    ?.flatMap((link) => {
      if (!link.tag) return [];
      return Array.isArray(link.tag) ? link.tag : [link.tag];
    })
    .filter(Boolean);

  return NextResponse.json({ ...updated, tags: tags || [] });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireUser();
  if ("error" in auth) {
    return auth.error;
  }

  const { supabase, user } = auth;
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Inventory id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("user_inventory")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
