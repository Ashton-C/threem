import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limiting only guards NEW (LLM-billed) lookups — cache hits are free.
// Requires Upstash env vars in production; without them limiting is skipped,
// which is acceptable for local dev only.
const enabled =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN;

const ratelimit = enabled
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, "10 s"),
      prefix: "threem",
    })
  : null;

if (!enabled && process.env.NODE_ENV === "production") {
  console.warn(
    "threem: UPSTASH_REDIS_REST_URL/TOKEN not set — rate limiting is OFF in production."
  );
}

/** Returns true if the request is allowed, false if rate-limited. */
export async function checkRateLimit(key: string): Promise<boolean> {
  if (!ratelimit) return true;
  try {
    const { success } = await ratelimit.limit(key);
    return success;
  } catch (err) {
    // fail open: a Redis outage shouldn't take the endpoint down
    console.error("threem: rate limit check failed, allowing request", err);
    return true;
  }
}
