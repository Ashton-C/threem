// Scoring consistency suite — calls the LLM directly, NO database involved.
// Verifies the production prompt (lib/scoring.ts) gives stable, rubric-sane
// results on the new model across repeated calls.
//
// Run:  npm run test:scoring          (3 runs per game)
//       npm run test:scoring -- 5     (5 runs per game)

import { scoreGame, GEMINI_MODEL, type ScoreResult } from "../lib/scoring.ts";

type Expect = {
  micro?: [number, number]; // inclusive [min, max] allowed band
  meso?: [number, number];
  macro?: [number, number];
};

// Bands come straight from the rubric's ANCHORS (±1 tolerance on the edges).
const CASES: { input: string; junk?: boolean; expect?: Expect }[] = [
  { input: "Civilization VI", expect: { micro: [0, 3], macro: [8, 10] } },
  { input: "Counter-Strike 2", expect: { micro: [8, 10] } },
  { input: "Osu!", expect: { micro: [8, 10], meso: [0, 3], macro: [0, 3] } },
  { input: "Street Fighter 6", expect: { micro: [8, 10], macro: [0, 3] } },
  { input: "Dota 2", expect: { meso: [8, 10] } },
  { input: "Stardew Valley", expect: { micro: [0, 3], meso: [0, 3] } },
  { input: "xkcd flurble 9000", junk: true },
];

const MAX_SPREAD = 1; // max allowed (max - min) per axis across runs
const RUNS = Number(process.argv[2]) || 3;
const AXES = ["micro", "meso", "macro"] as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function scoreWithRetry(input: string): Promise<ScoreResult> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await scoreGame(input);
    } catch (err) {
      if (attempt >= 3) throw err;
      const msg = String(err);
      const wait = msg.includes("429") ? 15000 : 2000;
      console.log(`    retry ${attempt} (${msg.slice(0, 80)}) in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
}

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};

console.log(`model: ${GEMINI_MODEL} | ${RUNS} runs per game | spread tolerance: ±${MAX_SPREAD}\n`);

for (const c of CASES) {
  console.log(`── ${c.input}`);
  const results: ScoreResult[] = [];
  for (let i = 0; i < RUNS; i++) {
    results.push(await scoreWithRetry(c.input));
    await sleep(1500); // stay friendly to free-tier RPM
  }

  if (c.junk) {
    const allRejected = results.every((r) => !r.recognized);
    if (allRejected) console.log(`  ✓ rejected as unrecognized in ${RUNS}/${RUNS} runs`);
    else fail(`junk input was recognized in ${results.filter((r) => r.recognized).length}/${RUNS} runs`);
    continue;
  }

  const recognized = results.filter((r) => r.recognized);
  if (recognized.length < RUNS) {
    fail(`recognized only ${recognized.length}/${RUNS} runs`);
    continue;
  }

  // canonical name must be stable, or the alias cache will fragment
  const names = new Set(recognized.map((r) => r.recognized && r.game.toLowerCase().trim()));
  if (names.size === 1) console.log(`  ✓ canonical name stable: "${(recognized[0] as { game: string }).game}"`);
  else fail(`canonical name unstable: ${[...names].join(" / ")}`);

  for (const axis of AXES) {
    const scores = recognized.map((r) => (r.recognized ? r[axis].score : -1));
    const lo = Math.min(...scores);
    const hi = Math.max(...scores);
    const spread = hi - lo;
    const band = c.expect?.[axis];
    const inBand = !band || (lo >= band[0] && hi <= band[1]);
    const line = `${axis.padEnd(5)} [${scores.join(", ")}] spread=${spread}${band ? ` band=[${band[0]}-${band[1]}]` : ""}`;
    if (spread > MAX_SPREAD) fail(`${line} — UNSTABLE`);
    else if (!inBand) fail(`${line} — OUT OF RUBRIC BAND`);
    else console.log(`  ✓ ${line}`);
  }
}

console.log(failures ? `\nFAIL — ${failures} problem(s)` : "\nPASS — scores are consistent and on-rubric");
process.exit(failures ? 1 : 0);
