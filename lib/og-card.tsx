import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const C = {
  ink: "#06080d",
  panel: "#0e131e",
  edge: "#1d2740",
  fog: "#7e8aa6",
  paper: "#eef2fb",
  micro: "#ff2e63",
  meso: "#ffc23d",
  macro: "#29e3ff",
};

const AXES = [
  { key: "micro", label: "MICRO", color: C.micro },
  { key: "meso", label: "MESO", color: C.meso },
  { key: "macro", label: "MACRO", color: C.macro },
] as const;

// Shared 1200x630 share card. Pure flexbox + one inline SVG triangle
// (Satori-safe — flat fills, no CSS gradients).
export function ogImage(opts: {
  name: string;
  sub?: string;
  micro: number;
  meso: number;
  macro: number;
  footer?: string;
}) {
  const { name, sub, micro, meso, macro, footer } = opts;
  const scores = { micro, meso, macro };

  // triangle geometry: Micro top, Meso bottom-left, Macro bottom-right
  const TW = 340;
  const TH = 295;
  const V = { micro: [TW / 2, 0], meso: [0, TH], macro: [TW, TH] } as const;
  const tri = `${V.micro[0]},${V.micro[1]} ${V.meso[0]},${V.meso[1]} ${V.macro[0]},${V.macro[1]}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: C.ink,
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        {/* brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", color: C.macro, fontSize: 34, fontWeight: 700, letterSpacing: 2 }}>
            3M
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ width: 26, height: 8, borderRadius: 4, background: C.micro }} />
            <div style={{ width: 26, height: 8, borderRadius: 4, background: C.meso }} />
            <div style={{ width: 26, height: 8, borderRadius: 4, background: C.macro }} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
          {/* left: name + bars */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", color: C.paper, fontSize: 60, fontWeight: 700, lineHeight: 1.05 }}>
              {name}
            </div>
            {sub && (
              <div style={{ display: "flex", color: C.fog, fontSize: 26, marginTop: 10 }}>{sub}</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 36 }}>
              {AXES.map((a) => (
                <div key={a.key} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ display: "flex", color: a.color, fontSize: 20, fontWeight: 700, width: 78 }}>
                    {a.label}
                  </div>
                  <div style={{ display: "flex", flex: 1, height: 16, borderRadius: 8, background: C.edge }}>
                    <div
                      style={{
                        width: `${scores[a.key] * 10}%`,
                        height: "100%",
                        borderRadius: 8,
                        background: a.color,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      color: C.paper,
                      fontSize: 26,
                      fontWeight: 700,
                      width: 56,
                    }}
                  >
                    {scores[a.key]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* right: triangle */}
          <div style={{ display: "flex" }}>
            <svg width={TW} height={TH + 20} viewBox={`0 -10 ${TW} ${TH + 20}`}>
              <polygon points={tri} fill={C.panel} stroke={C.edge} strokeWidth={2} />
              {AXES.map((a) => {
                const [cx, cy] = V[a.key];
                const r = 7 + (scores[a.key] / 10) * 12;
                return (
                  <g key={a.key}>
                    <circle cx={cx} cy={cy} r={r + 6} fill={a.color} fillOpacity={0.2} />
                    <circle cx={cx} cy={cy} r={r} fill={a.color} />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div style={{ display: "flex", color: C.fog, fontSize: 22 }}>
          {footer ?? "micro · meso · macro — what skill does a game ask of you?"}
        </div>
      </div>
    ),
    OG_SIZE
  );
}
