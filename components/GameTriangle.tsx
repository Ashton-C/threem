"use client";
import { useId } from "react";

// Single-game ternary view: one dot per axis (size/glow ∝ that axis's
// score) plus three layered radial gradients that deepen the interior
// toward the heaviest-weighted axis. Pure SVG.

type Scores = { micro: number; meso: number; macro: number };

const AXES = [
  { key: "micro", label: "Micro", color: "#ff2e63", rgb: "255,46,99" },
  { key: "meso", label: "Meso", color: "#ffc23d", rgb: "255,194,61" },
  { key: "macro", label: "Macro", color: "#29e3ff", rgb: "41,227,255" },
] as const;

export default function GameTriangle({
  game,
  size = 200,
}: {
  game: Scores;
  size?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const pad = 30;
  const W = size;
  const H = size * 0.866;

  // vertices: Micro top, Meso bottom-left, Macro bottom-right
  const V = {
    micro: [W / 2, 0],
    meso: [0, H],
    macro: [W, H],
  } as const;

  const sum = game.micro + game.meso + game.macro || 1;
  const weight = {
    micro: game.micro / sum,
    meso: game.meso / sum,
    macro: game.macro / sum,
  };

  const tri = `${V.micro[0]},${V.micro[1]} ${V.meso[0]},${V.meso[1]} ${V.macro[0]},${V.macro[1]}`;
  const reach = W * 1.05; // gradient radius — spans the triangle

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`}
      width="100%"
      style={{ maxWidth: size + pad * 2 }}
      role="img"
      aria-label="This game's micro/meso/macro balance"
    >
      <defs>
        {AXES.map((a) => {
          const [cx, cy] = V[a.key];
          // center opacity scales with this axis's weight -> heaviest corner is deepest
          const o = (0.2 + 0.85 * weight[a.key]).toFixed(3);
          return (
            <radialGradient
              key={a.key}
              id={`${uid}-${a.key}`}
              gradientUnits="userSpaceOnUse"
              cx={cx}
              cy={cy}
              r={reach}
            >
              <stop offset="0%" stopColor={`rgba(${a.rgb},${o})`} />
              <stop offset="70%" stopColor={`rgba(${a.rgb},0)`} />
            </radialGradient>
          );
        })}
      </defs>

      {/* base + layered axis gradients (additive lean toward heaviest) */}
      <polygon points={tri} fill="var(--color-ink2)" />
      {AXES.map((a) => (
        <polygon key={a.key} points={tri} fill={`url(#${uid}-${a.key})`} />
      ))}
      <polygon points={tri} fill="none" stroke="var(--color-edge)" strokeWidth={1} />

      {/* one dot per axis, at its vertex, sized + glowing by raw score */}
      {AXES.map((a) => {
        const [cx, cy] = V[a.key];
        const r = 3.5 + (game[a.key] / 10) * 5.5;
        return (
          <g key={a.key}>
            <circle cx={cx} cy={cy} r={r + 4} fill={a.color} opacity={0.18} />
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={a.color}
              style={{ filter: `drop-shadow(0 0 5px ${a.color})` }}
            />
          </g>
        );
      })}

      {/* axis labels with the score */}
      <text x={V.micro[0]} y={-12} textAnchor="middle" fontSize={12} fontWeight={700} fill={AXES[0].color}>
        Micro {game.micro}
      </text>
      <text x={V.meso[0] - 4} y={H + 20} textAnchor="start" fontSize={12} fontWeight={700} fill={AXES[1].color}>
        Meso {game.meso}
      </text>
      <text x={V.macro[0] + 4} y={H + 20} textAnchor="end" fontSize={12} fontWeight={700} fill={AXES[2].color}>
        Macro {game.macro}
      </text>
    </svg>
  );
}
