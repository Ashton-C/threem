// LLM scoring — single source of truth for the prompt and model config.
// Used by app/api/score/route.ts and scripts/consistency-test.ts.
// No Next.js or DB imports here so it can run standalone under plain node.
import { ANCHORS } from "./anchors.ts";

// Free-tier model. gemini-3.5-flash is billed; flash-lite is free and
// (with the anchor rubric) calibrates well + reliably emits JSON.
export const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

/** Calls Gemini and parses the rubric JSON. Throws on API or parse failure. */
export async function scoreGame(input: string): Promise<ScoreResult> {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GOOGLE_AI_API_SECRET!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `GAME: ${input}` }] }],
      systemInstruction: { parts: [{ text: SYSTEM }] },
      generationConfig: {
        temperature: 0.1, // low temp = stable scores
        maxOutputTokens: 1500, // headroom for thinking tokens
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: "low" },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("");
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}
