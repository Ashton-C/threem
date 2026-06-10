// Steam store lookup — link + thumbnail enrichment for the game card.
// Best-effort: every failure returns null; enrichment must never break scoring.
// No Next.js imports so it can run standalone under plain node (seed script).

import { slugify } from "./slug.ts";

export type SteamMeta = {
  steam_appid: number;
  steam_url: string;
  thumbnail: string | null;
};

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`steam ${res.status}`);
  return res.json();
}

export async function findSteamMeta(name: string): Promise<SteamMeta | null> {
  try {
    const search = (await getJson(
      `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(name)}&cc=us&l=en`
    )) as { items?: { id: number; name: string; tiny_image?: string }[] };

    const want = slugify(name);
    const hit = (search.items ?? []).slice(0, 3).find((it) => {
      const got = slugify(it.name);
      return got === want || got.includes(want) || want.includes(got);
    });
    if (!hit) return null;

    let thumbnail: string | null = hit.tiny_image ?? null;
    try {
      const details = (await getJson(
        `https://store.steampowered.com/api/appdetails?appids=${hit.id}&l=en`
      )) as Record<string, { success: boolean; data?: { header_image?: string } }>;
      thumbnail = details[String(hit.id)]?.data?.header_image ?? thumbnail;
    } catch {
      // keep tiny_image fallback
    }

    return {
      steam_appid: hit.id,
      steam_url: `https://store.steampowered.com/app/${hit.id}`,
      thumbnail,
    };
  } catch {
    return null;
  }
}
