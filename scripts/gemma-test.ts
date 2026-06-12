// Gemma 4 trial — does NOT touch production (lib/scoring.ts still runs flash-lite).
// Reuses the EXACT production SYSTEM prompt, adapted for Gemma 4's API:
//   - thinkingConfig REMOVED (gemma-4 returns 400 "Thinking level is not supported")
//   - responseSchema ADDED (responseMimeType:json alone does NOT hold Gemma to JSON;
//     guided decoding via responseSchema is what actually constrains it)
//   - systemInstruction KEPT (gemma-4 accepts it on this API)
// Also exercises the 31B -> 26B fallback when the *daily* quota is exhausted.
//
// Run:  npm run test:gemma          (1 run per game)
//       npm run test:gemma -- 3     (3 runs per game)
import { SYSTEM, type ScoreResult } from "../lib/scoring.ts";

const PRIMARY = "gemma-4-31b-it"; // 1.5k req/day, 15 rpm, unlimited tokens
const FALLBACK = "gemma-4-26b-a4b-it"; // smaller MoE, separate daily bucket
const urlFor = (m: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;

// OpenAPI-subset schema. propertyOrdering forces reason BEFORE score so the
// model still "reasons before the number" even under guided decoding.
// maxLength caps are LOad-bearing: without them gemma-4 at temp 0.1 falls into
// repetition loops ("own own own…") that overflow maxOutputTokens and break JSON.
const AXIS = {
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
    micro: AXIS,
    meso: AXIS,
    macro: AXIS,
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

class DailyCap extends Error {} // distinct from transient per-minute 429s

async function callModel(model: string, input: string): Promise<ScoreResult> {
  const res = await fetch(urlFor(model), {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GOOGLE_AI_API_SECRET!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `GAME: ${input}` }] }],
      systemInstruction: { parts: [{ text: SYSTEM }] },
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1500,
        responseMimeType: "application/json",
        responseSchema: RESULT_SCHEMA,
        // NB: no thinkingConfig — gemma-4 rejects it with 400.
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    // Daily quota exhaustion -> fall back to the other model. A per-minute
    // (PerMinute) 429 is transient and should be retried on the SAME model.
    if (res.status === 429 && /per\s*day|PerDay/i.test(body)) {
      throw new DailyCap(`${model} daily cap: ${body.replace(/\s+/g, " ").slice(0, 160)}`);
    }
    throw new Error(`${model} ${res.status}: ${body.replace(/\s+/g, " ").slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("");
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Retry a model a couple times for transient failures (parse truncation,
// recitation blocks, per-minute 429). Daily-cap and other hard errors bubble up.
async function callWithRetry(model: string, input: string): Promise<ScoreResult> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await callModel(model, input);
    } catch (err) {
      if (err instanceof DailyCap || attempt >= 3) throw err;
      const wait = /429/.test(String(err)) ? 15000 : 1500;
      console.log(`    retry ${attempt} on ${model} (${String(err).slice(0, 70)})`);
      await sleep(wait);
    }
  }
}

/** Try 31B; on DAILY-cap exhaustion only, transparently retry on 26B. */
async function scoreGameGemma(input: string): Promise<{ result: ScoreResult; model: string }> {
  try {
    return { result: await callWithRetry(PRIMARY, input), model: PRIMARY };
  } catch (err) {
    if (err instanceof DailyCap) {
      console.log(`    ↳ ${String(err).slice(0, 90)} — falling back to ${FALLBACK}`);
      return { result: await callWithRetry(FALLBACK, input), model: FALLBACK };
    }
    throw err;
  }
}

const RUNS = Number(process.argv[2]) || 2;
const CASES = [
  "Civilization VI", "Counter-Strike 2", "Osu!", "Street Fighter 6",
  "Dota 2", "Stardew Valley", "Dark Souls: Remastered", "xkcd flurble 9000",
];

console.log(`Gemma 4 trial — primary=${PRIMARY} fallback=${FALLBACK} | ${RUNS} run(s)/game\n`);
let parseFails = 0;
for (const input of CASES) {
  for (let i = 0; i < RUNS; i++) {
    try {
      const { result: r, model } = await scoreGameGemma(input);
      const tag = model === FALLBACK ? ` [${FALLBACK}]` : "";
      if (!r.recognized) {
        console.log(`${input.padEnd(24)} -> recognized:false${tag}`);
      } else {
        console.log(
          `${input.padEnd(24)} -> "${r.game}" m/s/M ${r.micro.score}/${r.meso.score}/${r.macro.score}` +
            ` conf=${r.confidence} ${r.genre ?? "?"}/${r.release_year ?? "?"}${tag}`,
        );
      }
    } catch (e) {
      parseFails++;
      console.log(`${input.padEnd(24)} -> ERROR ${String(e).slice(0, 160)}`);
    }
    await sleep(1500); // 15 rpm friendly
  }
}
console.log(parseFails ? `\n${parseFails} error(s)` : `\nAll calls parsed cleanly.`);
process.exit(parseFails ? 1 : 0);
