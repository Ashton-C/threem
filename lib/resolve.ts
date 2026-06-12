// Cache-then-LLM resolution shared by the API route and the seed script.
// No Next.js imports so it can run standalone under plain node.

import { db } from "./supabase.ts";
import { slugify } from "./slug.ts";
import { scoreGame } from "./scoring.ts";
import { findSteamMeta } from "./steam.ts";
import { findIgdbArt } from "./igdb.ts";

export type GameRow = {
  id: string;
  slug: string;
  name: string;
  micro: number;
  meso: number;
  macro: number;
  reasoning: { micro: string; meso: string; macro: string };
  confidence: string | null;
  steam_appid: number | null;
  steam_url: string | null;
  thumbnail: string | null;
  genre: string | null;
  subgenres: string[] | null;
  publisher: string | null;
  release_year: number | null;
  featured_rank: number | null;
};

/** Alias-cache lookup. Returns the canonical game row or null. */
export async function lookupCachedGame(rawSlug: string): Promise<GameRow | null> {
  const { data: alias } = await db
    .from("game_aliases")
    .select("game_id")
    .eq("alias_slug", rawSlug)
    .maybeSingle();
  if (!alias) return null;
  const { data: game } = await db
    .from("games").select("*").eq("id", alias.game_id).single();
  return game;
}

/**
 * Cache miss path: LLM-score the input, enrich with Steam metadata,
 * dedupe on canonical slug, insert, and remember the spelling.
 * Throws on LLM failure; returns { recognized: false } for junk input.
 */
export async function scoreAndCache(
  input: string,
  rawSlug: string
): Promise<{ recognized: boolean; game: GameRow | null }> {
  const parsed = await scoreGame(input);
  if (!parsed.recognized) return { recognized: false, game: null };

  // sanity-gate model output before it's persisted to the shared cache
  const valid = (n: unknown) => typeof n === "number" && n >= 0 && n <= 10;
  if (
    typeof parsed.game !== "string" ||
    parsed.game.length === 0 ||
    parsed.game.length > 120 ||
    !valid(parsed.micro?.score) ||
    !valid(parsed.meso?.score) ||
    !valid(parsed.macro?.score)
  ) {
    return { recognized: false, game: null };
  }

  // canonical slug — may already exist under a different spelling
  const canonSlug = slugify(parsed.game);
  let { data: game } = await db
    .from("games").select("*").eq("slug", canonSlug).maybeSingle();

  if (!game) {
    const steam = await findSteamMeta(parsed.game);
    // every game gets art: Steam header first, IGDB key art as fallback
    const thumbnail = steam?.thumbnail ?? (await findIgdbArt(parsed.game));
    const { data: inserted, error: insertErr } = await db.from("games").insert({
      slug: canonSlug,
      name: parsed.game,
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
      thumbnail,
    }).select().single();

    if (insertErr) {
      // concurrent insert of the same canonical slug — re-read the winner
      const { data: existing } = await db
        .from("games").select("*").eq("slug", canonSlug).maybeSingle();
      game = existing;
    } else {
      game = inserted;
    }
  }

  if (game) {
    // remember this spelling so we never re-score it
    await db.from("game_aliases")
      .upsert({ alias_slug: rawSlug, game_id: game.id });
  }

  return { recognized: true, game };
}
