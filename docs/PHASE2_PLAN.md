# Phase 2 — Accounts, Library, and the Style Triangle

**Goal:** a signed-in user builds a library of games they play; the app
aggregates the 3M scores of that library into a personal *gaming style*
profile, displayed as a triangle (ternary) heatmap where color intensity
shows where their taste concentrates.

Everything bolts onto Phase 1 without touching the scoring path.

---

## 1. Auth

**Supabase Auth, magic-link email** — we're already on Supabase, it's free,
and there are no passwords to store. Cookie-based sessions via
`@supabase/ssr` so both client components and API routes see the same user.

- Browser client (`lib/supabase-browser.ts`) for sign-in/out + auth state.
- Server client (`lib/supabase-server.ts`, cookie-backed) for API routes.
- `middleware.ts` refreshes the session cookie on every request.
- `app/auth/callback` (PKCE `?code=`) and `app/auth/confirm`
  (`?token_hash=`) handlers cover both magic-link template styles.
- UI: small panel in the header — email field → "send link" → signed-in
  state with sign-out. No separate login page.

**Why not OAuth providers?** Can add Google/Discord later with zero schema
changes; magic link needs no provider setup to start.

## 2. Library

One join table, RLS-protected so users can only touch their own rows:

```sql
create table user_games (
  user_id  uuid not null references auth.users(id) on delete cascade,
  game_id  uuid not null references games(id) on delete cascade,
  added_at timestamptz default now(),
  primary key (user_id, game_id)
);
```

- `/api/library` — GET (list, joined to games), POST (add), DELETE (remove).
  Uses the *user's* session client, not the service role — RLS enforces
  ownership.
- Game card gets a **+ Library** toggle when signed in.
- Migration 0003 also enables RLS on `games` / `game_aliases`
  (public read, service-role-only writes) — they were wide open to anyone
  holding the publishable key.

**Later (not this phase):** Steam library import via `GetOwnedGames`.

## 3. Computing the style profile

Each game is a point in 3M space. For *style* (the shape of what you play,
not how hardcore the games are), normalize each game to barycentric
weights:

```
w_micro = micro / (micro + meso + macro)   (same for meso, macro)
```

Every game becomes a point inside a triangle whose corners are pure-Micro,
pure-Meso, pure-Macro. The profile is then:

- **Heatmap:** subdivide the triangle into N=10 rows of small triangles
  (100 cells); count library games per cell; fill intensity ∝ count.
  Deeper color = more of your library lives there.
- **Centroid marker:** the mean point — your overall lean.
- **Averages:** mean raw micro/meso/macro as bars (keeps the absolute
  scale the triangle deliberately throws away).
- **Archetype label:** dominant axis with a friendly name
  (Micro → "Executor", Meso → "Tactician", Macro → "Strategist",
  spread < 1 → "Hybrid"). Pure presentation — derived, never stored.

All computed client-side from the library payload — no extra tables, no
background jobs. At 10k+ games per user we'd precompute; not a Phase 2
problem.

## 4. Display

`components/TernaryHeatmap.tsx` — pure SVG, no chart library:
triangle grid, per-cell intensity fill (cyan→hot ramp), colored axis
labels matching the existing micro/meso/macro palette, centroid dot.
Lives in a "Your style" panel under the search column alongside the
average bars, archetype label, and removable library chips.

## 5. Manual setup (one-time, dashboard)

1. Run `supabase/migrations/0002_metadata.sql` (if not yet) and
   `0003_library.sql` in the SQL editor.
2. `.env.local`: add `NEXT_PUBLIC_SUPABASE_URL` (same as `SUPABASE_URL`)
   and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the **publishable** `sb_publishable_...`
   key — safe for the browser; never the secret key).
3. Auth → ensure Email provider is on (default). Supabase's built-in
   mailer is rate-limited (~3/hour) — fine for dev, swap in real SMTP
   before launch.
4. On deploy: set Site URL + redirect URLs (Auth → URL Configuration)
   to the Vercel domain.

## 6. Order of work

1. Migration 0003 (library + RLS hardening)
2. Auth plumbing (clients, middleware, callback routes, header panel)
3. `/api/library` + card toggle
4. Aggregation + `TernaryHeatmap` + "Your style" panel
5. Build-verify, manual auth test, ship

## Done when

- [ ] Sign in via magic link, session survives refresh.
- [ ] Add/remove games from library; only your own rows visible.
- [ ] Style panel: heatmap intensity matches library, centroid + averages + archetype render.
- [ ] Anonymous users: everything from Phase 1 still works, no style panel.
- [ ] `games` table no longer publicly writable.
