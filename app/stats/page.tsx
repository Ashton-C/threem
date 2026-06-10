import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { db } from "@/lib/supabase";
import { computeStats } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stats — 3M" };

const AXES = [
  { key: "micro", label: "Micro", color: "var(--color-micro)" },
  { key: "meso", label: "Meso", color: "var(--color-meso)" },
  { key: "macro", label: "Macro", color: "var(--color-macro)" },
] as const;

export default async function StatsPage() {
  const { data } = await db.from("games").select("micro,meso,macro,genre");
  const s = computeStats(data ?? []);
  const archTotal = s.archetypes.reduce((a, b) => a + b.count, 0) || 1;
  const maxGenre = s.genres[0]?.count ?? 1;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <SiteHeader />

      <h1 className="font-display text-3xl font-bold">The dataset</h1>
      <p className="mt-1 text-fog">
        <span className="font-mono text-paper">{s.total}</span> games scored and
        counting — every search adds to it.
      </p>

      {/* axis averages */}
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {AXES.map((a) => (
          <div key={a.key} className="glow-box rounded-xl bg-panel p-4" style={{ ["--glow" as string]: a.color }}>
            <div className="font-display text-sm font-bold" style={{ color: a.color }}>
              avg {a.label}
            </div>
            <div className="font-display text-3xl font-bold glow-text" style={{ color: a.color, ["--glow" as string]: a.color }}>
              {s.avg[a.key].toFixed(1)}
            </div>
          </div>
        ))}
      </div>

      {/* distributions */}
      <h2 className="font-display mt-12 text-xs font-bold uppercase tracking-[0.2em] text-fog">
        Score distribution
      </h2>
      <div className="mt-4 grid gap-8 sm:grid-cols-3">
        {AXES.map((a) => {
          const d = s.dist[a.key];
          const max = Math.max(1, ...d);
          return (
            <div key={a.key}>
              <p className="font-display mb-2 text-sm font-bold" style={{ color: a.color }}>{a.label}</p>
              <div className="flex h-28 items-end gap-[3px]">
                {d.map((count, score) => (
                  <div key={score} className="flex flex-1 flex-col items-center justify-end" title={`${score}: ${count}`}>
                    <div
                      className="w-full rounded-t"
                      style={{ height: `${(count / max) * 100}%`, minHeight: count ? 2 : 0, background: a.color, opacity: 0.4 + 0.6 * (count / max) }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-fog/60">
                <span>0</span><span>5</span><span>10</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* archetype split */}
      <h2 className="font-display mt-12 text-xs font-bold uppercase tracking-[0.2em] text-fog">
        Archetype split
      </h2>
      <div className="mt-4 flex overflow-hidden rounded-full">
        {s.archetypes.map((a) => {
          const pct = (a.count / archTotal) * 100;
          if (!pct) return null;
          const color =
            a.name === "Executor" ? "var(--color-micro)" :
            a.name === "Tactician" ? "var(--color-meso)" :
            a.name === "Strategist" ? "var(--color-macro)" : "var(--color-fog)";
          return (
            <div key={a.name} style={{ width: `${pct}%`, background: color }} className="h-8" title={`${a.name}: ${a.count}`} />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-fog">
        {s.archetypes.map((a) => (
          <span key={a.name}>{a.name} <span className="font-mono text-paper">{a.count}</span></span>
        ))}
      </div>

      {/* genres */}
      <h2 className="font-display mt-12 text-xs font-bold uppercase tracking-[0.2em] text-fog">
        Genres
      </h2>
      <div className="mt-4 space-y-1.5">
        {s.genres.slice(0, 14).map((g) => (
          <Link key={g.genre} href={`/browse?genre=${encodeURIComponent(g.genre)}`} className="group flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-sm text-fog transition group-hover:text-paper">{g.genre}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-edge">
              <div className="h-full rounded-full bg-macro/70" style={{ width: `${(g.count / maxGenre) * 100}%`, background: "var(--color-macro)", opacity: 0.7 }} />
            </div>
            <span className="w-8 text-right font-mono text-xs text-fog">{g.count}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
