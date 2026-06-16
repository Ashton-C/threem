import { NextRequest, NextResponse } from "next/server";
import { slugify } from "@/lib/slug";
import { checkRateLimit, clientIp } from "@/lib/ratelimit";
import { lookupCachedGame, scoreAndCache } from "@/lib/resolve";
import { BusyError } from "@/lib/scoring";
import { logErrorEvent } from "@/lib/telemetry";

const MAX_INPUT = 100; // real game names are short; caps token cost per call

// A cold score does an LLM call (bounded, with one retry) plus best-effort
// Steam/IGDB art enrichment. Give the function room to finish that within a
// wall clock the client's loading copy is honest about — but never unbounded.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { input, force } = await req.json();
  if (!input || typeof input !== "string")
    return NextResponse.json({ error: "no input" }, { status: 400 });
  if (input.length > MAX_INPUT)
    return NextResponse.json({ error: "input too long" }, { status: 400 });

  const rawSlug = slugify(input);
  if (!rawSlug)
    return NextResponse.json({ error: "no input" }, { status: 400 });

  // 1. cache lookup via alias — free, happens before any rate limiting.
  //    `force` (a "wrong game? re-score" action) bypasses it so the spelling
  //    is re-resolved with the current prompt and its alias overwritten.
  if (!force) {
    const cached = await lookupCachedGame(rawSlug);
    if (cached)
      return NextResponse.json({ recognized: true, game: cached, cached: true });
  }

  // 2. rate limit before any LLM-billed work, keyed on the trusted platform IP
  if (!(await checkRateLimit(clientIp(req))))
    return NextResponse.json(
      { error: "rate limited, slow down" },
      { status: 429 }
    );

  // 3. miss -> score, enrich, cache
  let result;
  try {
    result = await scoreAndCache(input, rawSlug);
  } catch (err) {
    // A per-minute free-tier limit is a "try again in a moment", not a crash —
    // give the client a distinct, friendlier message and a retry-able status.
    if (err instanceof BusyError) {
      await logErrorEvent("score:busy", String(err), input, { code: "busy" });
      return NextResponse.json(
        { error: "The scorer is busy right now — give it a few seconds and try again.", code: "busy" },
        { status: 429 }
      );
    }
    await logErrorEvent(
      "score:error",
      err instanceof Error ? err.message : String(err),
      input,
      { code: "unavailable", name: err instanceof Error ? err.name : undefined }
    );
    return NextResponse.json(
      { error: "Scoring is temporarily unavailable. Please try again.", code: "unavailable" },
      { status: 502 }
    );
  }

  if (!result.recognized) return NextResponse.json({ recognized: false });
  if (!result.game)
    return NextResponse.json({ error: "db write failed" }, { status: 500 });

  return NextResponse.json({ recognized: true, game: result.game, cached: false });
}
