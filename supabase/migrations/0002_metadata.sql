-- Migration 0002: game metadata + top-50 + fuzzy search support.
-- Run in the Supabase SQL editor AFTER 0001 (supabase/schema.sql).

alter table games
  add column if not exists steam_appid  int,
  add column if not exists steam_url    text,
  add column if not exists thumbnail    text,
  add column if not exists genre        text,
  add column if not exists subgenres    jsonb,
  add column if not exists publisher    text,
  add column if not exists release_year int,
  add column if not exists featured_rank int;  -- 1-50 for the curated top-50 list

-- fuzzy-match support for /api/suggest as the table grows
create extension if not exists pg_trgm;
create index if not exists games_name_trgm on games using gin (name gin_trgm_ops);
