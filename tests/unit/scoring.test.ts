import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SYSTEM,
  PRIMARY_MODEL,
  FALLBACK_MODEL,
  GEMINI_MODEL,
} from "../../lib/scoring.ts";
import { ANCHORS, AXIS_KEYS } from "../../lib/anchors.ts";

// These guard the prompt against accidental drift — e.g. an anchor silently
// dropped from the rubric, or a JSON output key renamed out from under the
// parser. They are pure (no network) so they run in the fast unit suite.

test("model wiring: Gemma primary, flash-lite fallback", () => {
  assert.equal(PRIMARY_MODEL, "gemma-4-31b-it");
  assert.equal(FALLBACK_MODEL, "gemini-flash-lite-latest");
  assert.equal(GEMINI_MODEL, PRIMARY_MODEL); // back-compat label for the test suite
});

test("prompt names all three axes", () => {
  for (const ax of AXIS_KEYS) {
    const Label = ax[0].toUpperCase() + ax.slice(1);
    assert.match(SYSTEM, new RegExp(Label), `prompt missing ${Label}`);
  }
});

test("prompt embeds every anchor exemplar (rubric == prompt)", () => {
  for (const ax of AXIS_KEYS) {
    for (const band of ["high", "mid", "low"] as const) {
      for (const game of ANCHORS[ax][band]) {
        assert.ok(
          SYSTEM.includes(game),
          `prompt is missing anchor "${game}" (${ax}.${band})`,
        );
      }
    }
  }
});

test("prompt specifies the exact JSON output keys the parser expects", () => {
  for (const key of [
    "recognized", "game", "micro", "meso", "macro",
    "reason", "score", "confidence", "genre", "subgenres",
    "publisher", "release_year",
  ]) {
    assert.ok(SYSTEM.includes(key), `prompt missing output key "${key}"`);
  }
});

test("prompt keeps the remaster-collapse and reason-before-number rules", () => {
  assert.match(SYSTEM, /Remaster/);
  assert.match(SYSTEM, /reason BEFORE the number/i);
});
