import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureMediaCached } from "@/lib/media/register-media";
import type { MediaType } from "@/types/media";

type RegisterRequestBody = {
  tmdbId: number;
  mediaType: MediaType;
};


export async function POST(request: Request) {
  let body: RegisterRequestBody | null = null;

  try {
    body = (await request.json()) as RegisterRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || !body.tmdbId || !body.mediaType) {
    return NextResponse.json(
      { error: "Request body must include tmdbId and mediaType" },
      { status: 400 }
    );
  }

  if (body.mediaType !== "movie" && body.mediaType !== "tv") {
    return NextResponse.json(
      { error: "mediaType must be 'movie' or 'tv'" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();

    const cached = await ensureMediaCached(supabase, body.tmdbId, body.mediaType);
    return NextResponse.json(cached, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
