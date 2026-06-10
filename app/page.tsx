"use client";
import { useState } from "react";

type Game = {
  name: string;
  micro: number;
  meso: number;
  macro: number;
  reasoning: { micro: string; meso: string; macro: string };
};

type ScoreResult = {
  recognized?: boolean;
  game?: Game;
  cached?: boolean;
  error?: string;
};

export default function Home() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!input.trim() || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      setResult(await res.json());
    } catch {
      setResult({ error: "request failed" });
    }
    setLoading(false);
  }

  const g = result?.game;
  return (
    <main className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">3M Breakdown</h1>
      <div className="flex gap-2">
        <input
          className="border rounded px-3 py-2 flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Enter a game…"
        />
        <button
          onClick={search}
          disabled={loading}
          className="bg-black text-white rounded px-4"
        >
          {loading ? "…" : "Go"}
        </button>
      </div>

      {result?.recognized === false && (
        <p className="mt-4 text-gray-500">Couldn&apos;t identify that game.</p>
      )}

      {result?.error && (
        <p className="mt-4 text-red-500">Something went wrong: {result.error}</p>
      )}

      {g && (
        <div className="mt-6 space-y-3">
          <h2 className="text-xl font-semibold">{g.name}</h2>
          {(["micro", "meso", "macro"] as const).map((k) => (
            <div key={k}>
              <div className="flex justify-between font-medium capitalize">
                <span>{k}</span>
                <span>{g[k]}/10</span>
              </div>
              <p className="text-sm text-gray-500">{g.reasoning[k]}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
