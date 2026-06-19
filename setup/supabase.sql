-- ============================================================
-- Tribute Portal — database setup for a FREE Supabase project
-- Run this once in:  Supabase dashboard → SQL Editor → New query → paste → Run
-- ============================================================

-- 1) The praise wall (public, shown to everyone)
create table if not exists public.tribute_praises (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text,
  message     text not null,
  created_at  timestamptz not null default now()
);

-- 2) Private messages to Dr. Jana (NOT shown publicly)
create table if not exists public.tribute_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  message     text not null,
  created_at  timestamptz not null default now()
);

-- ---- Row Level Security ----
alter table public.tribute_praises  enable row level security;
alter table public.tribute_messages enable row level security;

-- Anyone may READ the praise wall
drop policy if exists "praises readable by all" on public.tribute_praises;
create policy "praises readable by all"
  on public.tribute_praises for select
  to anon using (true);

-- Anyone may ADD a praise (with light length guards)
drop policy if exists "anyone can add a praise" on public.tribute_praises;
create policy "anyone can add a praise"
  on public.tribute_praises for insert
  to anon with check (
    char_length(name) between 1 and 80
    and char_length(message) between 1 and 1200
    and (role is null or char_length(role) <= 120)
  );

-- Anyone may SEND a private message, but NOBODY can read them via the public key.
-- (Read them yourself in the Supabase dashboard → Table editor → tribute_messages)
drop policy if exists "anyone can send a message" on public.tribute_messages;
create policy "anyone can send a message"
  on public.tribute_messages for insert
  to anon with check (
    char_length(name) between 1 and 80
    and char_length(message) between 1 and 4000
  );

-- newest first, fast
create index if not exists tribute_praises_created_idx
  on public.tribute_praises (created_at desc);
