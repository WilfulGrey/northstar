-- =====================================================================
-- Northstar v1.1
--   1. Epic → Key Result: precise alignment ("which work moves which metric")
--   2. Comments on stories: the team actually talks where the work lives
--   3. Activity log: auto-recorded, server-side, can't be bypassed
-- =====================================================================

-- ---------- 1. Epic → Key Result ----------
alter table public.epics
  add column key_result_id uuid references public.key_results (id) on delete set null;
create index on public.epics (key_result_id);

-- ---------- 2. Comments ----------
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references public.stories (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now()
);
create index on public.comments (story_id, created_at);

-- ---------- 3. Activity ----------
create type activity_type as enum (
  'created', 'status_changed', 'assignee_changed', 'priority_changed', 'epic_changed'
);

create table public.activity (
  id         uuid primary key default gen_random_uuid(),
  story_id   uuid not null references public.stories (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  type       activity_type not null,
  from_value text,
  to_value   text,
  created_at timestamptz not null default now()
);
create index on public.activity (story_id, created_at);

-- Record activity automatically. actor = the authenticated caller (null for the
-- service-role seed). SECURITY DEFINER so it can write to the RLS-protected table.
create or replace function public.log_story_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.activity (story_id, actor_id, type, to_value)
    values (new.id, actor, 'created', new.status::text);
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into public.activity (story_id, actor_id, type, from_value, to_value)
      values (new.id, actor, 'status_changed', old.status::text, new.status::text);
    end if;
    if new.assignee_id is distinct from old.assignee_id then
      insert into public.activity (story_id, actor_id, type, from_value, to_value)
      values (new.id, actor, 'assignee_changed', old.assignee_id::text, new.assignee_id::text);
    end if;
    if new.priority is distinct from old.priority then
      insert into public.activity (story_id, actor_id, type, from_value, to_value)
      values (new.id, actor, 'priority_changed', old.priority::text, new.priority::text);
    end if;
    if new.epic_id is distinct from old.epic_id then
      insert into public.activity (story_id, actor_id, type, from_value, to_value)
      values (new.id, actor, 'epic_changed', old.epic_id::text, new.epic_id::text);
    end if;
  end if;
  return null;
end;
$$;

create trigger trg_story_activity
  after insert or update on public.stories
  for each row execute function public.log_story_activity();

-- ---------- RLS ----------
alter table public.comments enable row level security;
alter table public.activity enable row level security;

-- Comments: everyone reads; you write/edit/remove your own.
create policy "comments: read"        on public.comments for select to authenticated using (true);
create policy "comments: insert own"  on public.comments for insert to authenticated with check (auth.uid() = author_id);
create policy "comments: update own"  on public.comments for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "comments: delete own"  on public.comments for delete to authenticated using (auth.uid() = author_id);

-- Activity: read-only for users; rows are written only by the SECURITY DEFINER trigger.
create policy "activity: read" on public.activity for select to authenticated using (true);

-- ---------- Realtime ----------
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.activity;
