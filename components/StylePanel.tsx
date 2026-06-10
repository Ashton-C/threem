"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TernaryHeatmap from "./TernaryHeatmap";
import ShareStyle from "./ShareStyle";
import { archetype, encodeStyle } from "@/lib/archetype";

type LibGame = {
  id: string;
  name: string;
  micro: number;
  meso: number;
  macro: number;
  playtime_minutes?: number | null;
};

type Rec = { id: string; slug: string; name: string };

const AXES = [
  { key: "micro", label: "Micro", color: "var(--color-micro)" },
  { key: "meso", label: "Meso", color: "var(--color-meso)" },
  { key: "macro", label: "Macro", color: "var(--color-macro)" },
] as const;

const fmtHours = (min: number) =>
  min >= 60 ? `${Math.round(min / 60)}h` : `${min}m`;

export default function StylePanel({
  games,
  onRemove,
}: {
  games: LibGame[];
  onRemove: (gameId: string) => void;
}) {
  // any playtime data at all? (Steam import provides it; manual adds don't)
  const hasPlaytime = games.some((g) => g.playtime_minutes != null);
  const [byPlaytime, setByPlaytime] = useState(true);
  const useWeights = byPlaytime && hasPlaytime;

  // weight = hours played; manual adds (null) count as a typical game so they
  // aren't ignored; owned-but-never-played Steam games (0) drop out.
  const known = games
    .map((g) => g.playtime_minutes)
    .filter((p): p is number => p != null);
  const avgPlayed = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 0;
  const rawWeight = (g: LibGame) =>
    !useWeights ? 1 : g.playtime_minutes == null ? avgPlayed || 1 : g.playtime_minutes;
  const totalRaw = games.reduce((s, g) => s + rawWeight(g), 0);
  // if every weight is zero (all unplayed), fall back to equal weighting
  const weightOf = (g: LibGame) => (totalRaw > 0 ? rawWeight(g) : 1);
  const wsum = games.reduce((s, g) => s + weightOf(g), 0) || 1;

  const avg = games.length
    ? {
        micro: games.reduce((s, g) => s + g.micro * weightOf(g), 0) / wsum,
        meso: games.reduce((s, g) => s + g.meso * weightOf(g), 0) / wsum,
        macro: games.reduce((s, g) => s + g.macro * weightOf(g), 0) / wsum,
      }
    : null;

  const totalMinutes = games.reduce((s, g) => s + (g.playtime_minutes ?? 0), 0);

  // the axis the user leans on least — recommend toward it
  const weakest = avg
    ? (Object.entries(avg).sort((a, b) => a[1] - b[1])[0][0] as
        | "micro"
        | "meso"
        | "macro")
    : null;

  const [recs, setRecs] = useState<Rec[]>([]); // round out the weakest axis
  const [more, setMore] = useState<Rec[]>([]); // more of what you already like
  const libIds = games.map((g) => g.id).join(",");
  const centroid = avg ? `${avg.micro},${avg.meso},${avg.macro}` : "";
  useEffect(() => {
    if (!weakest) {
      setRecs([]);
      setMore([]);
      return;
    }
    const owned = new Set(libIds ? libIds.split(",") : []);
    const take = (url: string, set: (r: Rec[]) => void) =>
      fetch(url)
        .then((r) => r.json())
        .then((d) =>
          set((d.games ?? []).filter((g: Rec) => !owned.has(g.id)).slice(0, 3))
        )
        .catch(() => set([]));
    take(`/api/recommend?axis=${weakest}`, setRecs);
    take(`/api/recommend?near=${encodeURIComponent(centroid)}`, setMore);
  }, [weakest, libIds, centroid]);

  if (!games.length || !avg)
    return (
      <p className="mt-4 text-sm text-fog">
        Score a game and hit <span className="text-paper">+ Library</span> to
        start building your style profile.
      </p>
    );

  const arch = archetype(avg);
  const weakLabel = weakest ? AXES.find((a) => a.key === weakest)! : null;
  const points = games.map((g) => ({
    micro: g.micro,
    meso: g.meso,
    macro: g.macro,
    weight: weightOf(g),
  }));

  return (
    <div
      className="glow-box mt-4 rounded-2xl bg-panel p-6"
      style={{ ["--glow" as string]: arch.color }}
    >
      <p className="text-sm text-fog">
        {games.length} game{games.length === 1 ? "" : "s"}
        {totalMinutes > 0 && (
          <> · <span className="text-paper">{fmtHours(totalMinutes)}</span> played</>
        )}{" "}
        · you play like a
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          className="font-display text-3xl font-bold glow-text"
          style={{ color: arch.color, ["--glow" as string]: arch.color }}
        >
          {arch.name}
        </p>
        <ShareStyle code={encodeStyle(avg, games.length)} />
      </div>

      {/* weighting toggle — only meaningful when we have playtime */}
      {hasPlaytime && (
        <div className="mt-3 inline-flex rounded-lg border border-edge p-0.5 text-xs">
          {[
            { v: true, label: "By playtime" },
            { v: false, label: "By count" },
          ].map((o) => (
            <button
              key={String(o.v)}
              onClick={() => setByPlaytime(o.v)}
              className="rounded-md px-3 py-1 font-semibold transition"
              style={{
                background: byPlaytime === o.v ? "var(--color-edge)" : "transparent",
                color: byPlaytime === o.v ? "var(--color-paper)" : "var(--color-fog)",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 grid items-center gap-6 sm:grid-cols-[1fr_180px]">
        <TernaryHeatmap points={points} />

        <div className="space-y-3">
          {AXES.map((a) => (
            <div key={a.key}>
              <div className="mb-1 flex justify-between text-xs">
                <span style={{ color: a.color }} className="font-display font-bold">
                  {a.label}
                </span>
                <span className="font-mono tabular-nums text-fog">{avg[a.key].toFixed(1)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-edge">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${avg[a.key] * 10}%`, background: a.color, boxShadow: `0 0 8px ${a.color}` }}
                />
              </div>
            </div>
          ))}
          <p className="pt-1 text-[11px] leading-relaxed text-fog/70">
            {useWeights
              ? "Weighted by hours played — games you actually run count more."
              : "Each game counts equally. Ring = your center of gravity."}
          </p>
        </div>
      </div>

      {(recs.length > 0 || more.length > 0) && (
        <div className="mt-6 grid gap-5 border-t border-edge pt-5 sm:grid-cols-2">
          {more.length > 0 && (
            <div>
              <p className="text-sm text-fog">
                <span className="font-semibold text-paper">More of what you like</span>{" "}
                — closest to your taste:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {more.map((r) => (
                  <Link
                    key={r.id}
                    href={`/game/${r.slug}`}
                    className="rounded-full border border-edge px-3 py-1 text-xs transition hover:border-macro hover:text-paper"
                  >
                    {r.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {recs.length > 0 && weakLabel && (
            <div>
              <p className="text-sm text-fog">
                Round out your{" "}
                <span className="font-semibold" style={{ color: weakLabel.color }}>
                  {weakLabel.label}
                </span>{" "}
                — try:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {recs.map((r) => (
                  <Link
                    key={r.id}
                    href={`/game/${r.slug}`}
                    className="rounded-full border border-edge px-3 py-1 text-xs transition hover:border-macro hover:text-paper"
                  >
                    {r.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-1.5">
        {games.map((g) => {
          const dim = useWeights && g.playtime_minutes === 0;
          return (
            <span
              key={g.id}
              className="flex items-center gap-1.5 rounded-full border border-edge px-2.5 py-1 text-xs"
              style={{ opacity: dim ? 0.45 : 1, color: "var(--color-fog)" }}
              title={dim ? "Owned but never played — ignored when weighting by playtime" : undefined}
            >
              {g.name}
              {g.playtime_minutes != null && g.playtime_minutes > 0 && (
                <span className="text-fog/50">{fmtHours(g.playtime_minutes)}</span>
              )}
              <button
                onClick={() => onRemove(g.id)}
                title={`Remove ${g.name}`}
                className="text-fog/50 transition hover:text-micro"
              >
                ✕
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
