import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStats, type StatRow } from "../../lib/stats.ts";

const rows: StatRow[] = [
  { micro: 10, meso: 1, macro: 1, genre: "FPS" }, // Headhunter
  { micro: 10, meso: 1, macro: 1, genre: "FPS" }, // Headhunter
  { micro: 1, meso: 1, macro: 10, genre: "Strategy" }, // Architect
];

test("totals and per-axis averages", () => {
  const s = computeStats(rows);
  assert.equal(s.total, 3);
  assert.equal(s.avg.micro, 21 / 3);
  assert.equal(s.avg.meso, 1);
  assert.equal(s.avg.macro, 12 / 3);
});

test("score histogram buckets 0..10 per axis", () => {
  const s = computeStats(rows);
  assert.equal(s.dist.micro.length, 11);
  assert.equal(s.dist.micro[10], 2); // two 10s
  assert.equal(s.dist.micro[1], 1); // one 1
  assert.equal(s.dist.macro[10], 1);
  assert.equal(s.dist.meso[1], 3);
});

test("genres counted and sorted by frequency desc", () => {
  const s = computeStats(rows);
  assert.deepEqual(s.genres, [
    { genre: "FPS", count: 2 },
    { genre: "Strategy", count: 1 },
  ]);
});

test("archetype tally always lists all seven, zero-filled", () => {
  const s = computeStats(rows);
  assert.equal(s.archetypes.length, 7);
  const byName = Object.fromEntries(s.archetypes.map((a) => [a.name, a.count]));
  assert.equal(byName.Headhunter, 2);
  assert.equal(byName.Architect, 1);
  assert.equal(byName.Duelist, 0); // present but zero
});

test("empty catalog is safe (no NaN, no divide-by-zero)", () => {
  const s = computeStats([]);
  assert.equal(s.total, 0);
  assert.equal(s.avg.micro, 0);
  assert.deepEqual(s.genres, []);
  assert.equal(s.archetypes.length, 7);
  assert.ok(s.archetypes.every((a) => a.count === 0));
});

test("scores out of range are clamped into the histogram, not dropped", () => {
  const s = computeStats([{ micro: 11, meso: -2, macro: 5, genre: null }]);
  assert.equal(s.dist.micro[10], 1); // 11 -> bucket 10
  assert.equal(s.dist.meso[0], 1); // -2 -> bucket 0
});
