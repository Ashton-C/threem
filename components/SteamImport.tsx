"use client";
import { useRef, useState } from "react";

type Owned = { appid: number; name: string };
type ImportResult = { total: number; matched: number; unmatched: Owned[]; hint?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const THROTTLE_MS = 1200; // ~50/min — under the per-IP (10/10s) and global (60/min) caps

export default function SteamImport({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [unmatched, setUnmatched] = useState<Owned[]>([]);
  const [scoring, setScoring] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [addedCount, setAddedCount] = useState(0);
  const stopRef = useRef(false);

  async function runImport() {
    if (!value.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    setResult(null);
    try {
      const res = await fetch("/api/import/steam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steam: value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Import failed.");
      } else {
        setResult(data);
        setUnmatched(data.unmatched ?? []);
        setAddedCount(data.matched ?? 0);
        if (data.matched > 0) onImported();
        if (data.total === 0) setMsg(data.hint ?? "No games returned.");
      }
    } catch {
      setMsg("Import failed.");
    }
    setBusy(false);
  }

  // score a single owned game by name; add to library if recognized
  async function scoreOne(name: string): Promise<"added" | "skip" | "429"> {
    const res = await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: name }),
    });
    if (res.status === 429) return "429";
    const data = await res.json().catch(() => null);
    if (data?.recognized && data.game?.id) {
      await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: data.game.id }),
      });
      return "added";
    }
    return "skip";
  }

  async function scoreGame(g: Owned) {
    const r = await scoreOne(g.name);
    if (r === "added") {
      setAddedCount((c) => c + 1);
      onImported();
    }
    if (r !== "429") setUnmatched((u) => u.filter((x) => x.appid !== g.appid));
  }

  async function scoreAll() {
    setScoring(true);
    stopRef.current = false;
    const list = [...unmatched];
    for (let i = 0; i < list.length; i++) {
      if (stopRef.current) break;
      const g = list[i];
      setProgress({ done: i, total: list.length, current: g.name });
      let r = await scoreOne(g.name);
      if (r === "429") {
        await sleep(6000); // backoff on rate limit, then retry once
        if (stopRef.current) break;
        r = await scoreOne(g.name);
      }
      if (r === "added") {
        setAddedCount((c) => c + 1);
        onImported();
      }
      setUnmatched((u) => u.filter((x) => x.appid !== g.appid));
      await sleep(THROTTLE_MS);
    }
    setProgress((p) => ({ ...p, done: p.total, current: "" }));
    setScoring(false);
    onImported();
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
    <div className="w-full rounded-lg border border-edge bg-panel p-3 sm:w-[420px]">
      {!result && (
        <>
          <p className="mb-2 text-xs text-fog">
            SteamID, vanity name, or profile URL. Your{" "}
            <span className="text-paper">Game details</span> privacy must be Public.
          </p>
          <div className="flex gap-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runImport()}
              placeholder="76561198… or your vanity name"
              disabled={busy}
              className="flex-1 rounded-lg border border-edge bg-ink2 px-3 py-2 text-sm text-paper placeholder-fog outline-none transition focus:border-macro"
            />
            <button
              onClick={runImport}
              disabled={busy}
              className="font-display rounded-lg px-4 text-sm font-bold uppercase tracking-wider text-ink transition hover:brightness-110 disabled:opacity-40"
              style={{ background: "var(--color-macro)" }}
            >
              {busy ? "…" : "Import"}
            </button>
          </div>
          {msg && <p className="mt-2 text-xs text-fog">{msg}</p>}
        </>
      )}

      {result && (
        <div className="text-sm">
          <p className="text-fog">
            Imported <span className="text-paper">{result.total}</span> games ·{" "}
            <span className="text-paper">{addedCount}</span> in your library
          </p>

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
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-fog">{unmatched.length} owned games aren&apos;t scored yet.</p>
                  <button
                    onClick={scoreAll}
                    className="font-display shrink-0 rounded-lg border border-macro px-3 py-1 text-xs font-bold uppercase tracking-wider transition hover:brightness-110"
                    style={{ color: "var(--color-macro)" }}
                  >
                    Score all {unmatched.length}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-fog/60">
                  Scoring runs one game at a time (~{etaMin} min) and uses the LLM — it&apos;s throttled to stay within limits.
                </p>
                <div className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1">
                  {unmatched.map((g) => (
                    <div key={g.appid} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-fog">{g.name}</span>
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
            <p className="mt-2 text-xs text-fog/70">All matched games are in your library.</p>
          )}
        </div>
      )}
    </div>
  );
}
