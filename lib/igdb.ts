// IGDB art lookup — fills box/key art for games that aren't on Steam
// (console & launcher exclusives). IGDB is a Twitch service, so it needs
// Twitch app credentials. No-ops gracefully when unconfigured.
// No Next.js imports so it runs under plain node (backfill script).
import { slugify } from "./slug.ts";

const ID = process.env.IGDB_CLIENT_ID;
const SECRET = process.env.IGDB_CLIENT_SECRET;

// module-scoped token cache (survives warm serverless invocations)
let token: { value: string; expires: number } | null = null;

async function getToken(): Promise<string | null> {
  if (!ID || !SECRET) return null;
  if (token && token.expires > Date.now() + 60_000) return token.value;
  try {
    const res = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${ID}&client_secret=${SECRET}&grant_type=client_credentials`,
      { method: "POST", signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const d = await res.json();
    token = { value: d.access_token, expires: Date.now() + (d.expires_in ?? 3600) * 1000 };
    return token.value;
  } catch {
    return null;
  }
}

type IgdbGame = {
  name: string;
  artworks?: { image_id: string }[];
  screenshots?: { image_id: string }[];
  cover?: { image_id: string };
};

const url = (size: string, id: string) =>
  `https://images.igdb.com/igdb/image/upload/${size}/${id}.jpg`;

// Returns a landscape art URL (key art / screenshot preferred so it fits a
// wide header; cover as a last resort). null if unconfigured or no match.
export async function findIgdbArt(name: string): Promise<string | null> {
  const tok = await getToken();
  if (!tok || !ID) return null;
  try {
    const res = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: { "Client-ID": ID, Authorization: `Bearer ${tok}`, Accept: "application/json" },
      body: `search "${name.replace(/"/g, "")}"; fields name,artworks.image_id,screenshots.image_id,cover.image_id; limit 10;`,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const items = (await res.json()) as IgdbGame[];
    if (!Array.isArray(items) || !items.length) return null;

    // prefer an exact title match over fuzzy ones (avoids mods/bundles)
    const want = slugify(name);
    const hit =
      items.find((it) => slugify(it.name) === want) ??
      items.find((it) => {
        const s = slugify(it.name);
        return s.includes(want) || want.includes(s);
      }) ??
      items[0];

    const art = hit.artworks?.[0]?.image_id;
    const shot = hit.screenshots?.[0]?.image_id;
    const cover = hit.cover?.image_id;
    if (art) return url("t_720p", art);
    if (shot) return url("t_screenshot_big", shot);
    if (cover) return url("t_cover_big", cover);
    return null;
  } catch {
    return null;
  }
}

export type IgdbCandidate = { name: string; year: number | null; cover: string | null };

// Name search over IGDB's full catalog — powers the "which game did you mean?"
// picker. Filters to real games (drops DLC/expansions/bundles) but keeps
// remakes/remasters/ports so the original and its remake can both be offered.
// Returns [] when unconfigured or on any failure (the picker degrades to our
// own cached results + a "score it anyway" path).
type IgdbGameRow = {
  name?: string;
  first_release_date?: number;
  cover?: { image_id: string };
};

export async function searchIgdbGames(query: string): Promise<IgdbCandidate[]> {
  const tok = await getToken();
  if (!tok || !ID) return [];
  const q = query.replace(/"/g, "");
  const headers = { "Client-ID": ID, Authorization: `Bearer ${tok}`, Accept: "application/json" };
  // game_type replaced the deprecated `category` field; same enum values:
  // 0 main, 4 standalone expansion, 8 remake, 9 remaster, 10 expanded, 11 port
  const TYPES = "(0,4,8,9,10,11)";
  const FIELDS = "fields name,first_release_date,cover.image_id;";
  // Two complementary passes, merged: `search` is relevance/punctuation/word-order
  // tolerant ("baldurs gate" -> Baldur's Gate) but won't match a partial word,
  // while a case-insensitive substring filter catches incremental typing
  // ("death stra" -> Death Stranding). Neither handles heavy typos — that's what
  // the "score it anyway" path (LLM) is for.
  const bodies = [
    `search "${q}"; ${FIELDS} where game_type = ${TYPES}; limit 10;`,
    `${FIELDS} where name ~ *"${q}"* & game_type = ${TYPES}; sort total_rating_count desc; limit 10;`,
  ];
  try {
    const batches = await Promise.all(
      bodies.map((body) =>
        fetch("https://api.igdb.com/v4/games", { method: "POST", headers, body, signal: AbortSignal.timeout(8000) })
          .then((r) => (r.ok ? (r.json() as Promise<IgdbGameRow[]>) : []))
          .catch(() => [] as IgdbGameRow[])
      )
    );
    const seen = new Set<string>();
    const out: IgdbCandidate[] = [];
    for (const items of batches) {
      if (!Array.isArray(items)) continue;
      for (const it of items) {
        if (!it.name || seen.has(it.name.toLowerCase())) continue;
        seen.add(it.name.toLowerCase());
        out.push({
          name: it.name,
          year: it.first_release_date ? new Date(it.first_release_date * 1000).getUTCFullYear() : null,
          cover: it.cover?.image_id ? url("t_cover_big", it.cover.image_id) : null,
        });
      }
    }
    return out.slice(0, 14);
  } catch {
    return [];
  }
}
