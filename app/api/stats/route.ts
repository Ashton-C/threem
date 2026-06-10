import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { computeStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

// Catalog-wide stats for the home data strip.
export async function GET() {
  const { data } = await db.from("games").select("micro,meso,macro,genre");
  const stats = computeStats(data ?? []);
  return NextResponse.json({
    total: stats.total,
    avg: stats.avg,
    genres: stats.genres.slice(0, 10),
  });
}
