import { test } from "node:test";
import assert from "node:assert/strict";
import { ANCHORS, AXIS_KEYS, AXIS_INFO } from "../../lib/anchors.ts";

// The anchors are the rubric calibration. They are baked into the LLM prompt
// (lib/scoring.ts) AND rendered on /about, so structural drift here silently
// changes scoring. These tests pin the shape.

test("three axes, matching AXIS_INFO", () => {
  assert.deepEqual([...AXIS_KEYS], ["micro", "meso", "macro"]);
  for (const ax of AXIS_KEYS) {
    assert.ok(AXIS_INFO[ax], `AXIS_INFO missing ${ax}`);
    assert.equal(typeof AXIS_INFO[ax].label, "string");
    assert.ok(AXIS_INFO[ax].blurb.length > 0);
  }
});

test("every axis has high/mid/low bands of 5 exemplars", () => {
  for (const ax of AXIS_KEYS) {
    for (const band of ["high", "mid", "low"] as const) {
      const games = ANCHORS[ax][band];
      assert.equal(games.length, 5, `${ax}.${band} should have 5`);
      assert.ok(games.every((g) => typeof g === "string" && g.length > 0));
    }
  }
});

test("within an axis, no game appears in two different bands", () => {
  for (const ax of AXIS_KEYS) {
    const all = [...ANCHORS[ax].high, ...ANCHORS[ax].mid, ...ANCHORS[ax].low];
    assert.equal(new Set(all).size, all.length, `${ax} has a game in multiple bands`);
  }
});
