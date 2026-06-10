# 3M — Micro / Meso / Macro game breakdown

Type a game, get its Micro / Meso / Macro skill breakdown, scored by an LLM
against a fixed rubric. No accounts. The DB starts empty and fills itself as
people search.

**Stack:** Next.js (App Router) · Supabase (Postgres) · Anthropic API · Vercel.

The frontend never talks to Supabase or the LLM directly — everything goes
through one server-side route:

```
browser  →  /api/score  →  cache lookup (Supabase)
                        →  miss? LLM scoring call
                        →  write back to cache
                        →  return scores
```

Two-stage cache: raw spelling → alias → game. "LoL", "lol", and
"league of legends" all resolve to one canonical row, and each spelling only
ever costs one LLM call, then it's free forever.

## Setup

1. **Supabase** — create a project at [supabase.com](https://supabase.com),
   then run `supabase/schema.sql` in the SQL editor.
2. **Env vars** — copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (project settings → API).
     The service-role key only ever lives server-side — never expose it in a
     `NEXT_PUBLIC_` var or client component.
   - `ANTHROPIC_API_KEY` ([console.anthropic.com](https://console.anthropic.com))
   - `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
     ([upstash.com](https://upstash.com), free tier) — rate-limits new
     (LLM-billed) lookups to 10 req / 10 s per IP. Skipped if unset, which is
     fine locally but **do not deploy publicly without it**.
3. **Run:**

   ```bash
   npm install
   npm run dev
   ```

   Search "Civilization VI" — expect low micro / high macro. Search it again —
   the response should return instantly with `cached: true`.

## Deploy (Vercel)

Import this repo into Vercel and paste the same env vars into the project
settings (same names, no `.env.local`). Deploy.

## Done when

- [ ] Type a game → correct 3M scores + reasoning render.
- [ ] Repeat search returns instantly and shows `cached: true`.
- [ ] Different spellings ("LoL" / "League of Legends") resolve to the same row, no duplicates.
- [ ] Unknown game / junk input shows the "couldn't identify" message, no crash.
- [ ] Rate limit active on the route (Upstash env vars set).
- [ ] Live on Vercel.
