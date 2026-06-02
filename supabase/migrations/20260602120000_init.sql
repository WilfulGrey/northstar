-- =====================================================================
-- Northstar — initial schema
--
-- The product thesis: a small product team should be able to trace any
-- piece of work back to a business goal. So strategy and execution live
-- in one model:
--
--   Objective ─< Key Result          (the "why" — measurable outcomes)
--       ^
--       │ (epic.objective_id)         <- the bridge
--       │
--      Epic ─< Story                  (the "what" — shippable work)
--
-- A Story may also point straight at a Key Result for fine-grained
-- traceability. Everything lives in a single shared workspace, which is
-- the right granularity for a small team.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Enums ----------
create type objective_status as enum ('on_track', 'at_risk', 'off_track', 'achieved', 'missed');
create type kr_metric        as enum ('number', 'percent', 'currency', 'boolean');
create type epic_status       as enum ('backlog', 'planned', 'in_progress', 'completed', 'canceled');
create type story_status      as enum ('backlog', 'todo', 'in_progress', 'in_review', 'done', 'canceled');
create type story_priority    as enum ('none', 'urgent', 'high', 'medium', 'low');

-- ---------- Shared helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles (1:1 with auth.users) ----------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  full_name    text,
  avatar_color text not null default '#6366f1',
  created_at   timestamptz not null default now()
);

-- Auto-provision a profile whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- cycles (time-boxes for OKRs, e.g. quarters) ----------
create table public.cycles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  starts_on  date not null,
  ends_on    date not null,
  created_at timestamptz not null default now()
);

-- ---------- objectives (the "O") ----------
create table public.objectives (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  cycle_id    uuid references public.cycles (id) on delete set null,
  owner_id    uuid references public.profiles (id) on delete set null,
  status      objective_status not null default 'on_track',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_objectives_updated before update on public.objectives
  for each row execute function public.set_updated_at();

-- ---------- key_results (the "KR") ----------
create table public.key_results (
  id            uuid primary key default gen_random_uuid(),
  objective_id  uuid not null references public.objectives (id) on delete cascade,
  title         text not null,
  metric        kr_metric not null default 'percent',
  start_value   numeric not null default 0,
  target_value  numeric not null default 100,
  current_value numeric not null default 0,
  unit          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.key_results (objective_id);
create trigger trg_key_results_updated before update on public.key_results
  for each row execute function public.set_updated_at();

-- ---------- epics (large bodies of work, bridged to an objective) ----------
create table public.epics (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  status       epic_status not null default 'backlog',
  objective_id uuid references public.objectives (id) on delete set null,
  owner_id     uuid references public.profiles (id) on delete set null,
  color        text not null default '#6366f1',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.epics (objective_id);
create trigger trg_epics_updated before update on public.epics
  for each row execute function public.set_updated_at();

-- ---------- stories (user stories / issues — the unit of work) ----------
create table public.stories (
  id            uuid primary key default gen_random_uuid(),
  ref           int generated always as identity, -- human-friendly number (NS-12)
  title         text not null,
  description   text,
  status        story_status not null default 'backlog',
  priority      story_priority not null default 'none',
  estimate      int,                              -- story points
  epic_id       uuid references public.epics (id) on delete set null,
  key_result_id uuid references public.key_results (id) on delete set null,
  assignee_id   uuid references public.profiles (id) on delete set null,
  position      double precision not null default extract(epoch from now()),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index on public.stories (status);
create index on public.stories (epic_id);
create index on public.stories (assignee_id);
create index on public.stories (key_result_id);

-- Keep updated_at fresh and stamp completed_at when a story is finished.
create or replace function public.handle_story_change()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at = coalesce(new.completed_at, now());
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;
create trigger trg_stories_change before insert or update on public.stories
  for each row execute function public.handle_story_change();

-- =====================================================================
-- Row Level Security
--
-- One shared workspace: any authenticated team member can read and write
-- all planning data. profiles are world-readable (to render avatars and
-- assignees) but each user may only edit their own profile row.
-- The service_role key used by the seed script bypasses RLS entirely.
-- =====================================================================
alter table public.profiles    enable row level security;
alter table public.cycles      enable row level security;
alter table public.objectives  enable row level security;
alter table public.key_results enable row level security;
alter table public.epics       enable row level security;
alter table public.stories     enable row level security;

create policy "profiles: read all"     on public.profiles for select to authenticated using (true);
create policy "profiles: insert own"   on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles: update own"   on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "cycles: all"      on public.cycles      for all to authenticated using (true) with check (true);
create policy "objectives: all"  on public.objectives  for all to authenticated using (true) with check (true);
create policy "key_results: all" on public.key_results for all to authenticated using (true) with check (true);
create policy "epics: all"       on public.epics       for all to authenticated using (true) with check (true);
create policy "stories: all"     on public.stories     for all to authenticated using (true) with check (true);

-- =====================================================================
-- Realtime — let the board and dashboards update live across the team.
-- =====================================================================
alter publication supabase_realtime add table public.objectives;
alter publication supabase_realtime add table public.key_results;
alter publication supabase_realtime add table public.epics;
alter publication supabase_realtime add table public.stories;
