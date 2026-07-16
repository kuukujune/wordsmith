create extension if not exists pgcrypto;

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  normalized_text text not null,
  text text not null,
  type text not null default 'word',
  definition text,
  example text,
  source text,
  language text not null default 'en',
  created_at timestamptz not null default now(),
  unique (normalized_text, type, language)
);

create table if not exists public.relations (
  id uuid primary key default gen_random_uuid(),
  graph_center_entry_id uuid references public.entries(id) on delete cascade,
  from_entry_id uuid not null references public.entries(id) on delete cascade,
  to_entry_id uuid not null references public.entries(id) on delete cascade,
  relation_type text not null,
  strength integer,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (graph_center_entry_id, from_entry_id, to_entry_id, relation_type)
);

create table if not exists public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  entry_id uuid references public.entries(id) on delete cascade,
  folder_name text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_webs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  title text not null,
  center_entry_id uuid references public.entries(id) on delete cascade,
  settings_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  message text not null,
  page text,
  created_at timestamptz not null default now()
);

alter table public.entries enable row level security;
alter table public.relations enable row level security;
alter table public.saved_items enable row level security;
alter table public.saved_webs enable row level security;
alter table public.feedback enable row level security;

create policy "entries are readable"
on public.entries for select
using (true);

create policy "relations are readable"
on public.relations for select
using (true);

create policy "feedback can be inserted"
on public.feedback for insert
with check (true);
