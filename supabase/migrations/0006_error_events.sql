-- Migration 0006: server-side error capture.
-- Run in the Supabase SQL editor AFTER 0005.
--
-- Closes the "it froze for them but works for me" blind spot: when a score
-- request fails (rate limit, model outage, blocked/empty response), the server
-- records WHAT the user typed and WHY it failed, so a report like sandiago's is
-- diagnosable instead of a mystery. Written only by the service-role server.

create table error_events (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  stage      text not null,        -- where it failed, e.g. 'score:error', 'score:busy'
  input      text,                 -- the user's raw query, e.g. "sekiro"
  detail     text,                 -- the error message / model finishReason
  meta       jsonb,                -- model, http code, error name, etc.
  resolved   boolean default false -- flip to true once triaged
);

-- RLS ON with NO policies: only the service role (server + the Supabase
-- dashboard) can read or write. The anon/auth browser clients can never see
-- error contents.
alter table error_events enable row level security;

create index error_events_created_idx on error_events (created_at desc);
create index error_events_stage_idx on error_events (stage);
