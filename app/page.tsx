"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import AuthPanel from "@/components/AuthPanel";
import StylePanel from "@/components/StylePanel";
import GameScores from "@/components/GameScores";

type Game = {
  id: string;
  slug: string;
  name: string;
  micro: number;
  meso: number;
  macro: number;
  confidence?: string | null;
  reasoning: { micro: string; meso: string; macro: string };
  steam_url?: string | null;
  thumbnail?: string | null;
  genre?: string | null;
  subgenres?: string[] | null;
  publisher?: string | null;
  release_year?: number | null;
};

type ScoreResult = {
  recognized?: boolean;
  game?: Game;
  cached?: boolean;
  error?: string;
};

type SpotlightGame = {
  id: string;
  name: string;
  micro: number;
  meso: number;
  macro: number;
  thumbnail?: string | null;
  release_year?: number | null;
};

const AXES = [
  { key: "micro", label: "Micro", color: "var(--color-micro)", desc: "moment-to-moment execution — aim, reactions, combos" },
  { key: "meso", label: "Meso", color: "var(--color-meso)", desc: "mid-term tactics — reads, cooldowns, engages" },
  { key: "macro", label: "Macro", color: "var(--color-macro)", desc: "long-term strategy — economy, map, build order" },
] as const;

const SUGGESTIONS = ["Counter-Strike 2", "Civilization VI", "Dota 2", "Stardew Valley"];

export default function Home() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<string[]>([]);
  const [spotlight, setSpotlight] = useState<SpotlightGame[] | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [library, setLibrary] = useState<Game[] | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSpotlight = useCallback(async () => {
    try {
      const res = await fetch("/api/spotlight");
      const data = await res.json();
      setSpotlight(data.games ?? []);
    } catch {
      setSpotlight([]);
    }
  }, []);

  const loadLibrary = useCallback(async () => {
    try {
      const res = await fetch("/api/library");
      if (!res.ok) return setLibrary(null);
      const data = await res.json();
      setLibrary(data.games ?? []);
    } catch {
      setLibrary(null);
    }
  }, []);

  useEffect(() => { loadSpotlight(); }, [loadSpotlight]);
  useEffect(() => {
    if (user) loadLibrary();
    else setLibrary(null);
  }, [user, loadLibrary]);

  async function search(q?: string) {
    const query = (q ?? input).trim();
    if (!query || loading) return;
    if (q) setInput(q);
    setMatches([]);
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

  function onInputChange(value: string) {
    setInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) return setMatches([]);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(value.trim())}`);
        const data = await res.json();
        setMatches(data.suggestions ?? []);
      } catch {
        setMatches([]);
      }
    }, 200);
  }

  async function addToLibrary(gameId: string) {
    await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_id: gameId }),
    });
    loadLibrary();
  }
  async function removeFromLibrary(gameId: string) {
    await fetch(`/api/library?game_id=${encodeURIComponent(gameId)}`, { method: "DELETE" });
    loadLibrary();
  }
  const inLibrary = (gameId: string) => library?.some((g) => g.id === gameId) ?? false;

  const g = result?.game;
  const showLanding = !result && !loading;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      {/* ── Header ───────────────────────────── */}
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <button onClick={() => { setResult(null); setInput(""); }} className="group flex items-baseline gap-2">
          <span className="font-display text-3xl font-bold tracking-tight glow-text" style={{ ["--glow" as string]: "var(--color-macro)" }}>
            3M
          </span>
          <span className="flex gap-1">
            <i className="h-2 w-5 rounded-full" style={{ background: "var(--color-micro)" }} />
            <i className="h-2 w-5 rounded-full" style={{ background: "var(--color-meso)" }} />
            <i className="h-2 w-5 rounded-full" style={{ background: "var(--color-macro)" }} />
          </span>
        </button>
        <AuthPanel onUser={setUser} />
      </header>

      <div className="grid gap-12 lg:grid-cols-[1fr_280px]">
        {/* ── Main column ──────────────────────── */}
        <section className="order-first">
          {/* Search */}
          <div className="relative">
            <div className="glow-box flex gap-2 rounded-xl bg-panel p-2" style={{ ["--glow" as string]: "var(--color-macro)" }}>
              <input
                className="flex-1 bg-transparent px-3 py-2.5 text-lg text-paper placeholder-fog outline-none"
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                onBlur={() => setTimeout(() => setMatches([]), 150)}
                placeholder="Enter a game…"
                autoFocus
              />
              <button
                onClick={() => search()}
                disabled={loading}
                className="font-display rounded-lg bg-macro px-6 font-bold uppercase tracking-wider text-ink transition hover:brightness-110 disabled:opacity-40"
                style={{ background: "var(--color-macro)" }}
              >
                {loading ? "···" : "Score"}
              </button>
            </div>

            {matches.length > 0 && (
              <ul className="glow-box absolute z-10 mt-2 w-full overflow-hidden rounded-xl bg-panel" style={{ ["--glow" as string]: "var(--color-edge)" }}>
                {matches.map((m) => (
                  <li key={m}>
                    <button
                      onMouseDown={() => search(m)}
                      className="block w-full px-4 py-2.5 text-left text-sm transition hover:bg-edge"
                    >
                      {m}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Landing / empty state */}
          {showLanding && (
            <div className="pop-in mt-10">
              <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
                What kind of skill does a game{" "}
                <span className="whitespace-nowrap">actually ask of you?</span>
              </h1>
              <p className="mt-3 max-w-lg text-fog">
                Every game is three skills at once. Type one and get it scored
                0–10 on each axis, judged against fixed anchors.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {AXES.map((a) => (
                  <div
                    key={a.key}
                    className="glow-box rounded-xl bg-panel p-4"
                    style={{ ["--glow" as string]: a.color }}
                  >
                    <div className="font-display text-lg font-bold glow-text" style={{ color: a.color, ["--glow" as string]: a.color }}>
                      {a.label}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-fog">{a.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <p className="mb-2 text-xs uppercase tracking-widest text-fog">Try one</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => search(s)}
                      className="rounded-full border border-edge px-3 py-1.5 text-sm text-fog transition hover:border-macro hover:text-paper"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="mt-10 space-y-7">
              {AXES.map((a) => (
                <div key={a.key} className="animate-pulse">
                  <div className="mb-2 h-4 w-20 rounded bg-edge" />
                  <div className="h-3 rounded-full bg-edge" />
                </div>
              ))}
            </div>
          )}

          {result?.recognized === false && (
            <p className="pop-in mt-10 text-lg text-fog">
              Couldn&apos;t identify that game. Typo, or something very obscure?
            </p>
          )}
          {result?.error && (
            <p className="pop-in mt-10 text-lg" style={{ color: "var(--color-micro)" }}>
              Something went wrong: {result.error}
            </p>
          )}

          {/* Game card */}
          {g && (
            <div className="pop-in mt-8">
              <GameScores
                game={g}
                cached={result?.cached}
                actionSlot={
                  <>
                    {g.steam_url && (
                      <a
                        href={g.steam_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-edge px-4 py-2 text-sm font-semibold transition hover:border-macro hover:text-paper"
                      >
                        View on Steam ↗
                      </a>
                    )}
                    <Link
                      href={`/game/${g.slug}`}
                      className="rounded-lg border border-edge px-4 py-2 text-sm font-semibold text-fog transition hover:border-macro hover:text-paper"
                    >
                      Permalink ↗
                    </Link>
                    {user &&
                      (inLibrary(g.id) ? (
                        <button
                          onClick={() => removeFromLibrary(g.id)}
                          className="rounded-lg border px-4 py-2 text-sm font-semibold text-fog transition hover:text-paper"
                          style={{ borderColor: "var(--color-micro)" }}
                        >
                          ✓ In library
                        </button>
                      ) : (
                        <button
                          onClick={() => addToLibrary(g.id)}
                          className="font-display rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wider text-ink transition hover:brightness-110"
                          style={{ background: "var(--color-macro)" }}
                        >
                          + Library
                        </button>
                      ))}
                  </>
                }
              />
            </div>
          )}

          {/* Your style */}
          {user && library !== null && (
            <section className="mt-14">
              <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-fog">
                Your style
              </h2>
              <StylePanel games={library} onRemove={removeFromLibrary} />
            </section>
          )}

          <footer className="mt-16 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-relaxed text-fog/60">
            <Link href="/about" className="transition hover:text-fog">How scoring works</Link>
            <Link href="/browse?top=1" className="transition hover:text-fog">Top 50</Link>
            <Link href="/compare" className="transition hover:text-fog">Compare</Link>
            <span>· LLM-judged against fixed anchors, then cached.</span>
          </footer>
        </section>

        {/* ── Spotlight sidebar ────────────────── */}
        <aside className="order-last">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-fog">
              Top 50 · spotlight
            </h2>
            <div className="flex items-center gap-2">
              <Link
                href="/browse?top=1"
                className="rounded-full border border-edge px-2.5 py-0.5 text-xs text-fog transition hover:border-macro hover:text-paper"
              >
                all 50 →
              </Link>
              <button
                onClick={loadSpotlight}
                title="Show three different games"
                className="rounded-full border border-edge px-2.5 py-0.5 text-xs text-fog transition hover:border-macro hover:text-paper"
              >
                ⟳
              </button>
            </div>
          </div>

          {spotlight === null && (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-panel" />
              ))}
            </div>
          )}

          {spotlight?.length === 0 && (
            <p className="text-xs leading-relaxed text-fog/70">
              Nothing here yet — run <code className="text-fog">npm run seed:top50</code>.
            </p>
          )}

          <div className="space-y-4">
            {spotlight?.map((s) => (
              <button
                key={s.id}
                onClick={() => search(s.name)}
                className="group block w-full overflow-hidden rounded-xl border border-edge bg-panel text-left transition hover:border-macro"
              >
                {s.thumbnail && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={s.thumbnail} alt="" className="h-20 w-full object-cover transition group-hover:brightness-110" />
                )}
                <div className="p-3">
                  <p className="mb-2 truncate text-sm font-semibold">
                    {s.name}
                    {s.release_year && <span className="ml-1.5 text-xs font-normal text-fog">{s.release_year}</span>}
                  </p>
                  <div className="space-y-1">
                    {AXES.map((a) => (
                      <div key={a.key} className="flex items-center gap-2">
                        <span className="w-2 font-display text-[10px] font-bold" style={{ color: a.color }}>{a.label[0]}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-edge">
                          <div className="h-full rounded-full" style={{ width: `${s[a.key] * 10}%`, background: a.color, boxShadow: `0 0 8px ${a.color}` }} />
                        </div>
                        <span className="w-4 text-right font-mono text-[10px] tabular-nums text-fog">{s[a.key]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
