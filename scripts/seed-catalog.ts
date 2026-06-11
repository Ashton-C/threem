// Seeds the broader catalog (lib/more-games.ts) through the production
// scoring pipeline. No featured_rank — these fill out the dataset.
// Idempotent: already-cached games are skipped. Run: npm run seed:catalog

import { MORE_GAMES } from "../lib/more-games.ts";
import { lookupCachedGame, scoreAndCache } from "../lib/resolve.ts";
import { slugify } from "../lib/slug.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let scored = 0;
let cached = 0;
let failed = 0;

for (const [i, title] of MORE_GAMES.entries()) {
  const n = i + 1;
  const rawSlug = slugify(title);
  if (await lookupCachedGame(rawSlug)) {
    cached++;
    continue;
  }
  let ok = false;
  for (let attempt = 1; !ok && attempt <= 3; attempt++) {
    try {
      const res = await scoreAndCache(title, rawSlug);
      if (!res.recognized) {
        console.log(`  !! ${title}: not recognized`);
        break;
      }
      if (res.game) {
        scored++;
        ok = true;
        console.log(
          `✓ ${String(n).padStart(3)}/${MORE_GAMES.length} ${res.game.name}` +
            ` [${res.game.micro}/${res.game.meso}/${res.game.macro}]${res.game.steam_url ? " steam✓" : ""}`
        );
      }
    } catch (err) {
      const wait = String(err).includes("429") ? 20000 : 3000;
      console.log(`  retry ${title} (${String(err).slice(0, 70)}) in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
  if (!ok && scored + cached < n) failed++;
  await sleep(1500); // free-tier friendly
}

console.log(`\ndone: ${scored} scored, ${cached} already cached, ${failed} failed`);
process.exit(0);
