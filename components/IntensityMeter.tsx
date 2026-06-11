import { intensity, intensityBand } from "@/lib/intensity";

// Casual ↔ Hardcore spectrum with a marker at the game's mean demand.
export default function IntensityMeter({
  game,
  compact = false,
}: {
  game: { micro: number; meso: number; macro: number };
  compact?: boolean;
}) {
  const v = intensity(game);
  const pct = Math.min(100, Math.max(0, v * 10));
  const band = intensityBand(v);

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-display text-xs font-bold uppercase tracking-wider text-fog">
          Intensity
        </span>
        <span className="text-xs">
          <span className="font-semibold text-paper">{band}</span>
          <span className="ml-1.5 font-mono text-fog">{v.toFixed(1)}/10</span>
        </span>
      </div>
      <div className="relative h-2 rounded-full" style={{ background: "linear-gradient(90deg, var(--color-macro), var(--color-meso), var(--color-micro))" }}>
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink"
          style={{ left: `${pct}%`, background: "var(--color-paper)", boxShadow: "0 0 6px rgba(255,255,255,0.6)" }}
        />
      </div>
      {!compact && (
        <div className="mt-1 flex justify-between text-[10px] text-fog/60">
          <span>Casual</span>
          <span>Hardcore</span>
        </div>
      )}
    </div>
  );
}
