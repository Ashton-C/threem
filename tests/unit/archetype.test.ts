import { test } from "node:test";
import assert from "node:assert/strict";
import { archetype, encodeStyle, decodeStyle, ARCHETYPES } from "../../lib/archetype.ts";

// archetype() classifies a micro/meso/macro profile into one of 7 regions:
// 3 single-dominant corners, 3 pairwise edges, 1 balanced center.

test("balanced profile -> Polymath (center)", () => {
  assert.equal(archetype({ micro: 5, meso: 5, macro: 5 }).name, "Polymath");
  assert.equal(archetype({ micro: 6, meso: 5, macro: 6 }).name, "Polymath");
});

test("single-axis dominance -> corner archetype", () => {
  assert.equal(archetype({ micro: 10, meso: 1, macro: 1 }).name, "Headhunter"); // micro
  assert.equal(archetype({ micro: 1, meso: 10, macro: 1 }).name, "Duelist"); // meso
  assert.equal(archetype({ micro: 1, meso: 1, macro: 10 }).name, "Architect"); // macro
});

test("two close axes with a trailing third -> pair archetype", () => {
  assert.equal(archetype({ micro: 8, meso: 8, macro: 1 }).name, "Gladiator"); // micro+meso
  assert.equal(archetype({ micro: 1, meso: 8, macro: 8 }).name, "Commander"); // meso+macro
  assert.equal(archetype({ micro: 8, meso: 1, macro: 8 }).name, "Maestro"); // micro+macro
});

test("all-zero profile does not divide by zero -> center", () => {
  assert.equal(archetype({ micro: 0, meso: 0, macro: 0 }).name, "Polymath");
});

test("ARCHETYPES lists all seven, names unique", () => {
  assert.equal(ARCHETYPES.length, 7);
  assert.equal(new Set(ARCHETYPES.map((a) => a.name)).size, 7);
});

test("encodeStyle / decodeStyle round-trips to 1-decimal precision", () => {
  const code = encodeStyle({ micro: 4.2, meso: 5.1, macro: 8.0 }, 12);
  assert.equal(code, "4.2-5.1-8.0-12");
  const back = decodeStyle(code);
  assert.deepEqual(back, { avg: { micro: 4.2, meso: 5.1, macro: 8.0 }, count: 12 });
});

test("decodeStyle clamps axes to <=10 and rounds count", () => {
  // negatives can't survive decode ('-' is the delimiter), so only the high
  // clamp is reachable; count is rounded to an integer.
  assert.deepEqual(decodeStyle("12.0-5.0-5.5-7.6"), {
    avg: { micro: 10, meso: 5, macro: 5.5 },
    count: 8,
  });
});

test("decodeStyle rejects malformed codes", () => {
  assert.equal(decodeStyle("4.2-5.1-8.0"), null); // too few parts
  assert.equal(decodeStyle("4.2-5.1-8.0-12-99"), null); // too many parts
  assert.equal(decodeStyle("a-b-c-d"), null); // non-numeric
});
