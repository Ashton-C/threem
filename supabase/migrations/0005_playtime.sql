-- Migration 0005: per-user playtime, so the style profile can weight by
-- hours actually played instead of mere ownership.
-- Run in the Supabase SQL editor AFTER 0004.
--
-- NULL = unknown (manually-added games). 0 = owned-but-never-played
-- (Steam reports it). The aggregation treats these differently.

alter table user_games add column if not exists playtime_minutes int;
