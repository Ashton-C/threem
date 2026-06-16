// LLM scoring — single source of truth for the prompt and model config.
// Used by app/api/score/route.ts and scripts/consistency-test.ts.
// No Next.js or DB imports here so it can run standalone under plain node.
import { ANCHORS } from "./anchors.ts";

// Free-tier models. PRIMARY is Gemma 4 31B (1.5k req/day, unlimited tokens);
// on DAILY-quota exhaustion we chain to flash-lite (a separate ~500/day bucket),
// which is the proven prior production model. Both are free.
// NB: gemma-4-26b-a4b-it (the smaller sibling) is catalogued but returns HTTP 500
// on every call as of 2026-06, so it is NOT used as the fallback.
export const PRIMARY_MODEL = "gemma-4-31b-it";
export const FALLBACK_MODEL = "gemini-flash-lite-latest";
export const GEMINI_MODEL = PRIMARY_MODEL; // back-comat label for the test suite
const urlFor = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// build the anchor block from the shared source so prompt + /about can't drift
const anchorBlock = (["micro", "meso", "macro"] as const)
  .map((ax) => {
    const L = ax[0].toUpperCase() + ax.slice(1);
    const a = ANCHORS[ax];
    return `${L} 9-10: ${a.high.join(", ")}. ${L} 5-6: ${a.mid.join(", ")}. ${L} 1-2: ${a.low.join(", ")}.`;
  })
  .join("\n");

export const SYSTEM = `You are a game analyst scoring video games on three axes, each 0-10.
Score INDEPENDENTLY — a game can be high or low on all three at once.

Micro: moment-to-moment mechanical execution (aim, reaction, combos, precise control).
Meso: mid-term tactics ~30s-few min (reading opponents, cooldown tracking, engage/disengage).
Macro: long-term strategy (economy, map control, build orders, objective pacing).

ANCHORS — calibrate against these, do not drift:
${anchorBlock}

RULES:
1. Write the reason BEFORE the number.
2. Unrecognized game OR non-game input -> "recognized": false, no guessed scores.
3. "game" is the canonical title. Apply in order:
   a. Drop creator/publisher prefixes ("Sid Meier's", "Tom Clancy's") and trademark symbols (™, ®).
   b. KEEP sequel numbers and distinguishing subtitles. "BioShock Infinite", "Half-Life 2", "Portal 2", "Dark Souls III" are DIFFERENT games — never collapse them to the base title ("BioShock", "Half-Life", "Portal", "Dark Souls").
   c. Remaster / Remastered / Definitive / Game of the Year / GOTY / HD / Enhanced editions are the SAME game as the original: return the ORIGINAL title and score it as the original. E.g. "Dark Souls: Remastered" -> "Dark Souls"; "The Last of Us Remastered" -> "The Last of Us"; "Skyrim Special Edition" -> "The Elder Scrolls V: Skyrim".
4. "genre" is the single primary genre; "subgenres" are 1-3 more specific labels. "publisher" is the original publisher; "release_year" is the first release. Use null when genuinely unsure — do not guess.
5. Output ONLY this JSON, no markdown:
{"game":"<canonical name>","recognized":<bool>,
 "micro":{"reason":"<line>","score":<0-10>},
 "meso":{"reason":"<line>","score":<0-10>},
 "macro":{"reason":"<line>","score":<0-10>},
 "confidence":"<high|medium|low>",
 "genre":"<primary genre>","subgenres":["<1-3 labels>"],
 "publisher":"<publisher or null>","release_year":<year or null>}`;

export type AxisScore = { reason: string; score: number };
export type ScoreResult =
  | { recognized: false }
  | {
      recognized: true;
      game: string;
      micro: AxisScore;
      meso: AxisScore;
      macro: AxisScore;
      confidence: string;
      genre?: string | null;
      subgenres?: string[] | null;
      publisher?: string | null;
      release_year?: number | null;
    };

// Guided-decoding schema for Gemma 4. responseMimeType:"application/json" ALONE
// does NOT constrain Gemma to JSON — only an explicit responseSchema does.
// The maxLength caps are load-bearing: without them Gemma 4 at temp 0.1 falls
// into repetition loops ("own own own…") that overflow maxOutputTokens and
// produce unparseable truncated JSON. propertyOrdering keeps reason BEFORE score
// so the model still "reasons before the number" (rule 1) under guided decoding.
const AXIS_SCHEMA = {
  type: "object",
  properties: { reason: { type: "string", maxLength: 240 }, score: { type: "integer" } },
  required: ["reason", "score"],
  propertyOrdering: ["reason", "score"],
};
const RESULT_SCHEMA = {
  type: "object",
  properties: {
    game: { type: "string", maxLength: 80 },
    recognized: { type: "boolean" },
    micro: AXIS_SCHEMA,
    meso: AXIS_SCHEMA,
    macro: AXIS_SCHEMA,
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    genre: { type: "string", nullable: true, maxLength: 40 },
    subgenres: { type: "array", items: { type: "string", maxLength: 40 }, nullable: true },
    publisher: { type: "string", nullable: true, maxLength: 60 },
    release_year: { type: "integer", nullable: true },
  },
  required: ["game", "recognized", "micro", "meso", "macro", "confidence"],
  propertyOrdering: [
    "game", "recognized", "micro", "meso", "macro",
    "confidence", "genre", "subgenres", "publisher", "release_year",
  ],
};

/** Raised only on PerDay quota exhaustion — triggers the model fallback.
 *  Per-minute 429s are transient and retried on the same model instead. */
class DailyCapError extends Error {}

/** Per-minute (transient) rate limit. Retried briefly on the same model; if it
 *  won't clear, the caller turns it into a user-facing BusyError. Carried as a
 *  typed error (not a string match) so a 500/503 whose body merely contains the
 *  token "429" can't be mistaken for a real rate limit. */
class RateLimitError extends Error {}

/** Raised when the per-minute free-tier limit is hit and a short retry didn't
 *  clear it. Distinct from a generic failure so the API route can tell the user
 *  "busy, try again" instead of "broken". */
export class BusyError extends Error {}

// A user is waiting on this request, and the serverless function has a hard wall
// clock (see `maxDuration` in app/api/score/route.ts). The LLM is the only
// un-bounded hop in the path, so every call is capped and the retry budget is
// kept small: a fast clean failure beats a 30s hang that reads as a crash.
// Timings are env-overridable purely so tests can drive the retry paths without
// real sleeps; production uses the defaults.
const envMs = (key: string, fallback: number) => {
  const v = Number(process.env[key]);
  return Number.isFinite(v) ? v : fallback;
};
const CALL_TIMEOUT_MS = () => envMs("SCORING_CALL_TIMEOUT_MS", 12_000); // per network attempt
const BACKOFF_429_MS = () => envMs("SCORING_BACKOFF_429_MS", 4_000); // give a per-minute limit a beat to reset
const BACKOFF_BLIP_MS = () => envMs("SCORING_BACKOFF_BLIP_MS", 1_200); // parse truncation / transient timeout
const MAX_ATTEMPTS = 2; // primary: one retry; 429-clear backoff included below
const FALLBACK_ATTEMPTS = 1; // fallback already cost a full primary budget — don't double it

type ModelOpts = { schema: boolean; thinking: boolean };

/** One generateContent call. Gemma needs responseSchema (+ no thinking);
 *  flash-lite needs thinkingConfig (+ no schema). Throws on API/parse failure.
 *  Hard-capped at CALL_TIMEOUT_MS so a stalled upstream can't hang the request. */
async function callModel(model: string, input: string, opts: ModelOpts): Promise<ScoreResult> {
  const generationConfig: Record<string, unknown> = {
    temperature: 0.1, // low temp = stable scores
    maxOutputTokens: 1500,
    responseMimeType: "application/json",
  };
  if (opts.schema) generationConfig.responseSchema = RESULT_SCHEMA;
  if (opts.thinking) generationConfig.thinkingConfig = { thinkingLevel: "low" };

  const res = await fetch(urlFor(model), {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GOOGLE_AI_API_SECRET!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `GAME: ${input}` }] }],
      systemInstruction: { parts: [{ text: SYSTEM }] },
      generationConfig,
    }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS()),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) {
      // distinguish the daily cap (→ fall back to the other model) from a
      // per-minute limit (→ short retry, then a friendly "busy")
      if (/per\s*day|PerDay/i.test(body)) {
        throw new DailyCapError(`${model} daily cap: ${body.slice(0, 200)}`);
      }
      throw new RateLimitError(`${model} 429: ${body.slice(0, 200)}`);
    }
    throw new Error(`${model} ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("")
    .replace(/```json|```/g, "")
    .trim();
  // An empty body means the model was truncated (MAX_TOKENS), blocked
  // (SAFETY/RECITATION), or returned nothing. Surface *why* and let the caller
  // retry, rather than letting JSON.parse("") throw an opaque syntax error.
  if (!text) {
    const why = cand?.finishReason ?? data.promptFeedback?.blockReason ?? "empty response";
    throw new Error(`${model} returned no JSON (${why})`);
  }
  return JSON.parse(text);
}

/** Retry a model for transient failures (parse truncation, recitation blocks,
 *  request timeout, per-minute 429). DailyCapError bubbles straight up to
 *  trigger the model fallback; a stubborn per-minute 429 becomes a BusyError. */
async function callWithRetry(
  model: string,
  input: string,
  opts: ModelOpts,
  maxAttempts = MAX_ATTEMPTS
): Promise<ScoreResult> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await callModel(model, input, opts);
    } catch (err) {
      if (err instanceof DailyCapError) throw err; // never retried — caller falls back
      const is429 = err instanceof RateLimitError;
      if (attempt >= maxAttempts) {
        if (is429) throw new BusyError(`${model} rate limited: ${String(err).slice(0, 120)}`);
        throw err;
      }
      await new Promise((r) => setTimeout(r, is429 ? BACKOFF_429_MS() : BACKOFF_BLIP_MS()));
    }
  }
}

/** Scores a game. Calls Gemma 4 31B; on DAILY-quota exhaustion only, transparently
 *  falls back to flash-lite (a single attempt — the primary already spent a full
 *  retry budget, and the user is waiting). Throws on API or parse failure. */
export async function scoreGame(input: string): Promise<ScoreResult> {
  try {
    return await callWithRetry(PRIMARY_MODEL, input, { schema: true, thinking: false });
  } catch (err) {
    if (err instanceof DailyCapError) {
      try {
        return await callWithRetry(FALLBACK_MODEL, input, { schema: false, thinking: true }, FALLBACK_ATTEMPTS);
      } catch (fallbackErr) {
        // both models' daily quotas are spent — that's "come back later", not a
        // crash, so surface it as a BusyError (→ friendly 429) like a rate limit.
        if (fallbackErr instanceof DailyCapError) throw new BusyError("all models at daily cap");
        throw fallbackErr;
      }
    }
    throw err;
  }
}
