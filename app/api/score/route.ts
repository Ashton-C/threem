import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { slugify } from "@/lib/slug";
import { checkRateLimit } from "@/lib/ratelimit";
import { scoreGame } from "@/lib/scoring";

export async function POST(req: NextRequest) {
  const { input } = await req.json();
  if (!input || typeof input !== "string")
    return NextResponse.json({ error: "no input" }, { status: 400 });

  const rawSlug = slugify(input);
  if (!rawSlug)
    return NextResponse.json({ error: "no input" }, { status: 400 });

  // 1. cache lookup via alias — free, happens before any rate limiting
  const { data: alias } = await db
    .from("game_aliases")
    .select("game_id")
    .eq("alias_slug", rawSlug)
    .maybeSingle();

  if (alias) {
    const { data: game } = await db
      .from("games").select("*").eq("id", alias.game_id).single();
    return NextResponse.json({ recognized: true, game, cached: true });
  }

  // 2. rate limit before any LLM-billed work, keyed on IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!(await checkRateLimit(ip)))
    return NextResponse.json(
      { error: "rate limited, slow down" },
      { status: 429 }
    );

  // 3. miss -> score with LLM
  let parsed;
  try {
    parsed = await scoreGame(input);
  } catch (err) {
    console.error("threem: LLM scoring call failed", err);
    return NextResponse.json(
      { error: "scoring temporarily unavailable" },
      { status: 502 }
    );
  }

  if (!parsed.recognized)
    return NextResponse.json({ recognized: false });

  // 4. canonical slug — may already exist under a different spelling
  const canonSlug = slugify(parsed.game);
  let { data: game } = await db
    .from("games").select("*").eq("slug", canonSlug).maybeSingle();

  // 5. insert game if new
  if (!game) {
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

  if (!game)
    return NextResponse.json({ error: "db write failed" }, { status: 500 });

  // 6. remember this spelling so we never re-score it
  await db.from("game_aliases")
    .upsert({ alias_slug: rawSlug, game_id: game.id });

  return NextResponse.json({ recognized: true, game, cached: false });
}
