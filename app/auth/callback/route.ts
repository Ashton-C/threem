import { NextRequest, NextResponse } from "next/server";
import { createUserClient } from "@/lib/supabase-server";

// PKCE magic-link landing: exchanges ?code= for a session cookie.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createUserClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL("/", req.url));
}
