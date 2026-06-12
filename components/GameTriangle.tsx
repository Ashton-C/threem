"use client";
import { useId } from "react";

// Single-game radar: each axis runs from the center (0) out to its vertex
// (10); the score plots along its own axis and the three points connect
// into a filled polygon. The fill is layered radial gradients that deepen
// the interior toward the heaviest-weighted axis.

type Scores = { micro: number; meso: number; macro: number };

const AXES = [
  { key: "micro", label: "Micro", color: "#ff2e63", rgb: "255,46,99", ang: -90 }, // top
  { key: "meso", label: "Meso", color: "#ffc23d", rgb: "255,194,61", ang: 30 }, // bottom-right
  { key: "macro", label: "Macro", color: "#29e3ff", rgb: "41,227,255", ang: 150 }, // bottom-left
] as const;

const rad = (d: number) => (d * Math.PI) / 180;

export default function GameTriangle({
  game,
  size = 200,
}: {
  game: Scores;
  size?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const cx = size / 2;
  const cy = size * 0.5;
  const R = size * 0.32;
  const at = (ang: number, r: number): [number, number] => [
    cx + r * Math.cos(rad(ang)),
    cy + r * Math.sin(rad(ang)),
  ];
  const poly = (r: (a: (typeof AXES)[number]) => number) =>
    AXES.map((a) => at(a.ang, r(a)).join(",")).join(" ");

  const grid = [2, 4, 6, 8, 10];
  const scorePts = AXES.map((a) => at(a.ang, R * (game[a.key] / 10)));
  const scorePolygon = scorePts.map((p) => p.join(",")).join(" ");
  // polygon edges, each a gradient between its two axis colors (not all-cyan)
  const edges = [
    { from: 0, to: 1 }, // micro -> meso
    { from: 1, to: 2 }, // meso -> macro
    { from: 2, to: 0 }, // macro -> micro
  ];

  // normalized axis shares -> gradient lean toward the heaviest
  const sum = game.micro + game.meso + game.macro || 1;
  const share = { micro: game.micro / sum, meso: game.meso / sum, macro: game.macro / sum };
  const reach = R * 1.9;

  return (
    <svg
      viewBox={`${-size * 0.16} ${size * 0.05} ${size * 1.32} ${size * 0.72}`}
      width="100%"
      style={{ maxWidth: size * 1.32 }}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Radar of this game's micro/meso/macro scores"
    >
      <defs>
        {AXES.map((a) => {
          const [vx, vy] = at(a.ang, R);
          const o = (0.2 + 0.85 * share[a.key]).toFixed(3);
          return (
            <radialGradient key={a.key} id={`${uid}-${a.key}`} gradientUnits="userSpaceOnUse" cx={vx} cy={vy} r={reach}>
              <stop offset="0%" stopColor={`rgba(${a.rgb},${o})`} />
              <stop offset="75%" stopColor={`rgba(${a.rgb},0)`} />
            </radialGradient>
          );
        })}
        {edges.map((e, i) => {
          const [x1, y1] = scorePts[e.from];
          const [x2, y2] = scorePts[e.to];
          return (
            <linearGradient key={i} id={`${uid}-e${i}`} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
              <stop offset="0%" stopColor={AXES[e.from].color} />
              <stop offset="100%" stopColor={AXES[e.to].color} />
            </linearGradient>
          );
        })}
      </defs>

      {/* concentric grid rings; the outer ring is the 0-10 bounds */}
      {grid.map((L) => (
        <polygon
          key={L}
          points={poly(() => R * (L / 10))}
          fill="none"
          stroke={L === 10 ? "var(--color-fog)" : "var(--color-edge)"}
          strokeWidth={L === 10 ? 1.25 : 0.75}
          strokeDasharray={L === 10 ? undefined : "2 3"}
          opacity={L === 10 ? 0.85 : 0.45}
        />
      ))}

      {/* axis spokes */}
      {AXES.map((a) => {
        const [vx, vy] = at(a.ang, R);
        return <line key={a.key} x1={cx} y1={cy} x2={vx} y2={vy} stroke="var(--color-edge)" strokeWidth={0.75} opacity={0.6} />;
      })}

      {/* scale numbers up the micro (top) axis */}
      {grid.map((L) => {
        const [x, y] = at(-90, R * (L / 10));
        return (
          <text key={L} x={x + 5} y={y + 3} fontSize={7} fill="var(--color-fog)" opacity={0.55}>
            {L}
          </text>
        );
      })}

      {/* score polygon, filled with layered axis gradients (deeper toward heaviest) */}
      <polygon points={scorePolygon} fill="var(--color-ink2)" fillOpacity={0.5} />
      {AXES.map((a) => (
        <polygon key={a.key} points={scorePolygon} fill={`url(#${uid}-${a.key})`} />
      ))}
      {/* multi-color edges — each blends its two axis colors */}
      {edges.map((e, i) => {
        const [x1, y1] = scorePts[e.from];
        const [x2, y2] = scorePts[e.to];
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={`url(#${uid}-e${i})`}
            strokeWidth={2.25}
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 3px rgba(255,255,255,0.3))" }}
          />
        );
      })}

      {/* score dots, colored per axis */}
      {AXES.map((a, i) => {
        const [x, y] = scorePts[i];
        return (
          <g key={a.key}>
            <circle cx={x} cy={y} r={6} fill={a.color} opacity={0.2} />
            <circle cx={x} cy={y} r={3.5} fill={a.color} style={{ filter: `drop-shadow(0 0 4px ${a.color})` }} />
          </g>
        );
      })}

      {/* axis labels with the score, at each vertex */}
      <text x={cx} y={at(-90, R)[1] - 9} textAnchor="middle" fontSize={11} fontWeight={700} fill={AXES[0].color}>
        Micro {game.micro}
      </text>
      <text x={at(30, R)[0] + 8} y={at(30, R)[1] + 14} textAnchor="start" fontSize={11} fontWeight={700} fill={AXES[1].color}>
        Meso {game.meso}
      </text>
      <text x={at(150, R)[0] - 8} y={at(150, R)[1] + 14} textAnchor="end" fontSize={11} fontWeight={700} fill={AXES[2].color}>
        Macro {game.macro}
      </text>
    </svg>
  );
}
