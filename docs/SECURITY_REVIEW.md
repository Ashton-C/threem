# Security Review — 3M

Status: **security pass applied 2026-06-10 — all findings resolved or accepted.**
First reviewed 2026-06-10; fixes applied same day after the feature sprint.

Re-verified 2026-06-12 (pre-ship): all 7 fixes confirmed present at the code
level against the new Gemma-4 scoring path — #1 `ipAddress(req)`
(`lib/ratelimit.ts`), #2 global `60/60s` limiter (both must pass), #3
`MAX_INPUT=100` (`/api/score`), #4 fail-closed in prod, #5 output sanity-gate
(`lib/resolve.ts`), #6 `server-only` (`lib/supabase.ts`), #7 generic
`/api/library` errors. The Gemma-4 switch is neutral-to-positive for #5: input
still flows as `GAME: ${input}` behind the 100-char cap + sanity-gate, and the
new `responseSchema` (with `maxLength` caps) further constrains persisted
output. **Still TODO post-deploy:** re-run the live RLS probe and confirm the
`SameSite` auth-cookie flag on the deployed domain (not reproducible locally).

## Resolved this pass
- **#1 XFF spoofing** → IP now from `@vercel/functions` `ipAddress(req)` (signed
  platform header), never client `X-Forwarded-For`. `lib/ratelimit.ts:clientIp`.
- **#2 Global LLM cap** → second sliding-window limiter (`60/60s`, key `"all"`)
  checked alongside per-IP; both must pass. `lib/ratelimit.ts`.
- **#3 Input length** → `/api/score` rejects input > 100 chars (400). Verified.
- **#4 Fail-closed** → production with Upstash unset blocks new scorings (429);
  cached lookups still served. Verified live.
- **#5 Prompt-injection / DB pollution** → `lib/resolve.ts` sanity-gates model
  output (name length, scores 0–10) before insert.
- **#6 `server-only` guard** → `lib/supabase.ts` imports `server-only`; a
  client-side import now fails the build.
- **#7 Error disclosure** → `/api/library` returns generic messages; Postgres
  detail stays server-side.

RLS re-verified live (no schema change since): publishable key reads public
`games`, blocked from writes (`42501`), can't read others' `user_games` /
`score_feedback`. The feedback feature (added after the first review) was built
to the same auth + RLS + PK-dedupe pattern and verified with a real user JWT.

Original findings below, retained for the record.

---


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
