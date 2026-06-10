import { NextRequest, NextResponse } from "next/server";

// Steam OpenID return. We re-POST the assertion to Steam with
// mode=check_authentication so a forged callback can't spoof a SteamID,
// then hand the verified id back to the app via ?steam=<id>.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  // echo every openid.* param back, flipped to a verification request
  const params = new URLSearchParams();
  sp.forEach((value, key) => {
    if (key.startsWith("openid.")) params.set(key, value);
  });
  params.set("openid.mode", "check_authentication");

  let valid = false;
  try {
    const res = await fetch("https://steamcommunity.com/openid/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: AbortSignal.timeout(8000),
    });
    valid = /is_valid\s*:\s*true/.test(await res.text());
  } catch {
    valid = false;
  }

  const claimed = sp.get("openid.claimed_id") ?? "";
  const m = claimed.match(/^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/);

  if (!valid || !m) {
    return NextResponse.redirect(new URL("/?steam_error=1", req.url));
  }
  return NextResponse.redirect(new URL(`/?steam=${m[1]}`, req.url));
}
