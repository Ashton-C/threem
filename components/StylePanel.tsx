"use client";
import TernaryHeatmap from "./TernaryHeatmap";

type LibGame = {
  id: string;
  name: string;
  micro: number;
  meso: number;
  macro: number;
};

const AXES = [
  { key: "micro", label: "Micro", color: "var(--color-micro)" },
  { key: "meso", label: "Meso", color: "var(--color-meso)" },
  { key: "macro", label: "Macro", color: "var(--color-macro)" },
] as const;

function archetype(avg: Record<"micro" | "meso" | "macro", number>): string {
  const entries = Object.entries(avg) as ["micro" | "meso" | "macro", number][];
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  if (sorted[0][1] - sorted[2][1] < 1) return "Hybrid — balanced across all three";
  const names = {
    micro: "Executor — mechanics-first",
    meso: "Tactician — lives in the mid-game",
    macro: "Strategist — plays the long game",
  };
  return names[sorted[0][0]];
}

export default function StylePanel({
  games,
  onRemove,
}: {
  games: LibGame[];
  onRemove: (gameId: string) => void;
}) {
  if (!games.length)
    return (
      <p className="mt-4 text-sm text-fog">
        Score a game and hit <span className="text-paper">+ Library</span> to
        start building your style profile.
      </p>
    );

  const avg = {
    micro: games.reduce((s, g) => s + g.micro, 0) / games.length,
    meso: games.reduce((s, g) => s + g.meso, 0) / games.length,
    macro: games.reduce((s, g) => s + g.macro, 0) / games.length,
  };

  return (
    <div className="mt-4 rounded-2xl border border-edge bg-panel p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-fog">
          {games.length} game{games.length === 1 ? "" : "s"} ·{" "}
          <span className="font-semibold text-paper">{archetype(avg)}</span>
        </p>
      </div>

      <div className="mt-4 grid items-center gap-6 sm:grid-cols-[1fr_180px]">
        <TernaryHeatmap points={games} />

        <div className="space-y-3">
          {AXES.map((a) => (
            <div key={a.key}>
              <div className="mb-1 flex justify-between text-xs">
                <span style={{ color: a.color }} className="font-semibold">
                  {a.label}
                </span>
                <span className="font-mono tabular-nums text-fog">
                  {avg[a.key].toFixed(1)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-edge">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${avg[a.key] * 10}%`, backgroundColor: a.color }}
                />
              </div>
            </div>
          ))}
          <p className="pt-1 text-[11px] leading-relaxed text-fog/70">
            Triangle shows where your library concentrates; deeper color =
            more games. Ring = your center of gravity.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {games.map((g) => (
          <span
            key={g.id}
            className="group flex items-center gap-1.5 rounded-full border border-edge px-2.5 py-1 text-xs text-fog"
          >
            {g.name}
            <button
              onClick={() => onRemove(g.id)}
              title={`Remove ${g.name}`}
              className="text-fog/50 transition hover:text-micro"
            >
              ✕
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
