"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import AuthPanel from "@/components/AuthPanel";
import StylePanel from "@/components/StylePanel";
import GameScores from "@/components/GameScores";
import GameTriangle from "@/components/GameTriangle";
import IntensityMeter from "@/components/IntensityMeter";
import SteamImport from "@/components/SteamImport";
import SiteHeader from "@/components/SiteHeader";

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
  playtime_minutes?: number | null;
};

type ScoreResult = {
  recognized?: boolean;
  game?: Game;
  cached?: boolean;
  error?: string;
};

type SpotlightGame = {
  id: string;
  slug: string;
  name: string;
  micro: number;
  meso: number;
  macro: number;
  thumbnail?: string | null;
  release_year?: number | null;
  genre?: string | null;
  publisher?: string | null;
};

// a candidate from /api/search — shown in the "which game did you mean?" picker
type SearchHit = {
  name: string;
  year: number | null;
  cover: string | null;
  cached: boolean;
  slug: string | null;
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
  const [candidates, setCandidates] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [spotlight, setSpotlight] = useState<SpotlightGame[] | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [library, setLibrary] = useState<Game[] | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    genres: { genre: string; count: number }[];
  } | null>(null);
  const [steamReturn, setSteamReturn] = useState<string | null>(null);
  const [steamError, setSteamError] = useState(false);
  const [searchedTerm, setSearchedTerm] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const lastSearchRef = useRef<{ q: string; force: boolean }>({ q: "", force: false });

  // tidy up an in-flight score if the user navigates away mid-request
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      controllerRef.current?.abort();
    };
  }, []);

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

  // pick up a verified Steam sign-in return (?steam=<id>) and clean the URL
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const id = p.get("steam");
    if (id) setSteamReturn(id);
    if (p.get("steam_error")) setSteamError(true);
    if (id || p.get("steam_error")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => { loadSpotlight(); }, [loadSpotlight]);
  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setStats({ total: d.total ?? 0, genres: d.genres ?? [] }))
      .catch(() => setStats(null));
  }, []);
  useEffect(() => {
    if (user) loadLibrary();
    else setLibrary(null);
  }, [user, loadLibrary]);

  async function search(q?: string, force = false) {
    const query = (q ?? input).trim();
    if (!query || loading) return;
    if (q) setInput(q);
    lastSearchRef.current = { q: query, force };
    setSearchedTerm(query);
    setCandidates([]);
    setResult(null);
    setElapsed(0);
    setLoading(true);
    // tick a visible "still working" counter so a slow score never looks frozen
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    // hard client-side ceiling just above the server's maxDuration, so a stuck
    // request resolves to a clear timeout message instead of spinning forever
    const controller = new AbortController();
    controllerRef.current = controller;
    const ceiling = setTimeout(() => controller.abort(), 62_000);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: query, force }),
        signal: controller.signal,
      });
      setResult(await res.json());
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      setResult({
        error: timedOut
          ? "That took too long to score — the model may be busy. Please try again."
          : "Couldn’t reach the scorer. Check your connection and try again.",
      });
    } finally {
      clearTimeout(ceiling);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      setLoading(false);
    }
  }

  const retry = () => search(lastSearchRef.current.q, lastSearchRef.current.force);

  // search a comprehensive catalog (IGDB + our cache) so the user can confirm
  // the exact game BEFORE a scoring call goes out
  async function doSearch(value: string) {
    const q = value.trim();
    if (q.length < 2) {
      setCandidates([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setCandidates(data.results ?? []);
    } catch {
      setCandidates([]);
    } finally {
      setSearching(false);
    }
  }

  function onInputChange(value: string) {
    setInput(value);
    if (result) setResult(null); // typing again starts a fresh pick
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setCandidates([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => doSearch(value), 350);
  }

  // Enter / Search button — run the search now, skipping the debounce wait
  function triggerSearch() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doSearch(input);
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
  const typing = input.trim().length >= 2;
  const showLanding = !result && !loading && !typing;
  const showPicker = !result && !loading && typing;

  // landing pieces, extracted so the logged-in split and the logged-out single
  // column can share them without duplicating JSX
  const introBlock = (
    <>
      <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
        What kind of skill does a game{" "}
        <span className="whitespace-nowrap">actually ask of you?</span>
      </h1>
      <p className="mt-3 max-w-lg text-fog">
        Every game is three skills at once. Type one and get it scored 0–10 on
        each axis, judged against fixed anchors.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {AXES.map((a) => (
          <div key={a.key} className="glow-box rounded-xl bg-panel p-4" style={{ ["--glow" as string]: a.color }}>
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
    </>
  );

  const dataStrip =
    stats && stats.total > 0 ? (
      <div className="mt-10 border-t border-edge pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-fog">
            <span className="font-display text-lg font-bold text-paper">{stats.total}</span>{" "}
            games scored and counting
          </p>
          <div className="flex gap-3 text-sm">
            <Link href="/browse" className="text-fog transition hover:text-paper">Explore →</Link>
            <Link href="/stats" className="text-fog transition hover:text-paper">Stats →</Link>
          </div>
        </div>
        {stats.genres.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.genres.slice(0, 8).map((gn) => (
              <Link
                key={gn.genre}
                href={`/browse?genre=${encodeURIComponent(gn.genre)}`}
                className="rounded-full border border-edge px-3 py-1 text-xs text-fog transition hover:border-macro hover:text-paper"
              >
                {gn.genre}
              </Link>
            ))}
          </div>
        )}
      </div>
    ) : null;

  const spotlightHeading = (
    <div className="mb-5 flex items-center justify-center gap-3">
      <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-fog">Top 50 · spotlight</h2>
      <button
        onClick={loadSpotlight}
        title="Show three different games"
        className="rounded-full border border-edge px-2.5 py-0.5 text-xs text-fog transition hover:border-macro hover:text-paper"
      >
        ⟳
      </button>
    </div>
  );

  const spotlightCards =
    spotlight === null
      ? [0, 1, 2].map((i) => <div key={i} className="h-96 animate-pulse rounded-2xl bg-panel" />)
      : spotlight.map((s) => (
          <button
            key={s.id}
            onClick={() => search(s.name)}
            className="group glow-box flex flex-col overflow-hidden rounded-2xl bg-panel text-left transition hover:brightness-105"
            style={{ ["--glow" as string]: "var(--color-edge)" }}
          >
            <div className="relative h-32 w-full overflow-hidden">
              {s.thumbnail ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={s.thumbnail} alt="" className="h-full w-full object-cover transition group-hover:brightness-110" />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{ background: "radial-gradient(120% 100% at 50% 0%, rgba(41,227,255,0.18), var(--color-ink2) 70%)" }}
                >
                  <span className="font-display px-4 text-center text-lg font-bold text-paper/80">{s.name}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-panel to-transparent" />
            </div>
            <div className="flex flex-1 flex-col p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display truncate text-lg font-bold">{s.name}</h3>
                {s.release_year && <span className="shrink-0 text-xs text-fog">{s.release_year}</span>}
              </div>
              {(s.genre || s.publisher) && (
                <p className="mt-0.5 truncate text-xs text-fog">
                  {[s.genre, s.publisher].filter(Boolean).join(" · ")}
                </p>
              )}
              <div className="mt-2">
                <GameTriangle game={s} size={230} />
              </div>
              <div className="mt-auto px-1 pt-3">
                <IntensityMeter game={s} compact />
              </div>
            </div>
          </button>
        ));

  const yourStyle =
    user && library !== null ? (
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-fog">Your style</h2>
          <SteamImport onImported={loadLibrary} initialSteamId={steamReturn} />
        </div>
        <StylePanel games={library} onRemove={removeFromLibrary} />
      </section>
    ) : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <SiteHeader right={<AuthPanel onUser={setUser} />} />

      {steamError && (
        <p className="mb-4 text-sm" style={{ color: "var(--color-micro)" }}>
          Steam sign-in didn&apos;t complete. Please try again.
        </p>
      )}
      {steamReturn && !user && (
        <p className="mb-4 text-sm text-fog">
          Signed in with Steam ✓ — now sign into 3M (top right) to import your library.
        </p>
      )}

      <div>
        <section>
          {/* Search — find the game in a comprehensive catalog, confirm, then score */}
          <div>
            <div className="glow-box flex gap-2 rounded-xl bg-panel p-2" style={{ ["--glow" as string]: "var(--color-macro)" }}>
              <input
                className="flex-1 bg-transparent px-3 py-2.5 text-lg text-paper placeholder-fog outline-none"
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && triggerSearch()}
                placeholder="Search a game…"
                autoFocus
              />
              <button
                onClick={triggerSearch}
                disabled={input.trim().length < 2}
                className="font-display rounded-lg px-6 font-bold uppercase tracking-wider text-ink transition hover:brightness-110 disabled:opacity-40"
                style={{ background: "var(--color-macro)" }}
              >
                Search
              </button>
            </div>
          </div>

          {/* Picker — matches + near-matches; nothing scores until a card is chosen */}
          {showPicker && (
            <div className="pop-in mt-6">
              {candidates.length > 0 ? (
                <>
                  <p className="mb-3 text-xs uppercase tracking-widest text-fog">Which one did you mean?</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {candidates.map((c) => (
                      <button
                        key={c.slug ?? c.name}
                        onClick={() => search(c.name)}
                        className="group glow-box flex flex-col overflow-hidden rounded-xl bg-panel text-left transition hover:brightness-110"
                        style={{ ["--glow" as string]: c.cached ? "var(--color-macro)" : "var(--color-edge)" }}
                      >
                        <div className="relative aspect-[3/4] w-full overflow-hidden bg-ink2">
                          {c.cover ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={c.cover} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center p-3 text-center text-sm font-semibold text-fog">
                              {c.name}
                            </div>
                          )}
                          <span
                            className="absolute right-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                            style={
                              c.cached
                                ? { background: "var(--color-macro)", color: "var(--color-ink)" }
                                : { background: "var(--color-edge)", color: "var(--color-paper)" }
                            }
                          >
                            {c.cached ? "✓ scored" : "new"}
                          </span>
                        </div>
                        <div className="p-2.5">
                          <p className="truncate text-sm font-semibold text-paper">{c.name}</p>
                          <p className="text-xs text-fog">{c.year ?? "—"}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => search(input)}
                    className="mt-4 text-sm text-fog underline underline-offset-2 transition hover:text-paper"
                  >
                    Don&apos;t see it? Score “{input.trim()}” anyway →
                  </button>
                </>
              ) : searching ? (
                <p className="text-sm text-fog">Searching…</p>
              ) : (
                <div>
                  <p className="text-sm text-fog">No matches found for “{input.trim()}”.</p>
                  <button
                    onClick={() => search(input)}
                    className="font-display mt-3 rounded-lg px-5 py-2 text-sm font-bold uppercase tracking-wider text-ink transition hover:brightness-110"
                    style={{ background: "var(--color-macro)" }}
                  >
                    Score it anyway
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Landing — logged-in users get a split (explanation + spotlight on
              the left, their style breakdown on the right); logged-out keeps the
              single column with the full-width spotlight. */}
          {showLanding &&
            (yourStyle ? (
              <div className="pop-in mt-10 grid gap-8 lg:grid-cols-[3fr_2fr]">
                <div>
                  {introBlock}
                  {dataStrip}
                  <div className="mt-12">
                    {spotlightHeading}
                    <div className="grid gap-5 sm:grid-cols-2">{spotlightCards}</div>
                  </div>
                </div>
                <div className="lg:sticky lg:top-8 lg:self-start">{yourStyle}</div>
              </div>
            ) : (
              <div className="pop-in mt-10">
                {introBlock}
                {dataStrip}
                <div className="relative left-1/2 mt-12 w-screen -translate-x-1/2 px-6">
                  <div className="mx-auto max-w-6xl">
                    {spotlightHeading}
                    <div className="grid gap-6 md:grid-cols-3">{spotlightCards}</div>
                  </div>
                </div>
              </div>
            ))}

          {/* Loading state — an explicit "working" panel so a slow first-time
              score reads as progress, not a frozen/crashed page. */}
          {loading && (
            <div className="pop-in mt-10">
              <div className="glow-box rounded-xl bg-panel p-5" style={{ ["--glow" as string]: "var(--color-macro)" }} role="status" aria-live="polite">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-sm font-bold uppercase tracking-wider" style={{ color: "var(--color-macro)" }}>
                    Analyzing{searchedTerm ? <> “<span className="text-paper">{searchedTerm}</span>”</> : null}…
                  </p>
                  {/* per-second tick is decorative — kept out of the live region so it
                      isn't re-announced every second */}
                  <span className="font-mono text-xs tabular-nums text-fog" aria-hidden="true">{elapsed}s</span>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-edge" aria-hidden="true">
                  <div className="loading-bar h-full rounded-full" style={{ background: "var(--color-macro)" }} />
                </div>
                <p className="mt-3 text-sm text-fog">
                  First-time scoring runs the game through the model and looks up its
                  art — usually a few seconds, up to ~30s for a brand-new or obscure
                  title. Every repeat search is instant.
                </p>
                {elapsed >= 12 && elapsed < 25 && (
                  <p className="mt-1 text-xs text-fog/70">Still working — hang tight…</p>
                )}
                {elapsed >= 25 && (
                  <p className="mt-1 text-xs text-fog/70">
                    Almost there — first-time scores for an obscure title can take a little longer.
                  </p>
                )}
              </div>
              {/* axis placeholders below for visual continuity */}
              <div className="mt-7 space-y-7">
                {AXES.map((a) => (
                  <div key={a.key} className="animate-pulse">
                    <div className="mb-2 h-4 w-20 rounded bg-edge" />
                    <div className="h-3 rounded-full bg-edge" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {result?.recognized === false && (
            <p className="pop-in mt-10 text-lg text-fog">
              Couldn&apos;t identify that game. Typo, or something very obscure?
            </p>
          )}
          {result?.error && (
            <div className="pop-in mt-10">
              <p className="text-lg" style={{ color: "var(--color-micro)" }}>
                {result.error}
              </p>
              <button
                onClick={retry}
                className="font-display mt-3 rounded-lg px-5 py-2 text-sm font-bold uppercase tracking-wider text-ink transition hover:brightness-110"
                style={{ background: "var(--color-macro)" }}
              >
                Try again
              </button>
            </div>
          )}

          {/* Game card */}
          {g && (
            <div className="pop-in mt-8">
              {searchedTerm && g.name.toLowerCase() !== searchedTerm.toLowerCase() && (
                <p className="mb-2 text-sm text-fog">
                  Matched <span className="text-paper">“{searchedTerm}”</span> →{" "}
                  <span className="text-paper">{g.name}</span>.{" "}
                  <button
                    onClick={() => search(searchedTerm, true)}
                    className="underline underline-offset-2 transition hover:text-paper"
                  >
                    Wrong game? Re-score
                  </button>
                </p>
              )}
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

          {/* Your style — below a result (on the landing it lives in the split's
              right column instead, so it isn't duplicated here) */}
          {result && yourStyle && <div className="mt-14">{yourStyle}</div>}

          <footer className="mt-16 flex flex-wrap gap-x-4 gap-y-1 text-xs leading-relaxed text-fog/60">
            <Link href="/about" className="transition hover:text-fog">How scoring works</Link>
            <Link href="/browse?top=1" className="transition hover:text-fog">Top 50</Link>
            <Link href="/compare" className="transition hover:text-fog">Compare</Link>
            <span>· LLM-judged against fixed anchors, then cached.</span>
          </footer>
        </section>
      </div>
    </main>
  );
}
