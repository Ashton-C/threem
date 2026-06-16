# End-to-End QA — 3M

Manual acceptance script for a full pre-ship pass. Run top-to-bottom against a
deploy preview (or `npm run dev`). Each case lists **Steps → Expected**. Mark
PASS/FAIL; a FAIL on anything in **§1–§3 or §11** blocks ship.

**Automated coverage that backs this doc** (run first, they're fast):
- `npm test` / `npm run test:unit` — pure logic: slug, archetype, intensity, stats, anchors, prompt invariants.
- `npm run test:integration` — live Gemma contract (needs `GOOGLE_AI_API_SECRET`).
- `npm run test:scoring` — scoring consistency/rubric bands across repeated runs.

Legend: 🔑 = needs sign-in · 💸 = spends an LLM call · 🌐 = calls a third party.

---

## 1. Core scoring flow

### 1.1 Score a new game (cache miss) 💸
- **Steps:** Type `Hollow Knight` → submit.
- **Expected:** A triangle/radar renders with three 0–10 axes + a one-line reason
  each; genre, publisher, release year populate; box art appears (Steam, else
  IGDB, else placeholder). Result persists — it's now in the catalog.

### 1.2 Cache hit (no LLM) 
- **Steps:** Score `Hollow Knight` again (or any previously-scored title).
- **Expected:** Result returns **instantly**, identical scores. Network tab shows
  `/api/score` responding `{cached:true}` with no model latency.

### 1.3 Alias / spelling resolves to the same game
- **Steps:** Score `hollow  knight` (extra spaces / casing), then `Sid Meier's
  Civilization VI` and `Civilization 6`.
- **Expected:** Each resolves to the existing canonical row (no duplicate cards).
  Civ variants collapse to one `Civilization VI`.

### 1.4 Remaster collapses to the original 💸
- **Steps:** Score `Dark Souls: Remastered`, `The Last of Us Remastered`.
- **Expected:** Titles return as `Dark Souls` / `The Last of Us` and reuse the
  original's row — **not** a separate "Remastered" entry.

### 1.5 Re-score / "wrong game?" (force) 💸
- **Steps:** On a result, use the re-score/"wrong game?" action.
- **Expected:** Bypasses cache, re-resolves with the current prompt, overwrites
  the alias. No duplicate row.

### 1.6 Junk / non-game input 💸
- **Steps:** Submit `asdfghjkl`, `the weather today`, `12345`.
- **Expected:** Friendly "not recognized" state. **No** invented scores, nothing
  persisted to the catalog.

### 1.7 Input guards
- **Steps:** Submit empty/whitespace; submit a 500-character string.
- **Expected:** Empty → rejected client-side or 400, no LLM call. Over 100 chars →
  400 "input too long" **before** any model call.

---

## 2. Rate limiting & resilience

### 2.1 Per-IP limit 💸
- **Steps:** Rapidly submit 12+ *distinct uncached* titles within 10s.
- **Expected:** First ~10 score; further requests get HTTP 429 "rate limited,
  slow down". Cached lookups still work during the cooldown.

### 2.2 Fail-closed in production (config check)
- **Steps:** In the deployed env, confirm `UPSTASH_REDIS_REST_URL` / `_TOKEN` are
  set. (To observe the failure mode, temporarily unset in a preview.)
- **Expected:** With Upstash **set** → scoring works. With it **unset in prod** →
  new scorings return 429 by design (cached lookups still served), and the server
  log prints the "BLOCKED … fail-closed" error. Never silently unlimited.

### 2.3 Model fallback (best-effort to verify)
- **Expected behavior:** On a Gemma *daily-quota* 429 the request transparently
  retries on `gemini-flash-lite-latest`; the user sees a normal result. Per-minute
  429s retry on Gemma itself. (Hard to force manually — covered structurally by
  code review + `test:scoring`.)

### 2.4 LLM/API outage
- **Steps:** (Preview) point `GOOGLE_AI_API_SECRET` at an invalid key, score an
  uncached title.
- **Expected:** 502 "scoring temporarily unavailable", logged server-side; the UI
  shows an error state, not a crash.

---

## 3. Auth (magic link) 🔑🌐

### 3.1 Sign in
- **Steps:** Enter your email → "magic link sent" → open the email → click the link.
- **Expected:** Link lands on `/auth/callback` (or `/auth/confirm`), session cookie
  set, redirected to `/`, header shows your email + "sign out". **The email link
  must point at the deployed domain, not localhost** (see deploy checklist).

### 3.2 Session persists & refreshes
- **Steps:** Reload; navigate between pages; return after a while.
- **Expected:** Stays signed in (middleware refreshes the session). No flicker to
  signed-out on reload.

### 3.3 Sign out
- **Expected:** Returns to signed-out state; library/feedback actions now prompt
  for sign-in.

### 3.4 Auth not configured (graceful)
- **Expected:** If the `NEXT_PUBLIC_SUPABASE_*` envs are absent, the auth panel is
  simply hidden and the rest of the app works.

---

## 4. Library 🔑

### 4.1 Add / remove
- **Steps:** Signed in, add a scored game to your library; remove it.
- **Expected:** Appears/disappears immediately; persists across reload. Re-adding
  the same game does not duplicate (upsert on user+game).

### 4.2 Playtime
- **Steps:** Add with a playtime value.
- **Expected:** Stored as a non-negative integer; negative/garbage is dropped, not
  errored.

### 4.3 Ownership isolation (authz)
- **Steps:** With a second account, confirm you only see your own library.
- **Expected:** No cross-user leakage (RLS scopes every read/write to the session
  user). API never trusts a body `user_id`.

### 4.4 Library error surface
- **Expected:** A backend error returns a generic `{error:"request failed"}` — no
  raw Postgres message leaks to the client.

---

## 5. Score feedback 🔑

### 5.1 Vote
- **Steps:** On a game, mark an axis "too high" / "too low".
- **Expected:** One vote per (user, game, axis); changing your vote replaces it.
  Signed-out users can't vote.

---

## 6. Steam import 🔑🌐

### 6.1 Import by SteamID / vanity URL
- **Steps:** Provide a 17-digit SteamID or vanity name; run import.
- **Expected:** Owned games matched to our catalog **by `steam_appid`** are added
  to your library; unscored-but-owned games are *reported, not auto-scored*
  (avoids a huge LLM batch). Profile must be public.

### 6.2 Steam key absent
- **Expected:** If `STEAM_API_KEY` is unset, the endpoint returns 503 and the rest
  of the app is unaffected.

### 6.3 Steam OpenID login 🌐
- **Steps:** Use the Steam sign-in flow if surfaced.
- **Expected:** Redirects to Steam, returns to `/api/steam/callback`, the SteamID
  is verified via `check_authentication` (a forged callback can't spoof an ID).
  `return_to`/`realm` are built from the request origin → correct on the live domain
  automatically.

---

## 7. Discovery & catalog pages

### 7.1 Autocomplete (`/api/suggest`)
- **Steps:** Type ≥2 chars in the search box.
- **Expected:** Up to 6 suggestions from already-cached games, featured first.
  `%`/`_` in input don't break it (wildcards stripped).

### 7.2 Spotlight (home)
- **Expected:** 3 random featured games with real art; reshuffles per load.

### 7.3 Stats strip / `/stats`
- **Expected:** Totals, per-axis averages, genre and archetype distributions match
  the catalog. Empty catalog renders without NaN.

### 7.4 Recommend
- **Steps:** `?axis=macro` and "more like this" (`?near=`).
- **Expected:** `axis` → strongest-on-that-axis picks; `near` → closest games in
  3M space. Only from the curated featured pool.

### 7.5 Browse / Compare / Game detail
- **Steps:** Open `/browse`, `/compare`, a `/game/<slug>` page.
- **Expected:** Browse lists/filters the catalog; compare overlays profiles; game
  page shows scores, reasons, percentiles vs. catalog, similar games, Steam link.

---

## 8. Share / archetype

### 8.1 Style archetype
- **Expected:** A library/profile maps to one of the 7 archetypes (Headhunter,
  Duelist, Architect, Gladiator, Commander, Maestro, Polymath) per its
  micro/meso/macro balance.

### 8.2 Share link + OG image
- **Steps:** Copy a share link (`/style/<code>`); paste into a link-preview tool.
- **Expected:** Link uses the current origin; the page decodes the code back to the
  profile; the OpenGraph image renders the archetype/scores.

---

## 9. Cross-cutting

- **9.1 Mobile/responsive:** header, triangle, forms, library usable at ~375px.
- **9.2 Keyboard/submit:** Enter submits search; no double-submit while busy.
- **9.3 No console errors** on the main flows.
- **9.4 XSS sanity:** a game whose name/reason contains `<script>`-like text renders
  as escaped text (React text nodes), never executes.

---

## 10. Security spot-checks (full list in `docs/SECURITY_REVIEW.md`)

- Rate-limit key is the platform IP, not client `X-Forwarded-For`.
- `/api/score` enforces the 100-char input cap.
- Service-role key never reaches the browser bundle (`server-only` guard).
- Library/feedback enforce ownership via session + RLS.
- **Post-deploy:** re-run the live RLS probe; confirm the auth cookie is
  `SameSite=Lax` on the real domain.

---

## 11. Pre-deploy configuration checklist (the localhost→prod gotchas)

> The repo has **no** hardcoded URLs — these are all dashboard/env settings.

- [ ] **Vercel env (required):** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
      `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `GOOGLE_AI_API_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- [ ] **Vercel env (optional):** `STEAM_API_KEY`, `IGDB_CLIENT_ID`,
      `IGDB_CLIENT_SECRET`. (Watch for trailing comments/whitespace when pasting.)
- [ ] **Supabase → Auth → URL Configuration → Site URL:** set to the prod domain
      (this is the base used in magic-link *emails* — the #1 localhost trap).
- [ ] **Supabase → Auth → Redirect URLs:** add `https://<domain>/auth/callback`,
      `https://<domain>/auth/confirm` (or `https://<domain>/**`); keep localhost for
      dev; optionally add `https://*.vercel.app/**` for preview deploys.
- [ ] **Steam:** nothing to configure (origin is dynamic; API key is domain-agnostic).
- [ ] **Google AI key:** do **not** add an HTTP-referrer restriction (server-to-server
      calls have no referrer — it would break scoring).
- [ ] **DB migrations** in `supabase/migrations/` applied in the Supabase SQL editor.
- [ ] After deploy: re-run RLS probe + `npm run test:integration` against the
      live key once.
