import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// Autocomplete against games already cached in the DB.
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "")
    .trim()
    .replace(/[%_]/g, "") // strip LIKE wildcards from user input
    .slice(0, 60);
  if (q.length < 2) return NextResponse.json({ suggestions: [] });

  const { data } = await db
    .from("games")
    .select("name")
    .ilike("name", `%${q}%`)
    .order("featured_rank", { ascending: true, nullsFirst: false })
    .limit(6);

  return NextResponse.json({ suggestions: (data ?? []).map((g) => g.name) });
}
