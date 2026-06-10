import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createUserClient } from "@/lib/supabase-server";

// token_hash magic-link landing (alternate Supabase email template style).
export async function GET(req: NextRequest) {
  const token_hash = req.nextUrl.searchParams.get("token_hash");
  const type = req.nextUrl.searchParams.get("type") as EmailOtpType | null;
  if (token_hash && type) {
    const supabase = await createUserClient();
    await supabase.auth.verifyOtp({ token_hash, type });
  }
  return NextResponse.redirect(new URL("/", req.url));
}
