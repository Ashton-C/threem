import Link from "next/link";

export type GridRow = {
  id: string;
  slug: string;
  name: string;
  micro: number;
  meso: number;
  macro: number;
  thumbnail: string | null;
  release_year: number | null;
  featured_rank?: number | null;
};

const BARS = [
  { key: "micro", color: "var(--color-micro)" },
  { key: "meso", color: "var(--color-meso)" },
  { key: "macro", color: "var(--color-macro)" },
] as const;

export default function GameGrid({
  rows,
  cols = 3,
}: {
  rows: GridRow[];
  cols?: 2 | 3;
}) {
  return (
    <div
      className={`grid gap-4 sm:grid-cols-2 ${cols === 3 ? "lg:grid-cols-3" : ""}`}
    >
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
            <div className="flex h-28 w-full items-center justify-center bg-ink2 font-display text-fog/40">
              3M
            </div>
          )}
          <div className="p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate font-semibold">
                {r.featured_rank != null && (
                  <span className="mr-1.5 font-mono text-xs text-fog">#{r.featured_rank}</span>
                )}
                {r.name}
              </p>
              {r.release_year && <span className="shrink-0 text-xs text-fog">{r.release_year}</span>}
            </div>
            <div className="mt-2 flex gap-1">
              {BARS.map((b) => (
                <div key={b.key} className="h-1.5 flex-1 overflow-hidden rounded-full bg-edge">
                  <div className="h-full rounded-full" style={{ width: `${r[b.key] * 10}%`, background: b.color }} />
                </div>
              ))}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
