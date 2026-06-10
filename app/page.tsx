"use client";
import { useState } from "react";

type Game = {
  name: string;
  micro: number;
  meso: number;
  macro: number;
  confidence?: string;
  reasoning: { micro: string; meso: string; macro: string };
};

type ScoreResult = {
  recognized?: boolean;
  game?: Game;
  cached?: boolean;
  error?: string;
};

const AXES = [
  { key: "micro", label: "Micro", color: "var(--color-micro)", desc: "moment-to-moment execution" },
  { key: "meso", label: "Meso", color: "var(--color-meso)", desc: "mid-term tactics" },
  { key: "macro", label: "Macro", color: "var(--color-macro)", desc: "long-term strategy" },
] as const;

const SUGGESTIONS = ["Counter-Strike 2", "Civilization VI", "Dota 2", "Stardew Valley"];

export default function Home() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(q?: string) {
    const query = (q ?? input).trim();
    if (!query || loading) return;
    if (q) setInput(q);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: query }),
      });
      setResult(await res.json());
    } catch {
      setResult({ error: "request failed" });
    }
    setLoading(false);
  }

  const g = result?.game;
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <header className="mb-10">
        <h1 className="text-4xl font-black tracking-tight">
          3M<span className="text-fog">.</span>
        </h1>
        <p className="mt-1 text-sm text-fog">
          <span style={{ color: "var(--color-micro)" }}>micro</span>
          {" · "}
          <span style={{ color: "var(--color-meso)" }}>meso</span>
          {" · "}
          <span style={{ color: "var(--color-macro)" }}>macro</span>
          {" — what kind of skill does a game actually ask of you?"}
        </p>
      </header>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-edge bg-panel px-4 py-3 text-paper placeholder-fog outline-none transition focus:border-fog"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Enter a game…"
          autoFocus
        />
        <button
          onClick={() => search()}
          disabled={loading}
          className="rounded-lg bg-paper px-5 font-semibold text-ink transition hover:opacity-85 disabled:opacity-40"
        >
          {loading ? "…" : "Score"}
        </button>
      </div>

      {!result && !loading && (
        <div className="mt-4 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => search(s)}
              className="rounded-full border border-edge px-3 py-1 text-xs text-fog transition hover:border-fog hover:text-paper"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="mt-10 space-y-6">
          {AXES.map((a) => (
            <div key={a.key} className="animate-pulse">
              <div className="mb-2 h-3 w-16 rounded bg-edge" />
              <div className="h-2 rounded bg-edge" />
            </div>
          ))}
        </div>
      )}

      {result?.recognized === false && (
        <p className="mt-10 text-fog">
          Couldn&apos;t identify that game. Typo, or something very obscure?
        </p>
      )}

      {result?.error && (
        <p className="mt-10 text-micro">Something went wrong: {result.error}</p>
      )}

      {g && (
        <section className="mt-10">
          <div className="mb-6 flex items-baseline justify-between gap-3">
            <h2 className="text-2xl font-bold">{g.name}</h2>
            <div className="flex shrink-0 gap-2">
              {g.confidence && (
                <span className="rounded-full border border-edge px-2 py-0.5 text-[11px] uppercase tracking-wider text-fog">
                  {g.confidence} confidence
                </span>
              )}
              {result?.cached && (
                <span className="rounded-full border border-edge px-2 py-0.5 text-[11px] uppercase tracking-wider text-fog">
                  cached
                </span>
              )}
            </div>
          </div>

          <div className="space-y-7">
            {AXES.map((a, i) => (
              <div key={a.key}>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="font-semibold" style={{ color: a.color }}>
                    {a.label}
                    <span className="ml-2 text-xs font-normal text-fog">{a.desc}</span>
                  </span>
                  <span className="font-mono text-lg font-bold tabular-nums">
                    {g[a.key]}
                    <span className="text-xs font-normal text-fog">/10</span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-edge">
                  <div
                    className="h-full origin-left rounded-full"
                    style={{
                      width: `${g[a.key] * 10}%`,
                      backgroundColor: a.color,
                      animation: `bar-grow 0.7s ${i * 0.12}s cubic-bezier(0.22,1,0.36,1) backwards`,
                    }}
                  />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-fog">{g.reasoning[a.key]}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-16 text-xs text-fog/60">
        Scores are LLM-judged against fixed anchors and cached — the first
        search of a game does the thinking, every search after is instant.
      </footer>
    </main>
  );
}
