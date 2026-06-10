import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// Top featured games strong on a given axis — used to recommend games
// that would round out a user's weakest axis.
export async function GET(req: NextRequest) {
  const axis = req.nextUrl.searchParams.get("axis") ?? "";
  if (!["micro", "meso", "macro"].includes(axis))
    return NextResponse.json({ games: [] });

  const { data } = await db
    .from("games")
    .select("id,slug,name,micro,meso,macro,thumbnail")
    .not("featured_rank", "is", null)
    .order(axis, { ascending: false })
    .limit(12);

  return NextResponse.json({ games: data ?? [] });
}
