-- Run this in the Supabase SQL editor (Phase 1, Step 2).

create table games (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  micro       int  not null,
  meso        int  not null,
  macro       int  not null,
  reasoning   jsonb not null,      -- { micro: "...", meso: "...", macro: "..." }
  confidence  text,
  created_at  timestamptz default now()
);

-- every distinct spelling a user types maps back to one canonical game row
create table game_aliases (
  alias_slug  text primary key,
  game_id     uuid references games(id) on delete cascade
);
