import { test } from "node:test";
import assert from "node:assert/strict";
import { intensity, intensityBand } from "../../lib/intensity.ts";

test("intensity is the mean of the three axes", () => {
  assert.equal(intensity({ micro: 3, meso: 6, macro: 9 }), 6);
  assert.equal(intensity({ micro: 0, meso: 0, macro: 0 }), 0);
  assert.equal(intensity({ micro: 10, meso: 10, macro: 10 }), 10);
});

test("intensityBand thresholds (boundaries are inclusive at the lower edge)", () => {
  assert.equal(intensityBand(0), "Casual");
  assert.equal(intensityBand(3.49), "Casual");
  assert.equal(intensityBand(3.5), "Moderate");
  assert.equal(intensityBand(5.49), "Moderate");
  assert.equal(intensityBand(5.5), "Demanding");
  assert.equal(intensityBand(7.49), "Demanding");
  assert.equal(intensityBand(7.5), "Hardcore");
  assert.equal(intensityBand(10), "Hardcore");
});
