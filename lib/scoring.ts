// LLM scoring — single source of truth for the prompt and model config.
// Used by app/api/score/route.ts and scripts/consistency-test.ts.
// No Next.js or DB imports here so it can run standalone under plain node.

export const GEMINI_MODEL = "gemini-3.5-flash"; // best free-tier model; rubric carries the weight
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export const SYSTEM = `You are a game analyst scoring video games on three axes, each 0-10.
Score INDEPENDENTLY — a game can be high or low on all three at once.

Micro: moment-to-moment mechanical execution (aim, reaction, combos, precise control).
Meso: mid-term tactics ~30s-few min (reading opponents, cooldown tracking, engage/disengage).
Macro: long-term strategy (economy, map control, build orders, objective pacing).

ANCHORS — calibrate, do not drift:
Micro 9-10: CS2, StarCraft II, Osu!, Street Fighter, Apex. Micro 5-6: Dark Souls, Monster Hunter. Micro 1-2: Civilization, Stardew.
Meso 9-10: Dota 2, Poker, Magic, Rainbow Six Siege. Meso 5-6: Apex, Monster Hunter. Meso 1-2: Osu!, Stardew.
Macro 9-10: Civilization, Age of Empires, StarCraft II, Factorio. Macro 5-6: Hearthstone, Magic. Macro 1-2: Osu!, Street Fighter.

RULES:
1. Write the reason BEFORE the number.
2. Unrecognized game OR non-game input -> "recognized": false, no guessed scores.
3. "game" must be the most widely used short title: drop creator/brand prefixes ("Sid Meier's", "Tom Clancy's") and trademark symbols.
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
        temperature: 0.2, // low temp = stable scores
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
