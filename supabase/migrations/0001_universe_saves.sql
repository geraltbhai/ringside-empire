-- Ringside Empire: optional cloud saves.
-- Each row is one universe save slot (the full versioned JSON document).

create table if not exists public.universe_saves (
  user_id uuid not null references auth.users (id) on delete cascade,
  slot text not null,
  name text not null default '',
  week integer not null default 0,
  schema_version integer not null default 1,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot)
);

create index if not exists universe_saves_user_updated on public.universe_saves (user_id, updated_at desc);

alter table public.universe_saves enable row level security;

-- Players can only see and change their own saves.
create policy "own saves: select" on public.universe_saves for select using (auth.uid() = user_id);
create policy "own saves: insert" on public.universe_saves for insert with check (auth.uid() = user_id);
create policy "own saves: update" on public.universe_saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own saves: delete" on public.universe_saves for delete using (auth.uid() = user_id);

-- Keep saves to a sane size (the game's saves are typically 0.3–2 MB).
alter table public.universe_saves add constraint universe_saves_size check (pg_column_size(data) < 20000000);
