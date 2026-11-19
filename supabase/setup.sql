-- Run once in the Supabase SQL editor (free tier is fine).
-- The whole prototype state is one JSON row per "room"; writes use compare-and-swap on `version`.
create table if not exists public.gb_state (
  id text primary key,
  data jsonb not null,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.gb_state replica identity full;
alter table public.gb_state enable row level security;

-- Prototype only: anyone with the anon key can read and write. Do not reuse for real data.
drop policy if exists "prototype open access" on public.gb_state;
create policy "prototype open access" on public.gb_state
  for all to anon using (true) with check (true);

-- Push row changes to every phone in real time.
alter publication supabase_realtime add table public.gb_state;
