"use client";
import { useEffect, useRef, useState } from "react";

type Owned = { appid: number; name: string; playtime?: number };
type ImportResult = { total: number; matched: number };
type Saved = {
  result: ImportResult;
  unmatched: Owned[];
  addedCount: number;
  interrupted: boolean;
};

const LS_KEY = "threem:steamscan";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const THROTTLE_MS = 1200; // ~50/min — under the per-IP (10/10s) and global (60/min) caps
const fmtHours = (min?: number) => (min && min >= 60 ? ` ${Math.round(min / 60)}h` : "");

function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

export default function SteamImport({
  onImported,
  initialSteamId,
}: {
  onImported: () => void;
  initialSteamId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [unmatched, setUnmatched] = useState<Owned[]>([]);
  const [scoring, setScoring] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [addedCount, setAddedCount] = useState(0);
  const stopRef = useRef(false);
  const ran = useRef(false);

  function persist(remaining: Owned[], added: number, inProgress: boolean, res?: ImportResult) {
    const r = res ?? result;
    if (!r) return;
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ result: r, unmatched: remaining, addedCount: added, interrupted: inProgress })
      );
    } catch {
      /* quota / private mode — non-fatal */
    }
  }
  function clearSaved() {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
  }

  // on mount: resume a saved scan, else auto-import a verified Steam login
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const saved = loadSaved();
    if (saved && saved.unmatched.length > 0) {
      setOpen(true);
      setResult(saved.result);
      setUnmatched(saved.unmatched);
      setAddedCount(saved.addedCount);
      setInterrupted(saved.interrupted);
    } else if (initialSteamId) {
      setOpen(true);
      setValue(initialSteamId);
      runImport(initialSteamId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runImport(steam: string) {
    if (!steam.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    setResult(null);
    setInterrupted(false);
    try {
      const res = await fetch("/api/import/steam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steam: steam.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Import failed.");
      } else {
        const r = { total: data.total ?? 0, matched: data.matched ?? 0 };
        setResult(r);
        setUnmatched(data.unmatched ?? []);
        setAddedCount(data.matched ?? 0);
        if (data.matched > 0) onImported();
        if (data.total === 0) setMsg(data.hint ?? "No games returned.");
        persist(data.unmatched ?? [], data.matched ?? 0, false, r);
      }
    } catch {
      setMsg("Import failed.");
    }
    setBusy(false);
  }

  // returns the outcome of scoring one game
  async function scoreOne(g: Owned): Promise<"added" | "skip" | "429" | "error"> {
    let res: Response;
    try {
      res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: g.name }),
      });
    } catch {
      return "error";
    }
    if (res.status === 429) return "429";
    if (!res.ok) return "error";
    const data = await res.json().catch(() => null);
    if (data?.recognized && data.game?.id) {
      const add = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: data.game.id, playtime_minutes: g.playtime ?? 0 }),
      }).catch(() => null);
      if (!add || !add.ok) return "error";
      return "added";
    }
    return "skip";
  }

  async function scoreWithRetry(g: Owned): Promise<"added" | "skip" | "stop"> {
    let r = await scoreOne(g);
    if (r === "429") {
      await sleep(6000); // rate-limit backoff
      if (stopRef.current) return "stop";
      r = await scoreOne(g);
    } else if (r === "error") {
      await sleep(1500); // transient error — one retry
      if (stopRef.current) return "stop";
      r = await scoreOne(g);
    }
    if (r === "429" || r === "error") return "skip"; // give up on this one, keep going
    return r;
  }

  // process a single game on demand (the per-game "score" button)
  async function scoreGame(g: Owned) {
    const r = await scoreWithRetry(g);
    if (r === "added") {
      const next = addedCount + 1;
      setAddedCount(next);
      onImported();
      const remaining = unmatched.filter((x) => x.appid !== g.appid);
      setUnmatched(remaining);
      persist(remaining, next, false);
    } else if (r === "skip") {
      const remaining = unmatched.filter((x) => x.appid !== g.appid);
      setUnmatched(remaining);
      persist(remaining, addedCount, false);
    }
  }

  // batch the whole queue; persists `remaining` after every game so a
  // refresh / navigation resumes from here, never re-doing finished games
  async function processQueue() {
    setScoring(true);
    setInterrupted(false);
    stopRef.current = false;
    const queue = [...unmatched];
    let added = addedCount;
    for (let i = 0; i < queue.length; i++) {
      if (stopRef.current) {
        const remaining = queue.slice(i);
        setUnmatched(remaining);
        persist(remaining, added, true);
        setInterrupted(true);
        break;
      }
      const g = queue[i];
      setProgress({ done: i, total: queue.length, current: g.name });
      const r = await scoreWithRetry(g);
      if (r === "stop") {
        const remaining = queue.slice(i);
        setUnmatched(remaining);
        persist(remaining, added, true);
        setInterrupted(true);
        break;
      }
      if (r === "added") {
        added++;
        setAddedCount(added);
        onImported();
      }
      const remaining = queue.slice(i + 1);
      setUnmatched(remaining);
      persist(remaining, added, remaining.length > 0);
      await sleep(THROTTLE_MS);
    }
    setScoring(false);
    setProgress((p) => ({ ...p, current: "" }));
    onImported();
  }

  function reset() {
    clearSaved();
    setResult(null);
    setUnmatched([]);
    setAddedCount(0);
    setMsg(null);
    setInterrupted(false);
  }

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-edge px-3 py-1.5 text-sm text-fog transition hover:border-macro hover:text-paper"
      >
        Import from Steam
      </button>
    );

  const etaMin = Math.ceil((unmatched.length * (THROTTLE_MS + 600)) / 60000);

  return (
    <div className="w-full rounded-lg border border-edge bg-panel p-3 sm:w-[440px]">
      {!result && (
        <>
          <a
            href="/api/steam/login"
            className="font-display flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-110"
            style={{ background: "var(--color-macro)" }}
          >
            Sign in through Steam
          </a>
          <p className="mt-2 text-center text-[11px] text-fog/60">confirms it&apos;s really you — no typing</p>

          <div className="my-3 flex items-center gap-3 text-[11px] text-fog/50">
            <div className="h-px flex-1 bg-edge" /> or enter an ID <div className="h-px flex-1 bg-edge" />
          </div>

          <div className="flex gap-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runImport(value)}
              placeholder="76561198… or vanity name"
              disabled={busy}
              className="flex-1 rounded-lg border border-edge bg-ink2 px-3 py-2 text-sm text-paper placeholder-fog outline-none transition focus:border-macro"
            />
            <button
              onClick={() => runImport(value)}
              disabled={busy}
              className="rounded-lg border border-edge px-4 text-sm font-semibold text-fog transition hover:border-macro hover:text-paper disabled:opacity-40"
            >
              {busy ? "…" : "Import"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-fog/60">
            Game details privacy must be Public for the manual path.
          </p>
          {msg && <p className="mt-2 text-xs text-fog">{msg}</p>}
        </>
      )}

      {result && (
        <div className="text-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="text-fog">
              Imported <span className="text-paper">{result.total}</span> games ·{" "}
              <span className="text-paper">{addedCount}</span> in your library
            </p>
            <button onClick={reset} className="shrink-0 text-xs text-fog/50 transition hover:text-paper">done</button>
          </div>

          {scoring ? (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-fog">
                <span>Gathering data… {progress.done} / {progress.total}</span>
                <button onClick={() => (stopRef.current = true)} className="text-micro">stop</button>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-edge">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%`, background: "var(--color-macro)", boxShadow: "0 0 8px var(--color-macro)" }}
                />
              </div>
              {progress.current && <p className="mt-1 truncate text-xs text-fog/70">scoring {progress.current}…</p>}
            </div>
          ) : (
            unmatched.length > 0 && (
              <div className="mt-3">
                {interrupted && (
                  <p className="mb-2 rounded-md border border-edge bg-ink2 px-2 py-1 text-[11px] text-fog">
                    Scan was interrupted — {unmatched.length} left. Resume picks up where it stopped, no games re-scored.
                  </p>
                )}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-fog">{unmatched.length} owned games aren&apos;t scored yet.</p>
                  <button
                    onClick={processQueue}
                    className="font-display shrink-0 rounded-lg border border-macro px-3 py-1 text-xs font-bold uppercase tracking-wider transition hover:brightness-110"
                    style={{ color: "var(--color-macro)" }}
                  >
                    {interrupted ? `Resume ${unmatched.length}` : `Score all ${unmatched.length}`}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-fog/60">
                  One at a time (~{etaMin} min), uses the LLM, throttled to stay within limits. Safe to leave — progress is saved.
                </p>
                <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
                  {unmatched.map((g) => (
                    <div key={g.appid} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-fog">{g.name}<span className="text-fog/40">{fmtHours(g.playtime)}</span></span>
                      <button
                        onClick={() => scoreGame(g)}
                        className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-[11px] text-fog transition hover:border-macro hover:text-paper"
                      >
                        score
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {!scoring && unmatched.length === 0 && (
            <p className="mt-2 text-xs text-fog/70">Everything we could match is in your library.</p>
          )}
        </div>
      )}
    </div>
  );
}
