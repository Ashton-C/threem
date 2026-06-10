import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase-server";

// Import a Steam library into the user's 3M library.
// Matches owned games against our DB by steam_appid (reliable), and adds
// the matches. Games we haven't scored yet are reported, not auto-scored
// (that would be a large batch of LLM calls).

const STEAM = "https://api.steampowered.com";

function timeoutFetch(url: string) {
  return fetch(url, { signal: AbortSignal.timeout(8000) });
}

async function resolveSteamId(raw: string, key: string): Promise<string | null> {
  const trimmed = raw.trim();
  // already a 64-bit steamid
  if (/^\d{17}$/.test(trimmed)) return trimmed;

  // accept a full profile URL or a bare vanity name
  const vanity =
    trimmed.match(/steamcommunity\.com\/id\/([^/?#]+)/)?.[1] ??
    trimmed.match(/steamcommunity\.com\/profiles\/(\d{17})/)?.[1] ??
    trimmed;
  if (/^\d{17}$/.test(vanity)) return vanity;
  if (!/^[\w.-]{1,64}$/.test(vanity)) return null;

  try {
    const res = await timeoutFetch(
      `${STEAM}/ISteamUser/ResolveVanityURL/v1/?key=${key}&vanityurl=${encodeURIComponent(vanity)}`
    );
    const data = await res.json();
    return data?.response?.success === 1 ? data.response.steamid : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const key = process.env.STEAM_API_KEY;
  if (!key)
    return NextResponse.json(
      { error: "Steam import isn't configured." },
      { status: 503 }
    );

  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { steam } = await req.json();
  if (!steam || typeof steam !== "string" || steam.length > 200)
    return NextResponse.json({ error: "Enter a SteamID or profile URL." }, { status: 400 });

  const steamId = await resolveSteamId(steam, key);
  if (!steamId)
    return NextResponse.json(
      { error: "Couldn't resolve that SteamID or vanity URL." },
      { status: 400 }
    );

  // fetch owned games
  let owned: { appid: number; name?: string; playtime_forever?: number }[];
  try {
    const res = await timeoutFetch(
      `${STEAM}/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${steamId}` +
        `&include_appinfo=1&include_played_free_games=1&format=json`
    );
    const data = await res.json();
    owned = data?.response?.games ?? [];
  } catch {
    return NextResponse.json({ error: "Steam request failed." }, { status: 502 });
  }

  if (!owned.length)
    return NextResponse.json({
      total: 0,
      matched: 0,
      added: [],
      hint: "No games returned — the profile may be private (Settings → Privacy → Game details → Public).",
    });

  // match owned appids against scored games
  const appids = owned.map((g) => g.appid).filter(Boolean);
  const matched: { id: string; name: string; steam_appid: number }[] = [];
  // chunk the IN() filter to keep the query reasonable
  for (let i = 0; i < appids.length; i += 300) {
    const chunk = appids.slice(i, i + 300);
    const { data } = await supabase
      .from("games")
      .select("id,name,steam_appid")
      .in("steam_appid", chunk);
    if (data) matched.push(...data);
  }

  // appid -> minutes played, so we can weight the profile by real playtime
  const playtimeByAppid = new Map(
    owned.map((g) => [g.appid, g.playtime_forever ?? 0])
  );

  if (matched.length) {
    // merge (not ignore) so a re-import refreshes playtime
    await supabase.from("user_games").upsert(
      matched.map((m) => ({
        user_id: user.id,
        game_id: m.id,
        playtime_minutes: playtimeByAppid.get(m.steam_appid) ?? null,
      })),
      { onConflict: "user_id,game_id" }
    );
  }

  // owned games we haven't scored yet — named + playtime, scored on demand
  const matchedAppids = new Set(matched.map((m) => m.steam_appid));
  const unmatched = owned
    .filter((g) => g.name && !matchedAppids.has(g.appid))
    .map((g) => ({ appid: g.appid, name: g.name as string, playtime: g.playtime_forever ?? 0 }))
    .slice(0, 500); // cap payload

  return NextResponse.json({
    total: owned.length,
    matched: matched.length,
    added: matched.map((m) => m.name),
    unmatched,
  });
}
