import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { slugify } from "@/lib/slug";
import { searchIgdbGames } from "@/lib/igdb";

// "Which game did you mean?" search. Returns candidates from IGDB's full
// cross-platform catalog (every game) merged with our own already-scored games,
// so the picker can show matches + near-matches BEFORE any scoring call goes
// out. Each result is tagged `cached` (instant) or new (will run the model).
export type SearchHit = {
  name: string;
  year: number | null;
  cover: string | null;
  cached: boolean;
  slug: string | null;
};

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ results: [] });

  const [igdb, cached] = await Promise.all([
    searchIgdbGames(q),
    db
      .from("games")
      .select("slug,name,release_year,thumbnail")
      .ilike("name", `%${q.replace(/[%_]/g, "")}%`)
      .order("featured_rank", { ascending: true, nullsFirst: false })
      .limit(8),
  ]);

  const bySlug = new Map<string, SearchHit>();

  // our already-scored games first — they're authoritative and score instantly
  for (const g of cached.data ?? []) {
    bySlug.set(slugify(g.name), {
      name: g.name,
      year: g.release_year ?? null,
      cover: g.thumbnail ?? null,
      cached: true,
      slug: g.slug,
    });
  }
  // then fold in IGDB candidates, flagging any we already have
  for (const c of igdb) {
    const slug = slugify(c.name);
    const hit = bySlug.get(slug);
    if (hit) {
      hit.cover ??= c.cover;
      hit.year ??= c.year;
    } else {
      bySlug.set(slug, { name: c.name, year: c.year, cover: c.cover, cached: false, slug: null });
    }
  }

  // rank: exact title match first, then already-scored, else source order
  const ql = q.toLowerCase();
  const results = [...bySlug.values()]
    .sort((a, b) => {
      const ax = Number(a.name.toLowerCase() === ql);
      const bx = Number(b.name.toLowerCase() === ql);
      if (ax !== bx) return bx - ax;
      if (a.cached !== b.cached) return a.cached ? -1 : 1;
      return 0;
    })
    .slice(0, 12);

  return NextResponse.json({ results });
}
