// Lightweight server-side error capture. Best-effort by design: every failure
// to log is swallowed, because telemetry must never break the request it is
// observing. Mirrors to the platform log (visible in Vercel logs immediately)
// and persists to the `error_events` table (migration 0006) for later triage.
// No Next.js imports so it can run under plain node (seed scripts) too.

import { db } from "./supabase.ts";

export type ErrorMeta = Record<string, unknown>;

/**
 * Record a server-side failure. `stage` is a short, filterable label
 * (e.g. "score:error", "score:busy"); `input` is the user's raw query so a
 * report ("Sekiro froze") can be reproduced. Never throws.
 */
export async function logErrorEvent(
  stage: string,
  detail: string,
  input?: string,
  meta?: ErrorMeta
): Promise<void> {
  // platform log first — present even if the DB write below is unavailable
  console.error(`threem[${stage}]`, detail, input ? `input=${JSON.stringify(input)}` : "", meta ?? "");
  try {
    await db.from("error_events").insert({
      stage,
      input: input?.slice(0, 200) ?? null,
      detail: detail.slice(0, 1000),
      meta: meta ?? null,
    });
  } catch {
    // table missing / DB down — observability must not break the hot path
  }
}
