-- Run this in the Supabase project's SQL Editor (Supabase dashboard →
-- SQL Editor → New query), not BigQuery -- this table lives in Supabase
-- Postgres, the same place auth already lives, because it needs to persist
-- across Vercel's read-only/ephemeral serverless filesystem, which local
-- .credentials/*.json files cannot (confirmed: ENOENT on Vercel in
-- production trying to write there).
--
-- RLS is enabled with NO policies -- meaning only the service_role key
-- (server-only, never sent to the browser) can read or write this table.
-- The anon key used everywhere else in the app cannot touch it at all,
-- which is the correct default for a table that stores API credentials.
create table if not exists app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_config enable row level security;

-- Creating the table doesn't automatically grant the service_role Postgres
-- role privileges on it (confirmed live: a real 403 "permission denied for
-- table app_config", code 42501, from the service-role key itself) --
-- table-level GRANTs and RLS are two separate layers. This is the missing
-- layer; RLS above already restricts everyone else.
grant usage on schema public to service_role;
grant all on public.app_config to service_role;
