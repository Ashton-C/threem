import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase-server";

// User library CRUD. Runs as the signed-in user — RLS enforces ownership.

export async function GET() {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { data, error } = await supabase
    .from("user_games")
    .select("added_at, playtime_minutes, game:games(*)")
    .order("added_at", { ascending: false });
  if (error)
    return NextResponse.json({ error: "request failed" }, { status: 500 });

  // merge per-user playtime onto each game
  return NextResponse.json({
    games: (data ?? []).map((r) => ({
      ...(r.game as object),
      playtime_minutes: r.playtime_minutes,
    })),
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { game_id, playtime_minutes } = await req.json();
  if (!game_id || typeof game_id !== "string")
    return NextResponse.json({ error: "no game_id" }, { status: 400 });

  const pt =
    typeof playtime_minutes === "number" && playtime_minutes >= 0
      ? Math.round(playtime_minutes)
      : null;

  const row: { user_id: string; game_id: string; playtime_minutes?: number } = {
    user_id: user.id,
    game_id,
  };
  if (pt != null) row.playtime_minutes = pt;

  const { error } = await supabase
    .from("user_games")
    .upsert(row, { onConflict: "user_id,game_id" });
  if (error)
    return NextResponse.json({ error: "request failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const game_id = req.nextUrl.searchParams.get("game_id");
  if (!game_id)
    return NextResponse.json({ error: "no game_id" }, { status: 400 });

  const { error } = await supabase
    .from("user_games")
    .delete()
    .eq("game_id", game_id);
  if (error)
    return NextResponse.json({ error: "request failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
