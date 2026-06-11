"use client";

// Single-game radar: each axis runs from the center (0) out to its vertex
// (10); the score plots along its own axis and the three points connect
// into a filled polygon. Bigger triangle = more demanding game.

type Scores = { micro: number; meso: number; macro: number };

const AXES = [
  { key: "micro", label: "Micro", color: "#ff2e63", ang: -90 }, // top
  { key: "meso", label: "Meso", color: "#ffc23d", ang: 30 }, // bottom-right
  { key: "macro", label: "Macro", color: "#29e3ff", ang: 150 }, // bottom-left
] as const;

const FILL = "#29e3ff"; // polygon accent (cyan)
const rad = (d: number) => (d * Math.PI) / 180;

export default function GameTriangle({
  game,
  size = 200,
}: {
  game: Scores;
  size?: number;
}) {
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

  return (
    <svg
      viewBox={`${-size * 0.16} 0 ${size * 1.32} ${size}`}
      width="100%"
      style={{ maxWidth: size * 1.32 }}
      role="img"
      aria-label="Radar of this game's micro/meso/macro scores"
    >
      {/* concentric grid rings */}
      {grid.map((L) => (
        <polygon
          key={L}
          points={poly(() => R * (L / 10))}
          fill="none"
          stroke="var(--color-edge)"
          strokeWidth={0.75}
          strokeDasharray={L === 10 ? undefined : "2 3"}
          opacity={L === 10 ? 0.9 : 0.5}
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

      {/* the game's score polygon */}
      <polygon
        points={scorePts.map((p) => p.join(",")).join(" ")}
        fill={FILL}
        fillOpacity={0.16}
        stroke={FILL}
        strokeWidth={2}
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 5px ${FILL})` }}
      />

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
