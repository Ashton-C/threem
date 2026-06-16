import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreGame } from "../../lib/scoring.ts";

// LIVE integration: hits the real Gemma 4 endpoint via scoreGame(). Network +
// a valid GOOGLE_AI_API_SECRET required, so the whole file skips when the key
// is absent (CI without secrets, offline dev). Run with:
//   npm run test:integration
// Each case allows generous time because scoreGame() retries internally.
const HAS_KEY = !!process.env.GOOGLE_AI_API_SECRET;
const opts = { skip: HAS_KEY ? false : "GOOGLE_AI_API_SECRET not set", timeout: 60_000 };

const inRange = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 10;

function assertValidAxis(axis: { reason: string; score: number }, label: string) {
  assert.ok(inRange(axis.score), `${label} score out of 0..10: ${axis.score}`);
  assert.equal(typeof axis.reason, "string");
  assert.ok(axis.reason.length > 0, `${label} reason empty`);
}

test("recognized game returns a schema-valid, on-rubric result", opts, async () => {
  const r = await scoreGame("Counter-Strike 2");
  assert.ok(r.recognized, "CS2 should be recognized");
  if (!r.recognized) return; // narrows the union for TS
  assert.match(r.game, /counter-strike 2/i);
  assertValidAxis(r.micro, "micro");
  assertValidAxis(r.meso, "meso");
  assertValidAxis(r.macro, "macro");
  // CS2 is a top micro anchor — sanity-check the calibration held.
  assert.ok(r.micro.score >= 8, `CS2 micro should be high, got ${r.micro.score}`);
  assert.ok(["high", "medium", "low"].includes(r.confidence));
});

test("non-game input is rejected, not hallucinated into a score", opts, async () => {
  const r = await scoreGame("xkcd flurble 9000 zzzqq");
  assert.equal(r.recognized, false);
});

test("a remaster collapses to the original title", opts, async () => {
  const r = await scoreGame("Dark Souls: Remastered");
  assert.ok(r.recognized);
  if (!r.recognized) return;
  assert.match(r.game, /dark souls/i);
  assert.doesNotMatch(r.game, /remaster/i);
});
