"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { intensity } from "@/lib/intensity";

type Pt = { id: string; slug: string; name: string; micro: number; meso: number; macro: number };
type Axis = "micro" | "meso" | "macro" | "intensity";

const AXES: { key: Axis; label: string; color: string }[] = [
  { key: "micro", label: "Micro", color: "var(--color-micro)" },
  { key: "meso", label: "Meso", color: "var(--color-meso)" },
  { key: "macro", label: "Macro", color: "var(--color-macro)" },
  { key: "intensity", label: "Intensity", color: "var(--color-paper)" },
];

const val = (p: Pt, a: Axis) => (a === "intensity" ? intensity(p) : p[a]);

export default function ScatterPlot({ points }: { points: Pt[] }) {
  const router = useRouter();
  const [xa, setXa] = useState<Axis>("micro");
  const [ya, setYa] = useState<Axis>("macro");
  const [hover, setHover] = useState<Pt | null>(null);

  const W = 600, H = 440, pad = 40;
  const sx = (v: number) => pad + (v / 10) * (W - 2 * pad);
  const sy = (v: number) => H - pad - (v / 10) * (H - 2 * pad);
  const xColor = AXES.find((a) => a.key === xa)!.color;
  const yColor = AXES.find((a) => a.key === ya)!.color;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-fog">X</span>
          <select value={xa} onChange={(e) => setXa(e.target.value as Axis)} className="rounded-lg border border-edge bg-panel px-2 py-1 text-paper outline-none focus:border-macro">
            {AXES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-fog">Y</span>
          <select value={ya} onChange={(e) => setYa(e.target.value as Axis)} className="rounded-lg border border-edge bg-panel px-2 py-1 text-paper outline-none focus:border-macro">
            {AXES.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </label>
        <span className="text-xs text-fog">{points.length} games · click a point to open</span>
        {hover && <span className="ml-auto text-sm font-semibold text-paper">{hover.name}</span>}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="rounded-xl border border-edge bg-panel" role="img" aria-label="Scatter plot of games by two axes">
        {/* grid */}
        {[0, 2, 4, 6, 8, 10].map((t) => (
          <g key={t}>
            <line x1={sx(t)} y1={pad} x2={sx(t)} y2={H - pad} stroke="var(--color-edge)" strokeWidth={0.5} opacity={0.5} />
            <line x1={pad} y1={sy(t)} x2={W - pad} y2={sy(t)} stroke="var(--color-edge)" strokeWidth={0.5} opacity={0.5} />
            <text x={sx(t)} y={H - pad + 14} textAnchor="middle" fontSize={9} fill="var(--color-fog)">{t}</text>
            <text x={pad - 8} y={sy(t) + 3} textAnchor="end" fontSize={9} fill="var(--color-fog)">{t}</text>
          </g>
        ))}
        {/* axis titles */}
        <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={12} fontWeight={700} fill={xColor}>{AXES.find((a) => a.key === xa)!.label}</text>
        <text x={14} y={H / 2} textAnchor="middle" fontSize={12} fontWeight={700} fill={yColor} transform={`rotate(-90 14 ${H / 2})`}>{AXES.find((a) => a.key === ya)!.label}</text>

        {/* points */}
        {points.map((p) => {
          const cx = sx(val(p, xa)), cy = sy(val(p, ya));
          const on = hover?.id === p.id;
          return (
            <circle
              key={p.id}
              cx={cx}
              cy={cy}
              r={on ? 6 : 3}
              fill={on ? "var(--color-macro)" : "var(--color-paper)"}
              fillOpacity={on ? 1 : 0.45}
              style={{ cursor: "pointer", filter: on ? "drop-shadow(0 0 6px var(--color-macro))" : undefined }}
              onMouseEnter={() => setHover(p)}
              onMouseLeave={() => setHover((h) => (h?.id === p.id ? null : h))}
              onClick={() => router.push(`/game/${p.slug}`)}
            >
              <title>{`${p.name} — ${AXES.find((a) => a.key === xa)!.label} ${val(p, xa).toFixed(1)}, ${AXES.find((a) => a.key === ya)!.label} ${val(p, ya).toFixed(1)}`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}
