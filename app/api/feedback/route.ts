import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase-server";

const AXES = ["micro", "meso", "macro"];
const DIRS = ["too_low", "too_high"];

// Score feedback — sign-in required; one vote per (user, game, axis).
export async function GET(req: NextRequest) {
  const game_id = req.nextUrl.searchParams.get("game_id");
  if (!game_id) return NextResponse.json({ votes: [] });

  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ votes: [] });

  const { data } = await supabase
    .from("score_feedback")
    .select("axis,direction")
    .eq("game_id", game_id);
  return NextResponse.json({ votes: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { game_id, axis, direction } = await req.json();
  if (!game_id || typeof game_id !== "string" || !AXES.includes(axis) || !DIRS.includes(direction))
    return NextResponse.json({ error: "bad input" }, { status: 400 });

  const { error } = await supabase
    .from("score_feedback")
    .upsert(
      { user_id: user.id, game_id, axis, direction },
      { onConflict: "user_id,game_id,axis" }
    );
  if (error) return NextResponse.json({ error: "save failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const game_id = req.nextUrl.searchParams.get("game_id");
  const axis = req.nextUrl.searchParams.get("axis");
  if (!game_id || !axis || !AXES.includes(axis))
    return NextResponse.json({ error: "bad input" }, { status: 400 });

  const { error } = await supabase
    .from("score_feedback")
    .delete()
    .eq("game_id", game_id)
    .eq("axis", axis);
  if (error) return NextResponse.json({ error: "delete failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
