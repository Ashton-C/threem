"use client";
import { useState } from "react";

// Steam library import — signed-in only. Posts a SteamID/vanity/URL to
// /api/import/steam, which matches owned games against our scored set.
export default function SteamImport({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    if (!value.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/import/steam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steam: value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Import failed.");
      } else if (data.matched > 0) {
        setMsg(`Added ${data.matched} of ${data.total} games we've scored.`);
        setValue("");
        onImported();
      } else {
        setMsg(data.hint ?? `None of your ${data.total} games are scored yet.`);
      }
    } catch {
      setMsg("Import failed.");
    }
    setBusy(false);
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

  return (
    <div className="rounded-lg border border-edge bg-panel p-3">
      <p className="mb-2 text-xs text-fog">
        SteamID, vanity name, or profile URL. Your{" "}
        <span className="text-paper">Game details</span> privacy must be Public.
      </p>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="76561198… or your vanity name"
          disabled={busy}
          className="flex-1 rounded-lg border border-edge bg-ink2 px-3 py-2 text-sm text-paper placeholder-fog outline-none transition focus:border-macro"
        />
        <button
          onClick={run}
          disabled={busy}
          className="font-display rounded-lg px-4 text-sm font-bold uppercase tracking-wider text-ink transition hover:brightness-110 disabled:opacity-40"
          style={{ background: "var(--color-macro)" }}
        >
          {busy ? "…" : "Import"}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-fog">{msg}</p>}
    </div>
  );
}
