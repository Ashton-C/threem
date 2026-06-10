import Link from "next/link";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  slug: string;
  name: string;
  micro: number;
  meso: number;
  macro: number;
  thumbnail: string | null;
  genre: string | null;
  subgenres: string[] | null;
  release_year: number | null;
  featured_rank: number | null;
};

const AXES = [
  { key: "micro", label: "M", color: "var(--color-micro)" },
  { key: "meso", label: "M", color: "var(--color-meso)" },
  { key: "macro", label: "M", color: "var(--color-macro)" },
] as const;

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

  let q = db
    .from("games")
    .select("id,slug,name,micro,meso,macro,thumbnail,genre,subgenres,release_year,featured_rank");

  let heading: string;
  if (top) {
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

  const { data } = await q;
  const rows = (data ?? []) as Row[];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Link href="/" className="font-display text-sm text-fog transition hover:text-paper">
            ← 3M
          </Link>
          <h1 className="font-display mt-2 text-3xl font-bold">
            {heading}
            <span className="ml-3 text-base font-normal text-fog">{rows.length}</span>
          </h1>
          {!top && (publisher || genre) && (
            <p className="mt-1 text-sm text-fog">
              {publisher ? "Published by" : "Tagged"} {heading}
            </p>
          )}
        </div>
        <Link
          href="/browse?top=1"
          className="rounded-full border border-edge px-3 py-1.5 text-sm text-fog transition hover:border-macro hover:text-paper"
        >
          Top 50 →
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-10 text-fog">No games here yet.</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/game/${r.slug}`}
              className="group overflow-hidden rounded-xl border border-edge bg-panel transition hover:border-macro"
            >
              {r.thumbnail ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={r.thumbnail} alt="" className="h-28 w-full object-cover transition group-hover:brightness-110" />
              ) : (
                <div className="h-28 w-full bg-ink2" />
              )}
              <div className="p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-semibold">
                    {r.featured_rank && (
                      <span className="mr-1.5 font-mono text-xs text-fog">#{r.featured_rank}</span>
                    )}
                    {r.name}
                  </p>
                  {r.release_year && <span className="shrink-0 text-xs text-fog">{r.release_year}</span>}
                </div>
                <div className="mt-2 flex gap-1">
                  {AXES.map((a) => (
                    <div key={a.color} className="h-1.5 flex-1 overflow-hidden rounded-full bg-edge">
                      <div className="h-full rounded-full" style={{ width: `${r[a.key] * 10}%`, background: a.color }} />
                    </div>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
