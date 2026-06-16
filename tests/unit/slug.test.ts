import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../../lib/slug.ts";

// slugify is the cache/dedup key — its stability is what stops the games table
// from fragmenting into duplicate rows, so its edge behavior is load-bearing.

test("lowercases and hyphenates spaces", () => {
  assert.equal(slugify("Counter Strike 2"), "counter-strike-2");
});

test("keeps existing hyphens and collapses runs", () => {
  assert.equal(slugify("Half-Life 2"), "half-life-2");
  assert.equal(slugify("Marvel  -  Avengers"), "marvel-avengers");
});

test("strips apostrophes and trademark symbols", () => {
  assert.equal(slugify("Sid Meier's Civilization VI"), "sid-meiers-civilization-vi");
  assert.equal(slugify("Tom Clancy's Rainbow Six® Siege"), "tom-clancys-rainbow-six-siege");
});

test("trims and collapses surrounding/inner whitespace", () => {
  assert.equal(slugify("   Dark    Souls   "), "dark-souls");
});

test("drops non-ascii letters (documented lossy behavior)", () => {
  // accented chars are removed, not transliterated — same game must always be
  // typed the same way OR resolved via the LLM's canonical-name pass.
  assert.equal(slugify("Pokémon"), "pokmon");
});

test("punctuation-only input slugifies to empty string (route rejects it)", () => {
  assert.equal(slugify("???"), "");
  assert.equal(slugify("!!!"), "");
});

test("is idempotent on an already-slugified value", () => {
  const once = slugify("The Elder Scrolls V: Skyrim");
  assert.equal(slugify(once), once);
});
