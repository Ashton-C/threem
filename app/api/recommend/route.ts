import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";

// Recommendations drawn from the curated top-50 pool.
//   ?axis=macro            -> strongest on that axis (round out a weak axis)
//   ?near=4.2,5.1,8.0      -> closest to a point in 3M space (more of what you like)
export async function GET(req: NextRequest) {
  const axis = req.nextUrl.searchParams.get("axis");
  const near = req.nextUrl.searchParams.get("near");

  const base = db
    .from("games")
    .select("id,slug,name,micro,meso,macro,thumbnail")
    .not("featured_rank", "is", null);

  if (axis && ["micro", "meso", "macro"].includes(axis)) {
    const { data } = await base.order(axis, { ascending: false }).limit(12);
    return NextResponse.json({ games: data ?? [] });
  }

  if (near) {
    const pt = near.split(",").map(Number);
    if (pt.length !== 3 || pt.some((n) => !Number.isFinite(n)))
      return NextResponse.json({ games: [] });
    const [m, me, ma] = pt;
    const { data } = await base;
    const sorted = (data ?? [])
      .map((g) => ({
        g,
        d: (g.micro - m) ** 2 + (g.meso - me) ** 2 + (g.macro - ma) ** 2,
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 12)
      .map((x) => x.g);
    return NextResponse.json({ games: sorted });
  }

  return NextResponse.json({ games: [] });
}
