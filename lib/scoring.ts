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

type ModelOpts = { schema: boolean; thinking: boolean };

/** One generateContent call. Gemma needs responseSchema (+ no thinking);
 *  flash-lite needs thinkingConfig (+ no schema). Throws on API/parse failure. */
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
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429 && /per\s*day|PerDay/i.test(body)) {
      throw new DailyCapError(`${model} daily cap: ${body.slice(0, 200)}`);
    }
    throw new Error(`${model} ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("");
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

/** Retry a model for transient failures (parse truncation, recitation blocks,
 *  per-minute 429). DailyCapError and other hard errors bubble straight up. */
async function callWithRetry(model: string, input: string, opts: ModelOpts): Promise<ScoreResult> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await callModel(model, input, opts);
    } catch (err) {
      if (err instanceof DailyCapError || attempt >= 3) throw err;
      const wait = /\b429\b/.test(String(err)) ? 15000 : 1500;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

/** Scores a game. Calls Gemma 4 31B; on DAILY-quota exhaustion only, transparently
 *  falls back to flash-lite. Throws on API or parse failure after retries. */
export async function scoreGame(input: string): Promise<ScoreResult> {
  try {
    return await callWithRetry(PRIMARY_MODEL, input, { schema: true, thinking: false });
  } catch (err) {
    if (err instanceof DailyCapError) {
      return await callWithRetry(FALLBACK_MODEL, input, { schema: false, thinking: true });
    }
    throw err;
  }
}
