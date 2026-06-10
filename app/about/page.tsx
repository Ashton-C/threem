import Link from "next/link";
import { AXIS_INFO, ANCHORS, AXIS_KEYS } from "@/lib/anchors";

export const metadata = { title: "How scoring works — 3M" };

const TIERS = [
  { key: "high", label: "9–10" },
  { key: "mid", label: "5–6" },
  { key: "low", label: "1–2" },
] as const;

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
      <Link href="/" className="font-display text-sm text-fog transition hover:text-paper">
        ← 3M
      </Link>
      <h1 className="font-display mt-2 text-3xl font-bold">How scoring works</h1>
      <p className="mt-2 max-w-xl text-fog">
        Every game is scored 0–10 on three independent axes. A game can be high
        or low on all three at once. Scores are LLM-judged against the fixed
        anchor games below, so the scale stays calibrated rather than drifting.
      </p>

      <div className="mt-10 space-y-10">
        {AXIS_KEYS.map((ax) => {
          const info = AXIS_INFO[ax];
          return (
            <section key={ax}>
              <h2 className="font-display text-2xl font-bold glow-text" style={{ color: info.color, ["--glow" as string]: info.color }}>
                {info.label}
              </h2>
              <p className="mt-1 max-w-xl text-sm text-fog">{info.blurb}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {TIERS.map((t) => (
                  <div key={t.key} className="rounded-xl border border-edge bg-panel p-4">
                    <div className="mb-2 flex items-baseline gap-2">
                      <span className="font-mono text-lg font-bold" style={{ color: info.color }}>{t.label}</span>
                      <span className="text-xs uppercase tracking-wider text-fog">
                        {t.key === "high" ? "anchors" : t.key === "mid" ? "middle" : "low"}
                      </span>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {ANCHORS[ax][t.key].map((g) => (
                        <li key={g} className="text-fog">{g}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-12 text-xs leading-relaxed text-fog/60">
        The first lookup of a game runs the model; the result is cached, so every
        later search — and every spelling — is instant and free.
      </p>
    </main>
  );
}
