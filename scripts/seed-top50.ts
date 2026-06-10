// Seeds the curated top-50 into the games table through the production
// scoring pipeline (same prompt, same Steam enrichment), then stamps
// featured_rank. Idempotent: already-cached games are just re-ranked.
//
// Requires migration 0002 applied. Run: npm run seed:top50

import { TOP50 } from "../lib/top50.ts";
import { lookupCachedGame, scoreAndCache } from "../lib/resolve.ts";
import { db } from "../lib/supabase.ts";
import { slugify } from "../lib/slug.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let scored = 0;
let cached = 0;
let failed = 0;

for (const [i, title] of TOP50.entries()) {
  const rank = i + 1;
  const rawSlug = slugify(title);
  let game = await lookupCachedGame(rawSlug);

  if (game) {
    cached++;
  } else {
    for (let attempt = 1; !game && attempt <= 3; attempt++) {
      try {
        const res = await scoreAndCache(title, rawSlug);
        if (!res.recognized) {
          console.log(`  !! #${rank} ${title}: model did not recognize it`);
          break;
        }
        game = res.game;
        scored++;
      } catch (err) {
        const wait = String(err).includes("429") ? 20000 : 3000;
        console.log(`  retry #${rank} ${title} (${String(err).slice(0, 80)}) in ${wait / 1000}s`);
        await sleep(wait);
      }
    }
    await sleep(2000); // stay friendly to free-tier RPM
  }

  if (!game) {
    failed++;
    console.log(`✗ #${rank} ${title} — FAILED`);
    continue;
  }

  const { error } = await db
    .from("games")
    .update({ featured_rank: rank })
    .eq("id", game.id);
  if (error) {
    failed++;
    console.log(`✗ #${rank} ${title} — rank update failed: ${error.message}`);
  } else {
    console.log(
      `✓ #${String(rank).padStart(2)} ${game.name}  [${game.micro}/${game.meso}/${game.macro}]` +
        `${game.steam_url ? " steam✓" : ""}${game.thumbnail ? " img✓" : ""}`
    );
  }
}

console.log(`\ndone: ${scored} scored, ${cached} already cached, ${failed} failed`);
process.exit(failed ? 1 : 0);
