// Derived gaming-style archetype from average micro/meso/macro.
// Shared by StylePanel, the /style share page, and its OG image so they
// never disagree.

export type Avg = { micro: number; meso: number; macro: number };

const META = {
  micro: { name: "Executor", color: "var(--color-micro)", hex: "#ff2e63" },
  meso: { name: "Tactician", color: "var(--color-meso)", hex: "#ffc23d" },
  macro: { name: "Strategist", color: "var(--color-macro)", hex: "#29e3ff" },
} as const;

export function archetype(avg: Avg): { name: string; color: string; hex: string } {
  const entries = Object.entries(avg) as ["micro" | "meso" | "macro", number][];
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  if (sorted[0][1] - sorted[2][1] < 1)
    return { name: "Hybrid", color: "var(--color-paper)", hex: "#eef2fb" };
  return META[sorted[0][0]];
}

// share-code: "micro-meso-macro-count", e.g. "4.2-5.1-8.0-12"
export function encodeStyle(avg: Avg, count: number): string {
  return `${avg.micro.toFixed(1)}-${avg.meso.toFixed(1)}-${avg.macro.toFixed(1)}-${count}`;
}

export function decodeStyle(
  code: string
): { avg: Avg; count: number } | null {
  const parts = code.split("-").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const clamp = (n: number) => Math.min(10, Math.max(0, n));
  return {
    avg: { micro: clamp(parts[0]), meso: clamp(parts[1]), macro: clamp(parts[2]) },
    count: Math.max(0, Math.round(parts[3])),
  };
}
