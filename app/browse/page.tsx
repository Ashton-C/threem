import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { db } from "@/lib/supabase";
import GameGrid, { type GridRow } from "@/components/GameGrid";

export const dynamic = "force-dynamic";

const AXIS_LABEL: Record<string, string> = {
  micro: "Micro",
  meso: "Meso",
  macro: "Macro",
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const title = sp.genre ?? sp.publisher ?? (sp.top ? "Top 50" : "Browse");
  return { title: `${title} — 3M` };
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const genre = sp.genre?.slice(0, 60);
  const publisher = sp.publisher?.slice(0, 80);
  const top = sp.top != null;
  const sort = ["micro", "meso", "macro"].includes(sp.sort ?? "") ? sp.sort! : null;
  // axis range filters: ?min_macro=8 etc. clamp to 0..10
  const clamp = (v?: string) => {
    if (v == null) return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : null;
  };
  const ranges = (["micro", "meso", "macro"] as const).map((ax) => ({
    ax,
    min: clamp(sp[`min_${ax}`]),
    max: clamp(sp[`max_${ax}`]),
  }));

  let q = db
    .from("games")
    .select("id,slug,name,micro,meso,macro,thumbnail,genre,subgenres,release_year,featured_rank");

  let heading: string;
  if (sort) {
    q = q.order(sort, { ascending: false }).order("name").limit(100);
    heading = `Most ${AXIS_LABEL[sort]}`;
  } else if (top) {
    q = q.not("featured_rank", "is", null).order("featured_rank", { ascending: true });
    heading = "Top 50";
  } else if (publisher) {
    // values are passed as bound params by supabase-js (no SQL injection)
    q = q.eq("publisher", publisher).order("name");
    heading = publisher;
  } else if (genre) {
    // match either the primary genre or any subgenre
    q = q.or(`genre.eq.${genre},subgenres.cs.["${genre.replace(/"/g, "")}"]`).order("name");
    heading = genre;
  } else {
    q = q.order("name").limit(200);
    heading = "All games";
  }

  // apply axis range filters (compose with any of the above)
  for (const r of ranges) {
    if (r.min != null) q = q.gte(r.ax, r.min);
    if (r.max != null) q = q.lte(r.ax, r.max);
  }

  const { data } = await q;
  const rows = (data ?? []) as GridRow[];
  const activeRanges = ranges.filter((r) => r.min != null || r.max != null);
  const isDefault = !sort && !top && !publisher && !genre && activeRanges.length === 0;

  // genre chips for the explore hub (default view only)
  let genreChips: { genre: string; count: number }[] = [];
  if (isDefault) {
    const { data: gData } = await db.from("games").select("genre");
    const counts = new Map<string, number>();
    for (const r of gData ?? []) if (r.genre) counts.set(r.genre, (counts.get(r.genre) ?? 0) + 1);
    genreChips = [...counts.entries()]
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <SiteHeader />
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display mt-2 text-3xl font-bold">
            {isDefault ? "Explore" : heading}
            <span className="ml-3 text-base font-normal text-fog">{rows.length}</span>
          </h1>
          {isDefault && (
            <p className="mt-1 text-sm text-fog">Every game we&apos;ve scored — roam by genre, axis, or rank.</p>
          )}
          {!top && !sort && (publisher || genre) && (
            <p className="mt-1 text-sm text-fog">
              {publisher ? "Published by" : "Tagged"} {heading}
            </p>
          )}
          {activeRanges.length > 0 && (
            <p className="mt-1 text-sm text-fog">
              {activeRanges
                .map((r) =>
                  `${AXIS_LABEL[r.ax]} ${r.min ?? 0}–${r.max ?? 10}`
                )
                .join(" · ")}
            </p>
          )}
        </div>
        <Link
          href="/compare"
          className="rounded-full border border-edge px-3 py-1.5 text-sm text-fog transition hover:border-macro hover:text-paper"
        >
          Compare →
        </Link>
      </div>

      {/* axis leaderboards */}
      <div className="mt-5 flex flex-wrap gap-2">
        <span className="self-center text-xs uppercase tracking-widest text-fog">Leaderboards</span>
        {(["micro", "meso", "macro"] as const).map((ax) => (
          <Link
            key={ax}
            href={`/browse?sort=${ax}`}
            className="rounded-full border border-edge px-3 py-1 text-xs font-semibold transition hover:brightness-125"
            style={{ color: `var(--color-${ax})`, borderColor: sort === ax ? `var(--color-${ax})` : "var(--color-edge)" }}
          >
            Most {AXIS_LABEL[ax]}
          </Link>
        ))}
        <Link
          href="/browse?top=1"
          className="rounded-full border border-edge px-3 py-1 text-xs text-fog transition hover:border-macro hover:text-paper"
        >
          Top 50
        </Link>
      </div>

      {/* genre chips — explore hub */}
      {genreChips.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="self-center text-xs uppercase tracking-widest text-fog">Genres</span>
          {genreChips.map((g) => (
            <Link
              key={g.genre}
              href={`/browse?genre=${encodeURIComponent(g.genre)}`}
              className="rounded-full border border-edge px-3 py-1 text-xs text-fog transition hover:border-macro hover:text-paper"
            >
              {g.genre} <span className="text-fog/50">{g.count}</span>
            </Link>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-10 text-fog">No games match.</p>
      ) : (
        <div className="mt-8">
          <GameGrid rows={rows} />
        </div>
      )}
    </main>
  );
}
