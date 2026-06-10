"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import AuthPanel from "@/components/AuthPanel";
import StylePanel from "@/components/StylePanel";

type Game = {
  id: string;
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
  { key: "micro", label: "Micro", color: "var(--color-micro)", desc: "moment-to-moment execution" },
  { key: "meso", label: "Meso", color: "var(--color-meso)", desc: "mid-term tactics" },
  { key: "macro", label: "Macro", color: "var(--color-macro)", desc: "long-term strategy" },
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

  const loadLibrary = useCallback(async () => {
    try {
      const res = await fetch("/api/library");
      if (!res.ok) {
        setLibrary(null);
        return;
      }
      const data = await res.json();
      setLibrary(data.games ?? []);
    } catch {
      setLibrary(null);
    }
  }, []);

  useEffect(() => {
    if (user) loadLibrary();
    else setLibrary(null);
  }, [user, loadLibrary]);

  async function addToLibrary(gameId: string) {
    await fetch("/api/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_id: gameId }),
    });
    loadLibrary();
  }

  async function removeFromLibrary(gameId: string) {
    await fetch(`/api/library?game_id=${encodeURIComponent(gameId)}`, {
      method: "DELETE",
    });
    loadLibrary();
  }

  const inLibrary = (gameId: string) =>
    library?.some((g) => g.id === gameId) ?? false;

  const loadSpotlight = useCallback(async () => {
    try {
      const res = await fetch("/api/spotlight");
      const data = await res.json();
      setSpotlight(data.games ?? []);
    } catch {
      setSpotlight([]);
    }
  }, []);

  useEffect(() => {
    loadSpotlight();
  }, [loadSpotlight]);

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
    if (value.trim().length < 2) {
      setMatches([]);
      return;
    }
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

  const g = result?.game;
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
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
        </div>
        <AuthPanel onUser={setUser} />
      </header>

      <div className="grid gap-12 lg:grid-cols-[280px_1fr]">
        {/* ── Top-50 spotlight ───────────────────────────── */}
        <aside className="order-last lg:order-first">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-fog">
              Top 50 spotlight
            </h2>
            <button
              onClick={loadSpotlight}
              title="Show three different games"
              className="rounded-full border border-edge px-2.5 py-0.5 text-xs text-fog transition hover:border-fog hover:text-paper"
            >
              shuffle
            </button>
          </div>

          {spotlight === null && (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-panel" />
              ))}
            </div>
          )}

          {spotlight?.length === 0 && (
            <p className="text-xs leading-relaxed text-fog/70">
              Nothing here yet — the top-50 hasn&apos;t been seeded
              (<code className="text-fog">npm run seed:top50</code>).
            </p>
          )}

          <div className="space-y-4">
            {spotlight?.map((s) => (
              <button
                key={s.id}
                onClick={() => search(s.name)}
                className="block w-full overflow-hidden rounded-xl border border-edge bg-panel text-left transition hover:border-fog"
              >
                {s.thumbnail && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={s.thumbnail} alt="" className="h-20 w-full object-cover" />
                )}
                <div className="p-3">
                  <p className="mb-2 truncate text-sm font-semibold">
                    {s.name}
                    {s.release_year && (
                      <span className="ml-1.5 text-xs font-normal text-fog">{s.release_year}</span>
                    )}
                  </p>
                  <div className="space-y-1">
                    {AXES.map((a) => (
                      <div key={a.key} className="flex items-center gap-2">
                        <span className="w-1 text-[10px] text-fog">{a.label[0]}</span>
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-edge">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${s[a.key] * 10}%`, backgroundColor: a.color }}
                          />
                        </div>
                        <span className="w-4 text-right font-mono text-[10px] tabular-nums text-fog">
                          {s[a.key]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* ── Search + result ────────────────────────────── */}
        <section>
          <div className="relative">
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-edge bg-panel px-4 py-3 text-paper placeholder-fog outline-none transition focus:border-fog"
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
                className="rounded-lg bg-paper px-5 font-semibold text-ink transition hover:opacity-85 disabled:opacity-40"
              >
                {loading ? "…" : "Score"}
              </button>
            </div>

            {matches.length > 0 && (
              <ul className="absolute z-10 mt-2 w-full overflow-hidden rounded-lg border border-edge bg-panel shadow-xl">
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
            <article className="mt-8 overflow-hidden rounded-2xl border border-edge bg-panel">
              {g.thumbnail && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={g.thumbnail} alt={g.name} className="max-h-44 w-full object-cover" />
              )}

              <div className="p-6">
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <h2 className="text-2xl font-bold">{g.name}</h2>
                  <div className="flex shrink-0 gap-2">
                    {g.confidence && (
                      <span className="rounded-full border border-edge px-2 py-0.5 text-[11px] uppercase tracking-wider text-fog">
                        {g.confidence}
                      </span>
                    )}
                    {result?.cached && (
                      <span className="rounded-full border border-edge px-2 py-0.5 text-[11px] uppercase tracking-wider text-fog">
                        cached
                      </span>
                    )}
                  </div>
                </div>

                {(g.release_year || g.publisher) && (
                  <p className="text-sm text-fog">
                    {[g.release_year, g.publisher].filter(Boolean).join(" · ")}
                  </p>
                )}

                {(g.genre || g.subgenres?.length) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {g.genre && (
                      <span className="rounded-full bg-edge px-2.5 py-0.5 text-xs font-medium">
                        {g.genre}
                      </span>
                    )}
                    {g.subgenres?.map((sg) => (
                      <span
                        key={sg}
                        className="rounded-full border border-edge px-2.5 py-0.5 text-xs text-fog"
                      >
                        {sg}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-7 space-y-7">
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

                <div className="mt-7 flex flex-wrap gap-2">
                  {g.steam_url && (
                    <a
                      href={g.steam_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-edge px-4 py-2 text-sm font-semibold text-paper transition hover:border-fog"
                    >
                      View on Steam ↗
                    </a>
                  )}
                  {user &&
                    (inLibrary(g.id) ? (
                      <button
                        onClick={() => removeFromLibrary(g.id)}
                        className="rounded-lg border border-edge px-4 py-2 text-sm font-semibold text-fog transition hover:border-micro hover:text-micro"
                      >
                        ✓ In library
                      </button>
                    ) : (
                      <button
                        onClick={() => addToLibrary(g.id)}
                        className="rounded-lg bg-paper px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-85"
                      >
                        + Library
                      </button>
                    ))}
                </div>
              </div>
            </article>
          )}

          {user && library !== null && (
            <section className="mt-14">
              <h2 className="text-xs font-bold uppercase tracking-widest text-fog">
                Your style
              </h2>
              <StylePanel games={library} onRemove={removeFromLibrary} />
            </section>
          )}

          <footer className="mt-16 text-xs text-fog/60">
            Scores are LLM-judged against fixed anchors and cached — the first
            search of a game does the thinking, every search after is instant.
          </footer>
        </section>
      </div>
    </main>
  );
}
