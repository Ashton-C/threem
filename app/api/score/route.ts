import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/supabase";
import { slugify } from "@/lib/slug";
import { checkRateLimit } from "@/lib/ratelimit";

const anthropic = new Anthropic();

const SYSTEM = `You are a game analyst scoring video games on three axes, each 0-10.
Score INDEPENDENTLY — a game can be high or low on all three at once.

Micro: moment-to-moment mechanical execution (aim, reaction, combos, precise control).
Meso: mid-term tactics ~30s-few min (reading opponents, cooldown tracking, engage/disengage).
Macro: long-term strategy (economy, map control, build orders, objective pacing).

ANCHORS — calibrate, do not drift:
Micro 9-10: CS2, StarCraft II, Osu!, Street Fighter, Apex. Micro 5-6: Dark Souls, Monster Hunter. Micro 1-2: Civilization, Stardew.
Meso 9-10: Dota 2, Poker, Magic, Rainbow Six Siege. Meso 5-6: Apex, Monster Hunter. Meso 1-2: Osu!, Stardew.
Macro 9-10: Civilization, Age of Empires, StarCraft II, Factorio. Macro 5-6: Hearthstone, Magic. Macro 1-2: Osu!, Street Fighter.

RULES:
1. Write the reason BEFORE the number.
2. Unrecognized game OR non-game input -> "recognized": false, no guessed scores.
3. Output ONLY this JSON, no markdown:
{"game":"<canonical name>","recognized":<bool>,
 "micro":{"reason":"<line>","score":<0-10>},
 "meso":{"reason":"<line>","score":<0-10>},
 "macro":{"reason":"<line>","score":<0-10>},
 "confidence":"<high|medium|low>"}`;

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
  let msg;
  try {
    msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001", // cheap model; rubric carries the weight
      max_tokens: 400,
      temperature: 0.2, // low temp = stable scores
      system: SYSTEM,
      messages: [{ role: "user", content: `GAME: ${input}` }],
    });
  } catch (err) {
    console.error("threem: LLM scoring call failed", err);
    return NextResponse.json(
      { error: "scoring temporarily unavailable" },
      { status: 502 }
    );
  }

  const text = msg.content.find((b) => b.type === "text")?.text ?? "";
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return NextResponse.json({ error: "bad model output" }, { status: 502 });
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
