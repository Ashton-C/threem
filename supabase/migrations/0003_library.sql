-- Migration 0003: user library + RLS hardening.
-- Run in the Supabase SQL editor AFTER 0002.

create table user_games (
  user_id  uuid not null references auth.users(id) on delete cascade,
  game_id  uuid not null references games(id) on delete cascade,
  added_at timestamptz default now(),
  primary key (user_id, game_id)
);

alter table user_games enable row level security;

create policy "select own library" on user_games
  for select using (auth.uid() = user_id);
create policy "insert own library" on user_games
  for insert with check (auth.uid() = user_id);
create policy "delete own library" on user_games
  for delete using (auth.uid() = user_id);

-- Harden the Phase 1 tables: public read, writes only via the service
-- role (which bypasses RLS). Without this, anyone with the publishable
-- key could write to games.
alter table games enable row level security;
alter table game_aliases enable row level security;

create policy "public read games" on games
  for select using (true);
create policy "public read aliases" on game_aliases
  for select using (true);
