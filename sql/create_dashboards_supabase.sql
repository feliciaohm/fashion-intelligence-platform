-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/hkfghdjjatsjthqkejob/sql/new
--
-- Real, saved, named dashboards -- the "export from AI Search" feature.
-- Unlike app_config (service-role-only, app-wide settings), these are real
-- per-user documents: RLS is scoped to auth.uid() via the session-based
-- Supabase client (lib/supabase/server.ts), the same one every other
-- authenticated route already uses -- not the service-role client.
create table if not exists dashboards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One block = one real, already-computed result exported from somewhere in
-- the platform (an AI Search answer today; other pages could export into
-- this same table later). `stats` stores the real label/value pairs
-- exactly as computed -- never re-derived or estimated at render time.
-- `source_question` and `computed_at` keep it honest about where the
-- numbers came from and how fresh they are.
create table if not exists dashboard_blocks (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references dashboards(id) on delete cascade,
  title text not null,
  source_question text,
  stats jsonb not null,
  position int not null default 0,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table dashboards enable row level security;
alter table dashboard_blocks enable row level security;

create policy "Owners can manage their own dashboards"
  on dashboards for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Owners can manage blocks on their own dashboards"
  on dashboard_blocks for all
  using (exists (select 1 from dashboards d where d.id = dashboard_blocks.dashboard_id and d.owner_id = auth.uid()))
  with check (exists (select 1 from dashboards d where d.id = dashboard_blocks.dashboard_id and d.owner_id = auth.uid()));
