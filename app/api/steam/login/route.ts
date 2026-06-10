import { NextRequest, NextResponse } from "next/server";

// Kick off Steam OpenID 2.0 sign-in. Steam authenticates the user and
// redirects back to /api/steam/callback with their verified SteamID.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": `${origin}/api/steam/callback`,
    "openid.realm": origin,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return NextResponse.redirect(`https://steamcommunity.com/openid/login?${params}`);
}
