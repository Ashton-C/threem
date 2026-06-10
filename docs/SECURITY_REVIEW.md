# Security Review — 3M

Status: **findings logged, fixes deferred to the final security pass before ship.**
Last reviewed: 2026-06-10. Re-run a full pass after the feature sprint.

RLS verified enforced against the live DB at review time: the publishable
(`anon`) key can read public `games`, is blocked from writing (`42501`
row-level-security violation), and returns empty for other users'
`user_games`. RLS is the linchpin that makes the browser-exposed
publishable key safe — **re-verify it after any schema migration.**

---

## 🔴 Critical

### 1. Rate-limit bypass via spoofed `x-forwarded-for`
`app/api/score/route.ts` keys the limiter on
`x-forwarded-for?.split(",")[0]` — the **leftmost** value, which is
client-controlled on Vercel (`client-supplied, real-ip`). An attacker
rotates a fake XFF per request → unique bucket every time → the
10-per-10s limit never trips → unlimited Gemini calls → free-tier quota
exhausted (DoS for real users) and an open invoice if billing is ever
enabled.
**Fix:** trust only the platform IP — Vercel `request.ip`,
`ipAddress(req)` from `@vercel/functions`, or the **rightmost** XFF hop.
Never the leftmost.

### 2. No global ceiling on cache-miss (LLM-billed) requests
The limiter is per-IP only. Several IPs / a small botnet each doing
10/10s drains the shared Gemini project quota. No app-wide cap on new
scorings.
**Fix:** add a second global sliding-window limiter in front of the LLM
call (e.g. N new scorings/minute across all IPs).

---

## 🟠 High

### 3. No length cap on `input`
`route.ts` passes `input` into the prompt as `GAME: ${input}` with no
length check (`/api/suggest` caps at 60 chars; `/api/score` does not).
A megabyte of text = huge per-call token cost. Real game names are
short.
**Fix:** reject `input` longer than ~100 chars before the LLM call.

### 4. Rate limiting fails open / silently off
`lib/ratelimit.ts`: if Upstash env vars are unset, limiting is skipped
entirely (returns `true`); runtime Upstash errors also fail open.
Failing open on a transient outage is defensible; **silently shipping
with no protection when the env vars are missing in Vercel is not** —
only a server-log warning flags it.
**Fix:** in production, treat missing Upstash config as a hard startup
error, not a warning.

---

## 🟡 Medium

### 5. Prompt injection → cache / DB pollution
User input flows unescaped into the Gemini prompt (`lib/scoring.ts`).
JSON-output constraint + parser limit the blast radius, but an attacker
can coax the model into "recognizing" junk and persisting
attacker-chosen `name`/`reasoning`/`genre` into the shared `games`
table. Pollution, not takeover — and **not XSS** (see below).
**Fix:** sanity-gate scored output before insert (name length, scores
in 0–10, recognized-name plausibility).

### 6. Service-role client has no `server-only` guard
`lib/supabase.ts` holds the full-access service-role key. Currently only
imported by server routes + the seed script (correct), but nothing
prevents a future accidental `import { db }` in a client component,
which would bundle the key into browser JS.
**Fix:** add `import "server-only";` at the top of `lib/supabase.ts` so
that mistake fails the build.

### 7. Raw Postgres error messages returned to clients
`/api/library` returns `error.message` to the caller (schema/constraint
detail leak).
**Fix:** return a generic message; log detail server-side.

---

## 🟢 Low / verified-safe (no action, documented so the next pass doesn't re-investigate)

- **Stored XSS — not exploitable today.** `name`/`reasoning`/`genre`
  render as React text nodes (auto-escaped). The two attribute-sink
  fields (`thumbnail`, `steam_url`) come **only** from `findSteamMeta`,
  never from the LLM. **Invariant to preserve:** if the model is ever
  allowed to populate a URL field, add scheme/host validation.
- **SSRF — safe.** `lib/steam.ts` hits only the fixed host
  `store.steampowered.com` with an encoded query param; attacker never
  controls the host. 5s timeout present.
- **Open redirect — avoided.** Both auth handlers hardcode
  `redirect(new URL("/", req.url))` — no attacker-controlled `next`.
- **Library authz — correct.** `user_id` comes from the session, never
  the body; RLS scopes every read/write. Verified live.
- **SQL injection — safe.** supabase-js parameterizes; the `ilike` term
  also strips `%`/`_`.
- **CSRF — low risk.** Supabase auth cookies default to `SameSite=Lax`,
  blocking cookie attachment on cross-site state-changing requests to
  `/api/library`. Confirm the cookie flag after deploy.

---

## Final-pass fix order
1, 2, 3, 4, 6 before ship (small, surgical). 5 and 7 are hygiene that can
follow. Re-verify RLS (the live probe above) and re-run this whole list
against the post-feature-sprint code.
