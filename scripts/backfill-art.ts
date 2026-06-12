// Backfill box/key art for games with no thumbnail (console & launcher
// exclusives that aren't on Steam) using IGDB. Needs IGDB_CLIENT_ID +
// IGDB_CLIENT_SECRET. Run: npm run backfill:art

import { db } from "../lib/supabase.ts";
import { findIgdbArt } from "../lib/igdb.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const { data, error } = await db
  .from("games")
  .select("id,name")
  .is("thumbnail", null);

if (error) {
  console.error("query failed:", error.message);
  process.exit(1);
}

const games = data ?? [];
console.log(`${games.length} games without art`);
let filled = 0;
let missed = 0;

for (const g of games) {
  let art: string | null = null;
  try {
    art = await findIgdbArt(g.name);
  } catch {
    /* ignore, count as missed */
  }
  if (art) {
    await db.from("games").update({ thumbnail: art }).eq("id", g.id);
    filled++;
    console.log(`✓ ${g.name}`);
  } else {
    missed++;
    console.log(`· ${g.name} — no IGDB art`);
  }
  await sleep(350); // IGDB rate limit ~4 req/s
}

console.log(`\ndone: ${filled} filled, ${missed} missed`);
process.exit(0);
