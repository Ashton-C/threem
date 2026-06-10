"use client";

// Triangle (ternary) heatmap of a game library in 3M space.
// Each game's scores normalize to barycentric weights; the triangle is
// subdivided into N rows of cells and intensity = games per cell.
// Pure SVG, no chart library.

type Point = { micro: number; meso: number; macro: number };

const N = 10; // subdivision rows -> N^2 cells

// palette lerp: cyan (sparse) -> rose (dense), matching the neon axis colors
const LOW = [41, 227, 255];
const HIGH = [255, 46, 99];

function ramp(t: number): string {
  const c = LOW.map((l, i) => Math.round(l + (HIGH[i] - l) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export default function TernaryHeatmap({
  points,
  size = 340,
}: {
  points: Point[];
  size?: number;
}) {
  const pad = 34;
  const W = size;
  const H = size * 0.866;
  // vertices: Micro top, Meso bottom-left, Macro bottom-right
  const A = [W / 2, 0];
  const B = [0, H];
  const C = [W, H];

  const toXY = (u: number, v: number, w: number): [number, number] => [
    u * A[0] + v * B[0] + w * C[0],
    u * A[1] + v * B[1] + w * C[1],
  ];

  // barycentric weights per game
  const weights = points
    .map((p) => {
      const sum = p.micro + p.meso + p.macro;
      if (!sum) return null;
      return [p.micro / sum, p.meso / sum, p.macro / sum] as const;
    })
    .filter((x): x is readonly [number, number, number] => x !== null);

  // assign each game to a subdivision cell
  const counts = new Map<string, number>();
  for (const [u, v, w] of weights) {
    let i = Math.min(Math.floor(u * N), N - 1);
    let j = Math.min(Math.floor(v * N), N - 1);
    let k = Math.min(Math.floor(w * N), N - 1);
    while (i + j + k > N - 1) {
      if (i >= j && i >= k && i > 0) i--;
      else if (j >= k && j > 0) j--;
      else k--;
    }
    while (i + j + k < N - 2) {
      if (i <= j && i <= k) i++;
      else if (j <= k) j++;
      else k++;
    }
    const key = `${i},${j},${k}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const max = Math.max(1, ...counts.values());

  // enumerate all cells: upward (i+j+k = N-1) and downward (= N-2)
  const cells: { pts: string; key: string; count: number }[] = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j + i < N; j++) {
      const kUp = N - 1 - i - j;
      if (kUp >= 0) {
        const verts = [
          toXY((i + 1) / N, j / N, kUp / N),
          toXY(i / N, (j + 1) / N, kUp / N),
          toXY(i / N, j / N, (kUp + 1) / N),
        ];
        cells.push({
          key: `u${i},${j},${kUp}`,
          pts: verts.map((p) => p.join(",")).join(" "),
          count: counts.get(`${i},${j},${kUp}`) ?? 0,
        });
      }
      const kDown = N - 2 - i - j;
      if (kDown >= 0) {
        const verts = [
          toXY((i + 1) / N, (j + 1) / N, kDown / N),
          toXY((i + 1) / N, j / N, (kDown + 1) / N),
          toXY(i / N, (j + 1) / N, (kDown + 1) / N),
        ];
        cells.push({
          key: `d${i},${j},${kDown}`,
          pts: verts.map((p) => p.join(",")).join(" "),
          count: counts.get(`${i},${j},${kDown}`) ?? 0,
        });
      }
    }
  }

  // centroid of the library
  let centroid: [number, number] | null = null;
  if (weights.length) {
    const mu = weights.reduce((s, w) => s + w[0], 0) / weights.length;
    const mv = weights.reduce((s, w) => s + w[1], 0) / weights.length;
    const mw = weights.reduce((s, w) => s + w[2], 0) / weights.length;
    centroid = toXY(mu, mv, mw);
  }

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`}
      width="100%"
      style={{ maxWidth: size + pad * 2 }}
      role="img"
      aria-label="Triangle heatmap of library games in micro/meso/macro space"
    >
      {cells.map((c) => {
        const t = c.count / max;
        return (
          <polygon
            key={c.key}
            points={c.pts}
            fill={c.count ? ramp(t) : "transparent"}
            fillOpacity={c.count ? 0.25 + 0.75 * Math.pow(t, 0.7) : 0}
            stroke="var(--color-edge)"
            strokeWidth={0.5}
          />
        );
      })}

      {centroid && (
        <>
          <circle cx={centroid[0]} cy={centroid[1]} r={7} fill="none" stroke="var(--color-paper)" strokeWidth={1.5} opacity={0.9} />
          <circle cx={centroid[0]} cy={centroid[1]} r={2.5} fill="var(--color-paper)" />
        </>
      )}

      <text x={A[0]} y={-12} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--color-micro)">
        Micro
      </text>
      <text x={B[0] - 6} y={H + 20} textAnchor="start" fontSize={13} fontWeight={700} fill="var(--color-meso)">
        Meso
      </text>
      <text x={C[0] + 6} y={H + 20} textAnchor="end" fontSize={13} fontWeight={700} fill="var(--color-macro)">
        Macro
      </text>
    </svg>
  );
}
