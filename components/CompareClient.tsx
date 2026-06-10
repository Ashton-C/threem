"use client";
import { useRef, useState } from "react";
import TernaryHeatmap from "./TernaryHeatmap";

export type CompareGame = {
  id: string;
  slug: string;
  name: string;
  micro: number;
  meso: number;
  macro: number;
  thumbnail?: string | null;
};

// per-game marker colors (distinct from the axis colors)
const SERIES = ["#eef2fb", "#b794ff", "#5eead4"];
const AXES = [
  { key: "micro", label: "Micro", color: "var(--color-micro)" },
  { key: "meso", label: "Meso", color: "var(--color-meso)" },
  { key: "macro", label: "Macro", color: "var(--color-macro)" },
] as const;

export default function CompareClient({ initial }: { initial: CompareGame[] }) {
  const [games, setGames] = useState<CompareGame[]>(initial);
  const [input, setInput] = useState("");
  const [matches, setMatches] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const full = games.length >= 3;

  function onChange(v: string) {
    setInput(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.trim().length < 2) return setMatches([]);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/suggest?q=${encodeURIComponent(v.trim())}`);
      const data = await res.json();
      setMatches(data.suggestions ?? []);
    }, 200);
  }

  async function add(name: string) {
    setMatches([]);
    setInput("");
    if (full) return;
    setBusy(true);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: name }),
      });
      const data = await res.json();
      if (data?.game && !games.some((g) => g.id === data.game.id)) {
        setGames((prev) => [...prev, data.game]);
      }
    } finally {
      setBusy(false);
    }
  }

  const remove = (id: string) => setGames((prev) => prev.filter((g) => g.id !== id));

  const dots = games.map((g, i) => ({
    micro: g.micro,
    meso: g.meso,
    macro: g.macro,
    label: g.name.length > 14 ? g.name.slice(0, 13) + "…" : g.name,
    color: SERIES[i % SERIES.length],
  }));

  return (
    <div>
      {/* add a game */}
      {!full && (
        <div className="relative max-w-sm">
          <input
            value={input}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setTimeout(() => setMatches([]), 150)}
            placeholder={busy ? "Adding…" : "Add a game…"}
            disabled={busy}
            className="w-full rounded-lg border border-edge bg-panel px-4 py-2.5 text-paper placeholder-fog outline-none transition focus:border-macro"
          />
          {matches.length > 0 && (
            <ul className="glow-box absolute z-10 mt-2 w-full overflow-hidden rounded-lg bg-panel" style={{ ["--glow" as string]: "var(--color-edge)" }}>
              {matches.map((m) => (
                <li key={m}>
                  <button
                    onMouseDown={() => add(m)}
                    className="block w-full px-4 py-2.5 text-left text-sm transition hover:bg-edge"
                  >
                    {m}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {games.length === 0 ? (
        <p className="mt-8 text-fog">Add games to compare them.</p>
      ) : (
        <div className="mt-8 grid gap-8 sm:grid-cols-[260px_1fr] sm:items-start">
          {/* overlaid triangle */}
          <div className="glow-box rounded-2xl bg-panel p-4" style={{ ["--glow" as string]: "var(--color-edge)" }}>
            <TernaryHeatmap points={[]} dots={dots} heatmap={false} size={220} />
            <div className="mt-3 space-y-1.5">
              {games.map((g, i) => (
                <div key={g.id} className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
                  <span className="truncate">{g.name}</span>
                  <button onClick={() => remove(g.id)} className="ml-auto text-fog/50 transition hover:text-micro" title="Remove">✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* axis comparison */}
          <div className="space-y-6">
            {AXES.map((a) => {
              const top = Math.max(...games.map((g) => g[a.key]));
              return (
                <div key={a.key}>
                  <p className="font-display mb-2 font-bold" style={{ color: a.color }}>{a.label}</p>
                  <div className="space-y-2">
                    {games.map((g) => (
                      <div key={g.id} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 truncate text-sm text-fog">{g.name}</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-edge">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${g[a.key] * 10}%`, background: a.color, boxShadow: `0 0 8px ${a.color}` }}
                          />
                        </div>
                        <span
                          className="w-8 text-right font-mono text-sm tabular-nums"
                          style={{ color: g[a.key] === top ? a.color : "var(--color-fog)" }}
                        >
                          {g[a.key]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
