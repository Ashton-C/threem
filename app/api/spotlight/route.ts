import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic"; // fresh random sample per request

// 3 random games from the curated top-50 (seeded via npm run seed:top50).
export async function GET() {
  const { data, error } = await db
    .from("games")
    .select("id,name,micro,meso,macro,thumbnail,release_year")
    .not("featured_rank", "is", null);

  if (error || !data?.length) return NextResponse.json({ games: [] });

  const pool = [...data];
  const picks = [];
  while (picks.length < 3 && pool.length) {
    picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return NextResponse.json({ games: picks });
}
