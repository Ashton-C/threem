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
      body: `search "${name.replace(/"/g, "")}"; fields name,artworks.image_id,screenshots.image_id,cover.image_id; limit 6;`,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const items = (await res.json()) as IgdbGame[];
    if (!Array.isArray(items) || !items.length) return null;

    const want = slugify(name);
    const hit =
      items.find((it) => {
        const s = slugify(it.name);
        return s === want || s.includes(want) || want.includes(s);
      }) ?? items[0];

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
