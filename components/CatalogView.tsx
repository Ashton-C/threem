"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import GameGrid, { type GridRow } from "./GameGrid";
import { intensity, intensityBand } from "@/lib/intensity";
import { archetype, ARCHETYPES } from "@/lib/archetype";

export type CatalogRow = GridRow & { genre: string | null };

type SortKey = "name" | "genre" | "micro" | "meso" | "macro" | "intensity" | "release_year" | "featured_rank";

const COLS: { key: SortKey; label: string; num: boolean }[] = [
  { key: "name", label: "Game", num: false },
  { key: "genre", label: "Genre", num: false },
  { key: "micro", label: "Mic", num: true },
  { key: "meso", label: "Mes", num: true },
  { key: "macro", label: "Mac", num: true },
  { key: "intensity", label: "Intensity", num: true },
  { key: "release_year", label: "Year", num: true },
];

const AXIS_COLOR: Record<string, string> = {
  micro: "var(--color-micro)",
  meso: "var(--color-meso)",
  macro: "var(--color-macro)",
};

export default function CatalogView({ rows }: { rows: CatalogRow[] }) {
  const [view, setView] = useState<"table" | "grid">("table");
  const [q, setQ] = useState("");
  const [genre, setGenre] = useState("");
  const [arch, setArch] = useState("");
  const [min, setMin] = useState({ micro: 0, meso: 0, macro: 0 });
  const [minInt, setMinInt] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("featured_rank");
  const [dir, setDir] = useState<1 | -1>(1);

  const genres = useMemo(
    () => [...new Set(rows.map((r) => r.genre).filter(Boolean))].sort() as string[],
    [rows]
  );

  const val = (r: CatalogRow, k: SortKey): number | string => {
    if (k === "intensity") return intensity(r);
    if (k === "name" || k === "genre") return (r[k] ?? "").toString().toLowerCase();
    return (r[k] as number) ?? -1;
  };

  const view_rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const filtered = rows.filter(
      (r) =>
        (!ql || r.name.toLowerCase().includes(ql) || (r.genre ?? "").toLowerCase().includes(ql)) &&
        (!genre || r.genre === genre) &&
        (!arch || archetype(r).name === arch) &&
        r.micro >= min.micro && r.meso >= min.meso && r.macro >= min.macro &&
        intensity(r) >= minInt
    );
    return [...filtered].sort((a, b) => {
      const av = val(a, sortKey), bv = val(b, sortKey);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return a.name.localeCompare(b.name);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, genre, arch, min, minInt, sortKey, dir]);

  function sortBy(k: SortKey) {
    if (k === sortKey) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setDir(k === "name" || k === "genre" ? 1 : -1); // text asc, numbers desc
    }
  }

  return (
    <div>
      {/* filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter games or genres…"
          className="w-52 rounded-lg border border-edge bg-panel px-3 py-1.5 text-sm text-paper placeholder-fog outline-none transition focus:border-macro"
        />
        <select
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
          className="rounded-lg border border-edge bg-panel px-3 py-1.5 text-sm text-paper outline-none focus:border-macro"
        >
          <option value="">All genres</option>
          {genres.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <select
          value={arch}
          onChange={(e) => setArch(e.target.value)}
          className="rounded-lg border border-edge bg-panel px-3 py-1.5 text-sm text-paper outline-none focus:border-macro"
          title="Filter by play-style archetype"
        >
          <option value="">All styles</option>
          {ARCHETYPES.map((a) => (
            <option key={a.name} value={a.name}>{a.name}</option>
          ))}
        </select>
        {(["micro", "meso", "macro"] as const).map((ax) => (
          <label key={ax} className="flex items-center gap-1 text-xs" style={{ color: AXIS_COLOR[ax] }}>
            {ax.slice(0, 3)} ≥
            <input
              type="number"
              min={0}
              max={10}
              value={min[ax] || ""}
              onChange={(e) => setMin((m) => ({ ...m, [ax]: Math.min(10, Math.max(0, Number(e.target.value) || 0)) }))}
              className="w-12 rounded border border-edge bg-panel px-1.5 py-1 text-paper outline-none focus:border-macro"
            />
          </label>
        ))}
        <label className="flex items-center gap-1 text-xs text-paper">
          intensity ≥
          <input
            type="number"
            min={0}
            max={10}
            value={minInt || ""}
            onChange={(e) => setMinInt(Math.min(10, Math.max(0, Number(e.target.value) || 0)))}
            className="w-12 rounded border border-edge bg-panel px-1.5 py-1 text-paper outline-none focus:border-macro"
          />
        </label>
        <span className="text-xs text-fog">{view_rows.length} games</span>
        <div className="ml-auto inline-flex rounded-lg border border-edge p-0.5 text-xs">
          {(["table", "grid"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="rounded-md px-3 py-1 font-semibold capitalize transition"
              style={{ background: view === v ? "var(--color-edge)" : "transparent", color: view === v ? "var(--color-paper)" : "var(--color-fog)" }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view_rows.length === 0 ? (
        <p className="text-fog">No games match.</p>
      ) : view === "grid" ? (
        <GameGrid rows={view_rows} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-edge">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge bg-panel text-left">
                {COLS.map((c) => (
                  <th key={c.key} className={c.num ? "px-3 py-2 text-right" : "px-3 py-2"}>
                    <button
                      onClick={() => sortBy(c.key)}
                      className="font-display text-xs font-bold uppercase tracking-wider text-fog transition hover:text-paper"
                    >
                      {c.label}
                      {sortKey === c.key && <span className="ml-1 text-macro">{dir === 1 ? "▲" : "▼"}</span>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view_rows.map((r) => {
                const intv = intensity(r);
                return (
                  <tr key={r.id} className="border-b border-edge/50 transition hover:bg-panel">
                    <td className="px-3 py-2">
                      <Link href={`/game/${r.slug}`} className="font-medium transition hover:text-macro">
                        {r.featured_rank != null && <span className="mr-1.5 font-mono text-xs text-fog">#{r.featured_rank}</span>}
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-fog">
                      {r.genre ? (
                        <Link href={`/browse?genre=${encodeURIComponent(r.genre)}`} className="transition hover:text-paper">{r.genre}</Link>
                      ) : "—"}
                    </td>
                    {(["micro", "meso", "macro"] as const).map((ax) => (
                      <td key={ax} className="px-3 py-2 text-right font-mono tabular-nums" style={{ color: AXIS_COLOR[ax] }}>
                        {r[ax]}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <span className="font-mono tabular-nums text-paper">{intv.toFixed(1)}</span>
                      <span className="ml-1.5 text-[11px] text-fog">{intensityBand(intv)}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-fog">{r.release_year ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
