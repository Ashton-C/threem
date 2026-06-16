import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { scoreGame, BusyError } from "../../lib/scoring.ts";

// Pure unit coverage for the error-classification + retry/fallback contract in
// lib/scoring.ts. global.fetch is stubbed so nothing hits the network; the
// SCORING_* env knobs zero out the backoff sleeps so the retry paths run
// instantly (scoring.ts reads these at call-time).
process.env.SCORING_CALL_TIMEOUT_MS = "200";
process.env.SCORING_BACKOFF_429_MS = "0";
process.env.SCORING_BACKOFF_BLIP_MS = "0";

const PRIMARY = "gemma-4-31b-it";
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const errorResponse = (status: number, body: string) =>
  ({ ok: false, status, text: async () => body }) as unknown as Response;

const okResponse = (obj: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }),
  }) as unknown as Response;

const VALID_SCORE = {
  game: "Test Game",
  recognized: true,
  micro: { reason: "r", score: 5 },
  meso: { reason: "r", score: 5 },
  macro: { reason: "r", score: 5 },
  confidence: "high",
};

test("a flaky primary (503) falls back to the stable model and returns a score", async () => {
  let primaryCalls = 0;
  let fallbackCalls = 0;
  globalThis.fetch = (async (url: string) => {
    if (String(url).includes(PRIMARY)) {
      primaryCalls++;
      return errorResponse(503, '{ "error": { "code": 503, "message": "overloaded" } }');
    }
    fallbackCalls++;
    return okResponse(VALID_SCORE);
  }) as unknown as typeof fetch;

  const r = await scoreGame("Super Smash Bros 64");
  assert.ok(r.recognized, "should recover via the fallback model");
  assert.equal(primaryCalls, 1, "a 5xx is not retried on the unhealthy primary");
  assert.equal(fallbackCalls, 1, "fallback model runs a single attempt");
});

test("a daily-cap 429 falls back to the secondary model and returns a score", async () => {
  let primaryCalls = 0;
  let fallbackCalls = 0;
  globalThis.fetch = (async (url: string) => {
    if (String(url).includes(PRIMARY)) {
      primaryCalls++;
      return errorResponse(429, "RESOURCE_EXHAUSTED: PerDay quota exceeded");
    }
    fallbackCalls++;
    return okResponse(VALID_SCORE);
  }) as unknown as typeof fetch;

  const r = await scoreGame("Test Game");
  assert.ok(r.recognized, "fallback result should be recognized");
  assert.equal(primaryCalls, 1, "a daily cap is not retried on the primary");
  assert.equal(fallbackCalls, 1, "fallback model runs a single attempt");
});

test("a stubborn per-minute 429 on both models surfaces as BusyError", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return errorResponse(429, "RESOURCE_EXHAUSTED: per-minute quota, please retry");
  }) as typeof fetch;

  await assert.rejects(() => scoreGame("Whatever"), (e: unknown) => e instanceof BusyError);
  // primary: try + retry (2), then fallback: single attempt (1)
  assert.equal(calls, 3);
});

test("an empty/blocked response on both models surfaces a clear (non-busy) error", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return {
      ok: true,
      status: 200,
      json: async () => ({ candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [] } }] }),
    } as unknown as Response;
  }) as typeof fetch;

  await assert.rejects(
    () => scoreGame("Test"),
    (e: unknown) => !(e instanceof BusyError) && /no JSON/.test(String(e)),
  );
  // empty is a transient parse blip: primary retries once (2), fallback once (1)
  assert.equal(calls, 3);
});

test("a request timeout falls back fast and is never mistaken for a rate limit", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    throw new DOMException("signal timed out", "TimeoutError");
  }) as typeof fetch;

  await assert.rejects(
    () => scoreGame("Test"),
    (e: unknown) => !(e instanceof BusyError) && (e as Error).name === "TimeoutError",
  );
  // a timeout means the model is unhealthy: no same-model retry — one primary
  // attempt, then one fallback attempt
  assert.equal(calls, 2);
});
