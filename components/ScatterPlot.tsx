"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { intensity } from "@/lib/intensity";

type Pt = { id: string; slug: string; name: string; micro: number; meso: number; macro: number };
type Axis = "micro" | "meso" | "macro" | "intensity";

const AXES: { key: Axis; label: string; color: string; hex: string }[] = [
  { key: "micro", label: "Micro", color: "var(--color-micro)", hex: "#ff2e63" },
  { key: "meso", label: "Meso", color: "var(--color-meso)", hex: "#ffc23d" },
  { key: "macro", label: "Macro", color: "var(--color-macro)", hex: "#29e3ff" },
  { key: "intensity", label: "Intensity", color: "var(--color-paper)", hex: "#eef2fb" },
];

// pairwise archetype name (matches lib/archetype) for the diagonal label
const PAIR_STYLE: Record<string, string> = {
  "micro+meso": "Gladiator",
  "meso+macro": "Commander",
  "micro+macro": "Maestro",
};
const AX_ORDER: Record<string, number> = { micro: 0, meso: 1, macro: 2 };

// blend two #rrggbb colors by t in [0,1] — used to gradient each dot between
// the x-axis and y-axis colors by which axis it leans toward
function lerpHex(a: string, b: string, t: number): string {
  const ch = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16);
  const mix = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t);
  return `#${[1, 3, 5].map((i) => mix(i).toString(16).padStart(2, "0")).join("")}`;
}

const val = (p: Pt, a: Axis) => (a === "intensity" ? intensity(p) : p[a]);

export default function ScatterPlot({ points }: { points: Pt[] }) {
  const router = useRouter();
  const [xa, setXa] = useState<Axis>("micro");
  const [ya, setYa] = useState<Axis>("macro");
  const [hover, setHover] = useState<Pt | null>(null);

  const W = 600, H = 440, pad = 40;
  const sx = (v: number) => pad + (v / 10) * (W - 2 * pad);
  const sy = (v: number) => H - pad - (v / 10) * (H - 2 * pad);
  const xMeta = AXES.find((a) => a.key === xa)!;
  const yMeta = AXES.find((a) => a.key === ya)!;
  const xColor = xMeta.color;
  const yColor = yMeta.color;

  // the combined style along the origin→(10,10) diagonal: the pairwise
  // archetype when both axes are real skills, else a neutral "of both"
  const pairLabel =
    xa !== "intensity" && ya !== "intensity" && xa !== ya
      ? PAIR_STYLE[[xa, ya].sort((p, q) => AX_ORDER[p] - AX_ORDER[q]).join("+")] ?? null
      : null;
  const diagAngle = (Math.atan2(sy(10) - sy(0), sx(10) - sx(0)) * 180) / Math.PI;

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

        {/* style diagonal: origin → (10,10) = more of both axes at once */}
        <line
          x1={sx(0)} y1={sy(0)} x2={sx(10)} y2={sy(10)}
          stroke="var(--color-paper)" strokeOpacity={0.3} strokeWidth={1.25} strokeDasharray="6 5"
        />
        <text
          x={sx(6.3)} y={sy(6.3)} dy={-7} textAnchor="middle"
          fontSize={11} fontWeight={700} fill="var(--color-paper)" fillOpacity={0.72}
          transform={`rotate(${diagAngle} ${sx(6.3)} ${sy(6.3)})`}
          style={{ letterSpacing: "0.04em" }}
        >
          more {pairLabel ?? "of both"} →
        </text>

        {/* points */}
        {points.map((p) => {
          const vx = val(p, xa), vy = val(p, ya);
          const cx = sx(vx), cy = sy(vy);
          const on = hover?.id === p.id;
          // hue leans toward whichever axis the game scores higher on;
          // brightness rises with how demanding it is on both
          const t = vx + vy > 0 ? vy / (vx + vy) : 0.5;
          const dotColor = lerpHex(xMeta.hex, yMeta.hex, t);
          const mag = (vx + vy) / 20;
          return (
            <circle
              key={p.id}
              cx={cx}
              cy={cy}
              r={on ? 6 : 3.2}
              fill={on ? "var(--color-macro)" : dotColor}
              fillOpacity={on ? 1 : 0.4 + 0.5 * mag}
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
