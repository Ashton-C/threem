// Seeds the curated top-50 into the games table through the production
// scoring pipeline (same prompt, same Steam enrichment), then stamps
// featured_rank. Idempotent: already-cached games are just re-ranked.
//
// Requires migration 0002 applied. Run: npm run seed:top50

import { TOP50 } from "../lib/top50.ts";
import { lookupCachedGame, scoreAndCache, type GameRow } from "../lib/resolve.ts";
import { db } from "../lib/supabase.ts";
import { slugify } from "../lib/slug.ts";
import { scoreGame } from "../lib/scoring.ts";
import { findSteamMeta } from "../lib/steam.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Rows created before the metadata prompt have genre/steam fields null.
// Re-score them in place (same id, so library references survive).
async function backfill(game: GameRow): Promise<GameRow> {
  if (game.genre !== null || game.steam_url !== null) return game;
  const parsed = await scoreGame(game.name);
  if (!parsed.recognized) return game;
  const steam = await findSteamMeta(parsed.game);
  const { data } = await db
    .from("games")
    .update({
      micro: parsed.micro.score,
      meso: parsed.meso.score,
      macro: parsed.macro.score,
      reasoning: {
        micro: parsed.micro.reason,
        meso: parsed.meso.reason,
        macro: parsed.macro.reason,
      },
      confidence: parsed.confidence,
      genre: parsed.genre ?? null,
      subgenres: parsed.subgenres ?? null,
      publisher: parsed.publisher ?? null,
      release_year: parsed.release_year ?? null,
      steam_appid: steam?.steam_appid ?? null,
      steam_url: steam?.steam_url ?? null,
      thumbnail: steam?.thumbnail ?? null,
    })
    .eq("id", game.id)
    .select()
    .single();
  await sleep(2000);
  return data ?? game;
}

let scored = 0;
let cached = 0;
let failed = 0;

for (const [i, title] of TOP50.entries()) {
  const rank = i + 1;
  const rawSlug = slugify(title);
  let game = await lookupCachedGame(rawSlug);

  if (game) {
    cached++;
    try {
      game = await backfill(game);
    } catch (err) {
      console.log(`  backfill failed for ${title}: ${String(err).slice(0, 80)}`);
    }
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

// final pass: backfill any remaining pre-metadata rows outside the top-50
const { data: stale } = await db
  .from("games")
  .select("*")
  .is("genre", null);
for (const g of stale ?? []) {
  try {
    await backfill(g as GameRow);
    console.log(`✓ backfilled ${g.name}`);
  } catch (err) {
    console.log(`✗ backfill ${g.name}: ${String(err).slice(0, 80)}`);
  }
}

console.log(`\ndone: ${scored} scored, ${cached} already cached, ${failed} failed`);
process.exit(failed ? 1 : 0);
