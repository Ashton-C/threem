import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { ipAddress } from "@vercel/functions";
import type { NextRequest } from "next/server";

// Rate limiting guards NEW (LLM-billed) lookups; cache hits are free.
const enabled =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;
const isProd = process.env.NODE_ENV === "production";

const redis = enabled ? Redis.fromEnv() : null;

// per-IP: caps how fast one client can force new lookups
const perIp = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "10 s"), prefix: "threem:ip" })
  : null;

// global: caps total new (LLM-billed) lookups across everyone, so a
// distributed burst can't drain the model quota
const global = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "60 s"), prefix: "threem:global" })
  : null;

if (!enabled && isProd) {
  console.error(
    "threem: UPSTASH_REDIS_REST_URL/TOKEN are not set — new-game scoring is " +
      "BLOCKED in production until they are configured (fail-closed)."
  );
}

/**
 * Trusted client IP. On Vercel this comes from the platform (signed
 * headers), not a client-spoofable X-Forwarded-For. Falls back to a
 * constant off-platform (local dev), where rate limiting isn't the point.
 */
export function clientIp(req: NextRequest): string {
  return ipAddress(req) ?? "local";
}

/**
 * Returns true if the request may proceed to the LLM.
 * - Not configured + production -> false (fail closed; cached lookups still work).
 * - Not configured + dev        -> true  (no limiting locally).
 * - Configured                  -> allowed only if BOTH per-IP and global pass.
 * - Redis error                 -> true  (fail open on a transient outage).
 */
export async function checkRateLimit(ip: string): Promise<boolean> {
  if (!perIp || !global) return !isProd;
  try {
    const [a, b] = await Promise.all([perIp.limit(ip), global.limit("all")]);
    return a.success && b.success;
  } catch (err) {
    console.error("threem: rate limit check failed, allowing request", err);
    return true;
  }
}
