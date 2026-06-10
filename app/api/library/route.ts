import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase-server";

// User library CRUD. Runs as the signed-in user — RLS enforces ownership.

export async function GET() {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { data, error } = await supabase
    .from("user_games")
    .select("added_at, game:games(*)")
    .order("added_at", { ascending: false });
  if (error)
    return NextResponse.json({ error: "request failed" }, { status: 500 });

  return NextResponse.json({ games: (data ?? []).map((r) => r.game) });
}

export async function POST(req: NextRequest) {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { game_id } = await req.json();
  if (!game_id || typeof game_id !== "string")
    return NextResponse.json({ error: "no game_id" }, { status: 400 });

  const { error } = await supabase
    .from("user_games")
    .upsert({ user_id: user.id, game_id });
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
