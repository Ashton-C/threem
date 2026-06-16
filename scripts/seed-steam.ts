// Seed the catalog from real Steam users' libraries. Pulls each user's owned
// games (public profiles only), takes their most-PLAYED titles — the
// recognizable ones, not idle shovelware — merges + dedupes across users, and
// scores the new ones through the production pipeline. Idempotent: games already
// cached are skipped. Library fetches run concurrently; scoring is paced (with a
// tunable pool) to stay free-tier friendly.
//
//   npm run seed:steam -- --check <id|vanity> [more...]            # scout only, no scoring
//   npm run seed:steam -- [--limit N] [--concurrency C] <id|vanity> [more...]
//
// <id|vanity> accepts a 64-bit steamid, a vanity name, or a full profile URL.

import { lookupCachedGame, scoreAndCache } from "../lib/resolve.ts";
import { slugify } from "../lib/slug.ts";

const STEAM = "https://api.steampowered.com";
const KEY = process.env.STEAM_API_KEY;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const timeoutFetch = (url: string) => fetch(url, { signal: AbortSignal.timeout(10_000) });

async function resolveSteamId(raw: string): Promise<string | null> {
  const trimmed = raw.trim();
  if (/^\d{17}$/.test(trimmed)) return trimmed;
  const vanity =
    trimmed.match(/steamcommunity\.com\/id\/([^/?#]+)/)?.[1] ??
    trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/)?.[1] ??
    trimmed;
  if (/^\d{17}$/.test(vanity)) return vanity;
  if (!/^[\w.-]{1,64}$/.test(vanity)) return null;
  const res = await timeoutFetch(
    `${STEAM}/ISteamUser/ResolveVanityURL/v1/?key=${KEY}&vanityurl=${encodeURIComponent(vanity)}`
  );
  const data = await res.json();
  return data?.response?.success === 1 ? data.response.steamid : null;
}

type Owned = { appid: number; name: string; playtime: number };

async function ownedGames(steamId: string): Promise<Owned[]> {
  const res = await timeoutFetch(
    `${STEAM}/IPlayerService/GetOwnedGames/v1/?key=${KEY}&steamid=${steamId}` +
      `&include_appinfo=1&include_played_free_games=1&format=json`
  );
  const data = await res.json();
  return (data?.response?.games ?? [])
    .filter((g: { name?: string }) => g.name)
    .map((g: { appid: number; name: string; playtime_forever?: number }) => ({
      appid: g.appid,
      name: g.name,
      playtime: g.playtime_forever ?? 0,
    }));
}

type Library = { raw: string; steamId: string | null; games: Owned[] };

async function fetchLibrary(raw: string): Promise<Library> {
  try {
    const steamId = await resolveSteamId(raw);
    if (!steamId) return { raw, steamId: null, games: [] };
    return { raw, steamId, games: await ownedGames(steamId) };
  } catch (err) {
    console.log(`  !! ${raw}: ${String(err).slice(0, 80)}`);
    return { raw, steamId: null, games: [] };
  }
}

/** Top `limit` titles per user by playtime, merged and deduped by canonical
 *  slug across all users, ordered by the highest playtime seen. */
function mergeTopByPlaytime(libs: Library[], limit: number): string[] {
  const bySlug = new Map<string, { name: string; playtime: number }>();
  for (const lib of libs) {
    const top = [...lib.games].sort((a, b) => b.playtime - a.playtime).slice(0, limit);
    for (const g of top) {
      const slug = slugify(g.name);
      const cur = bySlug.get(slug);
      if (!cur || g.playtime > cur.playtime) bySlug.set(slug, { name: g.name, playtime: g.playtime });
    }
  }
  return [...bySlug.values()].sort((a, b) => b.playtime - a.playtime).map((v) => v.name);
}

/** Run `fn` over items with at most `n` in flight at once. */
async function pool<T>(items: T[], n: number, fn: (item: T, i: number) => Promise<void>) {
  let idx = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
      while (idx < items.length) {
        const i = idx++;
        await fn(items[i], i);
      }
    })
  );
}

// ---- args ----
const argv = process.argv.slice(2);
const check = argv.includes("--check");
const numFlag = (flag: string, dflt: number) => {
  const v = Number(argv[argv.indexOf(flag) + 1]);
  return argv.includes(flag) && Number.isFinite(v) ? v : dflt;
};
const LIMIT = numFlag("--limit", 60); // top-played titles per user
const CONCURRENCY = numFlag("--concurrency", 2); // scoring calls in flight
const ids = argv.filter(
  (a, i) => !a.startsWith("--") && argv[i - 1] !== "--limit" && argv[i - 1] !== "--concurrency"
);

if (!KEY) {
  console.error("STEAM_API_KEY not set (add it to .env.local).");
  process.exit(1);
}
if (!ids.length) {
  console.error("usage: npm run seed:steam -- [--check] [--limit N] [--concurrency C] <id|vanity>...");
  process.exit(1);
}

// fetch every library concurrently
const libs = await Promise.all(ids.map(fetchLibrary));

for (const lib of libs) {
  if (!lib.steamId) {
    console.log(`✗ ${lib.raw}: couldn't resolve to a SteamID`);
    continue;
  }
  if (!lib.games.length) {
    console.log(`✗ ${lib.raw} (${lib.steamId}): 0 games — private profile? (Privacy → Game details → Public)`);
    continue;
  }
  const top = [...lib.games].sort((a, b) => b.playtime - a.playtime);
  console.log(`✓ ${lib.raw} (${lib.steamId}): ${lib.games.length} games. Most played:`);
  for (const g of top.slice(0, check ? 12 : 5)) {
    console.log(`    ${String(Math.round(g.playtime / 60)).padStart(5)}h  ${g.name}`);
  }
}

const merged = mergeTopByPlaytime(libs, LIMIT);
const publicCount = libs.filter((l) => l.games.length).length;

if (check) {
  console.log(`\nscout: ${publicCount}/${libs.length} profiles public; ${merged.length} unique candidate games (top ${LIMIT} each, deduped).`);
  process.exit(0);
}

if (!merged.length) {
  console.log("\nno games to seed (no public libraries resolved).");
  process.exit(1);
}

console.log(`\nseeding ${merged.length} unique games from ${publicCount} libraries (concurrency ${CONCURRENCY})...`);
let scored = 0;
let cached = 0;
let failed = 0;

await pool(merged, CONCURRENCY, async (name, i) => {
  const rawSlug = slugify(name);
  if (await lookupCachedGame(rawSlug)) {
    cached++;
    return;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await scoreAndCache(name, rawSlug);
      if (!res.recognized) {
        console.log(`  !! ${name}: not recognized`);
        return;
      }
      if (res.game) {
        scored++;
        console.log(
          `✓ ${String(i + 1).padStart(3)}/${merged.length} ${res.game.name}` +
            ` [${res.game.micro}/${res.game.meso}/${res.game.macro}]${res.game.steam_url ? " steam✓" : ""}`
        );
        await sleep(1200); // free-tier friendly between scored games
        return;
      }
    } catch (err) {
      const wait = String(err).includes("429") ? 20_000 : 3_000;
      console.log(`  retry ${name} (${String(err).slice(0, 70)}) in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
  failed++;
});

console.log(`\ndone: ${scored} scored, ${cached} already cached, ${failed} failed`);
process.exit(failed ? 1 : 0);
