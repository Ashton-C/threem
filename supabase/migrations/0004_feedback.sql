-- Migration 0004: score feedback ("disagree with a score").
-- Run in the Supabase SQL editor AFTER 0003.
-- Sign-in required + one vote per (user, game, axis) keeps abuse down.

create table score_feedback (
  user_id    uuid not null references auth.users(id) on delete cascade,
  game_id    uuid not null references games(id) on delete cascade,
  axis       text not null check (axis in ('micro','meso','macro')),
  direction  text not null check (direction in ('too_low','too_high')),
  created_at timestamptz default now(),
  primary key (user_id, game_id, axis)
);

alter table score_feedback enable row level security;

create policy "select own feedback" on score_feedback
  for select using (auth.uid() = user_id);
create policy "insert own feedback" on score_feedback
  for insert with check (auth.uid() = user_id);
create policy "update own feedback" on score_feedback
  for update using (auth.uid() = user_id);
create policy "delete own feedback" on score_feedback
  for delete using (auth.uid() = user_id);

-- aggregate view for later moderation (service-role reads bypass RLS)
create or replace view score_feedback_tally as
  select game_id, axis, direction, count(*) as votes
  from score_feedback
  group by game_id, axis, direction;
