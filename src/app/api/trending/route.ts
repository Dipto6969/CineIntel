import { NextResponse } from "next/server";
import { getTrending } from "@/services/tmdb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeWindow = searchParams.get("timeWindow") === "week" ? "week" : "day";
  const page = parseInt(searchParams.get("page") || "1", 10);

  try {
    const data = await getTrending(timeWindow, page);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch trending";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
