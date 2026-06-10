"use client";
import { useEffect, useState } from "react";

// Per-axis "disagree" control on the game page. Signed-in only; hides
// itself otherwise. One vote per axis, click again to clear.
type Vote = { axis: string; direction: string };

const AXES = [
  { key: "micro", label: "Micro", color: "var(--color-micro)" },
  { key: "meso", label: "Meso", color: "var(--color-meso)" },
  { key: "macro", label: "Macro", color: "var(--color-macro)" },
] as const;

export default function ScoreFeedback({ gameId }: { gameId: string }) {
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [votes, setVotes] = useState<Record<string, string>>({});

  useEffect(() => {
    // /api/library doubles as a cheap signed-in probe
    fetch("/api/library").then((r) => setSignedIn(r.ok));
    fetch(`/api/feedback?game_id=${gameId}`)
      .then((r) => r.json())
      .then((d) => {
        const m: Record<string, string> = {};
        (d.votes ?? []).forEach((v: Vote) => (m[v.axis] = v.direction));
        setVotes(m);
      })
      .finally(() => setReady(true));
  }, [gameId]);

  if (!ready || !signedIn) return null;

  async function vote(axis: string, direction: string) {
    const current = votes[axis];
    if (current === direction) {
      // toggle off
      setVotes((v) => {
        const n = { ...v };
        delete n[axis];
        return n;
      });
      await fetch(`/api/feedback?game_id=${gameId}&axis=${axis}`, { method: "DELETE" });
    } else {
      setVotes((v) => ({ ...v, [axis]: direction }));
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: gameId, axis, direction }),
      });
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-edge bg-panel p-5">
      <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-fog">
        Disagree with a score?
      </p>
      <p className="mb-3 mt-1 text-sm text-fog">
        Flag any axis that feels off — it helps calibrate the scale.
      </p>
      <div className="space-y-2">
        {AXES.map((a) => (
          <div key={a.key} className="flex items-center gap-3">
            <span className="w-16 font-display text-sm font-bold" style={{ color: a.color }}>
              {a.label}
            </span>
            {(["too_low", "too_high"] as const).map((dir) => {
              const active = votes[a.key] === dir;
              return (
                <button
                  key={dir}
                  onClick={() => vote(a.key, dir)}
                  className="rounded-full border px-3 py-1 text-xs transition"
                  style={{
                    borderColor: active ? a.color : "var(--color-edge)",
                    color: active ? a.color : "var(--color-fog)",
                    background: active ? "rgba(255,255,255,0.04)" : "transparent",
                  }}
                >
                  {dir === "too_low" ? "too low" : "too high"}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
