"use client";
import { useEffect, useState } from "react";

// Self-contained add/remove control for game detail pages. Determines
// signed-in state and membership from /api/library; hides itself when
// the user isn't signed in.
export default function LibraryButton({ gameId }: { gameId: string }) {
  const [signedIn, setSignedIn] = useState(false);
  const [inLib, setInLib] = useState(false);
  const [ready, setReady] = useState(false);

  async function refresh() {
    const res = await fetch("/api/library");
    if (!res.ok) {
      setSignedIn(false);
      setReady(true);
      return;
    }
    const data = await res.json();
    setSignedIn(true);
    setInLib((data.games ?? []).some((g: { id: string }) => g.id === gameId));
    setReady(true);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  if (!ready || !signedIn) return null;

  async function toggle() {
    if (inLib) {
      await fetch(`/api/library?game_id=${encodeURIComponent(gameId)}`, { method: "DELETE" });
    } else {
      await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: gameId }),
      });
    }
    setInLib(!inLib);
  }

  return inLib ? (
    <button
      onClick={toggle}
      className="rounded-lg border px-4 py-2 text-sm font-semibold text-fog transition hover:text-paper"
      style={{ borderColor: "var(--color-micro)" }}
    >
      ✓ In library
    </button>
  ) : (
    <button
      onClick={toggle}
      className="font-display rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wider text-ink transition hover:brightness-110"
      style={{ background: "var(--color-macro)" }}
    >
      + Library
    </button>
  );
}
