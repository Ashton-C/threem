// Gaming-style archetype from average micro/meso/macro, classified by
// which region of the micro·meso·macro Venn the profile falls in:
// three single-dominant corners, three pairwise edges, and a balanced
// center — seven archetypes in total.
// Shared by StylePanel, the /style share page + OG image, and /stats.

export type Avg = { micro: number; meso: number; macro: number };
export type Archetype = { name: string; color: string; hex: string };

// CSS var + hex (hex for OG image / Satori, which can't read CSS vars)
const SINGLE: Record<"micro" | "meso" | "macro", Archetype> = {
  micro: { name: "Headhunter", color: "var(--color-micro)", hex: "#ff2e63" },
  meso: { name: "Duelist", color: "var(--color-meso)", hex: "#ffc23d" },
  macro: { name: "Architect", color: "var(--color-macro)", hex: "#29e3ff" },
};
const PAIR: Record<string, Archetype> = {
  "micro+meso": { name: "Gladiator", color: "#ff7a4d", hex: "#ff7a4d" },
  "meso+macro": { name: "Commander", color: "#5ee0a0", hex: "#5ee0a0" },
  "micro+macro": { name: "Maestro", color: "#b06bff", hex: "#b06bff" },
};
const CENTER: Archetype = { name: "Polymath", color: "var(--color-paper)", hex: "#eef2fb" };

// every archetype, for legends / stats
export const ARCHETYPES: Archetype[] = [
  SINGLE.micro, SINGLE.meso, SINGLE.macro,
  PAIR["micro+meso"], PAIR["meso+macro"], PAIR["micro+macro"],
  CENTER,
];

const CENTER_THRESHOLD = 0.15; // max-min normalized share below this = balanced

export function archetype(avg: Avg): Archetype {
  const sum = avg.micro + avg.meso + avg.macro || 1;
  const share = { micro: avg.micro / sum, meso: avg.meso / sum, macro: avg.macro / sum };
  const order = (["micro", "meso", "macro"] as ("micro" | "meso" | "macro")[]).sort(
    (a, b) => share[b] - share[a]
  );
  const [hi, mid, lo] = order;

  if (share[hi] - share[lo] < CENTER_THRESHOLD) return CENTER;

  const gapHiMid = share[hi] - share[mid];
  const gapMidLo = share[mid] - share[lo];
  // one axis clearly out front -> single; top two close, third trails -> pair
  if (gapHiMid >= gapMidLo) return SINGLE[hi];

  // canonical key in fixed axis order: micro+meso, meso+macro, micro+macro
  const AX = { micro: 0, meso: 1, macro: 2 };
  const key = [hi, mid].sort((a, b) => AX[a] - AX[b]).join("+");
  return PAIR[key] ?? CENTER;
}

// share-code: "micro-meso-macro-count", e.g. "4.2-5.1-8.0-12"
export function encodeStyle(avg: Avg, count: number): string {
  return `${avg.micro.toFixed(1)}-${avg.meso.toFixed(1)}-${avg.macro.toFixed(1)}-${count}`;
}

export function decodeStyle(code: string): { avg: Avg; count: number } | null {
  const parts = code.split("-").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const clamp = (n: number) => Math.min(10, Math.max(0, n));
  return {
    avg: { micro: clamp(parts[0]), meso: clamp(parts[1]), macro: clamp(parts[2]) },
    count: Math.max(0, Math.round(parts[3])),
  };
}
