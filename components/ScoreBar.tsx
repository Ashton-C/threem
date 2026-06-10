// One 3M axis: label + reason + big glowing score + animated neon bar.

export default function ScoreBar({
  label,
  desc,
  score,
  color,
  delay = 0,
  reason,
  compact = false,
}: {
  label: string;
  desc?: string;
  score: number;
  color: string;
  delay?: number;
  reason?: string;
  compact?: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between gap-3">
        <span className="font-display font-bold" style={{ color }}>
          {label}
          {desc && !compact && (
            <span className="ml-2 hidden text-xs font-normal text-fog sm:inline">{desc}</span>
          )}
        </span>
        <span
          className="font-display text-2xl font-bold leading-none tabular-nums glow-text"
          style={{ color, ["--glow" as string]: color }}
        >
          {score}
          <span className="text-sm font-normal text-fog">/10</span>
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-edge">
        <div
          className="h-full origin-left rounded-full"
          style={{
            width: `${score * 10}%`,
            background: color,
            boxShadow: `0 0 12px ${color}`,
            animation: `bar-grow 0.7s ${delay}s cubic-bezier(0.22,1,0.36,1) backwards`,
          }}
        />
      </div>
      {reason && <p className="mt-2 text-sm leading-relaxed text-fog">{reason}</p>}
    </div>
  );
}
