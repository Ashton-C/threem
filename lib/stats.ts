// Aggregate stats over the whole scored catalog. Pure function so the
// /api/stats route and the /stats page share one implementation.

import { archetype } from "./archetype";

export type StatRow = {
  micro: number;
  meso: number;
  macro: number;
  genre: string | null;
};

export type Stats = {
  total: number;
  avg: { micro: number; meso: number; macro: number };
  // histogram: index 0..10 -> count of games with that score, per axis
  dist: { micro: number[]; meso: number[]; macro: number[] };
  genres: { genre: string; count: number }[];
  archetypes: { name: string; count: number }[];
};

export function computeStats(rows: StatRow[]): Stats {
  const n = rows.length || 1;
  const sum = { micro: 0, meso: 0, macro: 0 };
  const dist = {
    micro: Array(11).fill(0),
    meso: Array(11).fill(0),
    macro: Array(11).fill(0),
  };
  const genreCounts = new Map<string, number>();
  const archCounts = new Map<string, number>();

  for (const r of rows) {
    (["micro", "meso", "macro"] as const).forEach((ax) => {
      sum[ax] += r[ax];
      const b = Math.min(10, Math.max(0, Math.round(r[ax])));
      dist[ax][b]++;
    });
    if (r.genre) genreCounts.set(r.genre, (genreCounts.get(r.genre) ?? 0) + 1);
    const a = archetype({ micro: r.micro, meso: r.meso, macro: r.macro }).name;
    archCounts.set(a, (archCounts.get(a) ?? 0) + 1);
  }

  return {
    total: rows.length,
    avg: { micro: sum.micro / n, meso: sum.meso / n, macro: sum.macro / n },
    dist,
    genres: [...genreCounts.entries()]
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count),
    archetypes: ["Executor", "Tactician", "Strategist", "Hybrid"].map((name) => ({
      name,
      count: archCounts.get(name) ?? 0,
    })),
  };
}
