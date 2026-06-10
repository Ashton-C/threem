"use client";
import { useState } from "react";

// Copies a shareable /style/<code> link (its OG image renders the card).
export default function ShareStyle({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${location.origin}/style/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.open(url, "_blank");
    }
  }

  return (
    <button
      onClick={share}
      className="rounded-lg border border-edge px-3 py-1.5 text-sm text-fog transition hover:border-macro hover:text-paper"
    >
      {copied ? "Link copied ✓" : "Share my style"}
    </button>
  );
}
