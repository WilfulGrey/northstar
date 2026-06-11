-- =====================================================================
-- Northstar v1.5 — workspaces (multi-tenant)
--
-- Each account belongs to a workspace; all planning data is scoped to it.
-- This isolates the demo from real data, lets a fresh account start empty,
-- and means the connector pulls into the caller's own workspace.
--
-- "profiles" stops being 1:1 with auth.users. It is now "people in a
-- workspace": some are linked to an auth user (auth_user_id, they can log in),
-- others are synced contacts from Airtable Team (no login). assignee/owner
-- columns already reference profiles.id, so they keep working.
-- =====================================================================

create table public.workspaces (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  airtable_base_id text,
  last_sync_at     timestamptz,
  created_at       timestamptz not null default now()
);
alter table public.workspaces enable row level security;

-- ---------- profiles → workspace people ----------
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

alter table public.profiles drop constraint profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();
alter table public.profiles add column auth_user_id uuid references auth.users (id) on delete set null;
alter table public.profiles add column workspace_id uuid references public.workspaces (id) on delete cascade;
alter table public.profiles add column airtable_id text;
create unique index profiles_auth_user_idx on public.profiles (auth_user_id) where auth_user_id is not null;
create unique index profiles_ws_airtable_idx on public.profiles (workspace_id, airtable_id) where airtable_id is not null;

-- ---------- helpers (security definer: resolve the caller's workspace) ----------
create or replace function public.current_workspace() returns uuid
  language sql stable security definer set search_path = public as $$
  select workspace_id from public.profiles where auth_user_id = auth.uid() limit 1
$$;
create or replace function public.current_profile() returns uuid
  language sql stable security definer set search_path = public as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1
$$;

-- ---------- workspace_id on every data table; default to the caller's workspace ----------
do $$
declare t text;
begin
  foreach t in array array['cycles','objectives','key_results','epics','stories','comments','kr_checkins','activity','task_statuses']
  loop
    execute format('alter table public.%I add column workspace_id uuid references public.workspaces(id) on delete cascade', t);
  end loop;
  -- App-created rows inherit the caller's workspace automatically.
  foreach t in array array['objectives','key_results','epics','stories','comments','kr_checkins']
  loop
    execute format('alter table public.%I alter column workspace_id set default public.current_workspace()', t);
  end loop;
end $$;

-- ---------- task_statuses become per-workspace ----------
alter table public.stories drop constraint stories_status_fkey;
delete from public.task_statuses; -- reseeded per workspace
alter table public.task_statuses drop constraint task_statuses_pkey;
alter table public.task_statuses add primary key (workspace_id, name);
alter table public.stories
  add constraint stories_status_fkey
  foreign key (workspace_id, status) references public.task_statuses (workspace_id, name) on update cascade;

-- ---------- airtable_id uniqueness scoped per workspace ----------
do $$
declare t text;
begin
  foreach t in array array['objectives','key_results','epics','stories']
  loop
    execute format('alter table public.%I drop constraint %I_airtable_id_key', t, t);
    execute format('create unique index %I_ws_airtable_idx on public.%I (workspace_id, airtable_id) where airtable_id is not null', t, t);
  end loop;
end $$;

-- ---------- activity trigger: actor = caller's profile; inherit workspace ----------
create or replace function public.log_story_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor uuid := public.current_profile();
begin
  if tg_op = 'INSERT' then
    insert into public.activity (story_id, actor_id, type, to_value, workspace_id)
    values (new.id, actor, 'created', new.status, new.workspace_id);
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      insert into public.activity (story_id, actor_id, type, from_value, to_value, workspace_id)
      values (new.id, actor, 'status_changed', old.status, new.status, new.workspace_id);
    end if;
    if new.assignee_id is distinct from old.assignee_id then
      insert into public.activity (story_id, actor_id, type, from_value, to_value, workspace_id)
      values (new.id, actor, 'assignee_changed', old.assignee_id::text, new.assignee_id::text, new.workspace_id);
    end if;
    if new.priority is distinct from old.priority then
      insert into public.activity (story_id, actor_id, type, from_value, to_value, workspace_id)
      values (new.id, actor, 'priority_changed', old.priority::text, new.priority::text, new.workspace_id);
    end if;
    if new.epic_id is distinct from old.epic_id then
      insert into public.activity (story_id, actor_id, type, from_value, to_value, workspace_id)
      values (new.id, actor, 'epic_changed', old.epic_id::text, new.epic_id::text, new.workspace_id);
    end if;
  end if;
  return null;
end;
$$;

-- =====================================================================
-- RLS — everything is scoped to the caller's workspace.
-- =====================================================================
drop policy "profiles: read all"   on public.profiles;
drop policy "profiles: insert own" on public.profiles;
drop policy "profiles: update own" on public.profiles;
create policy "profiles ws read"   on public.profiles for select to authenticated using (workspace_id = public.current_workspace());
create policy "profiles self upd"  on public.profiles for update to authenticated using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

drop policy "cycles: all"      on public.cycles;
drop policy "objectives: all"  on public.objectives;
drop policy "key_results: all" on public.key_results;
drop policy "epics: all"       on public.epics;
drop policy "stories: all"     on public.stories;
create policy "cycles ws"      on public.cycles      for all to authenticated using (workspace_id = public.current_workspace()) with check (workspace_id = public.current_workspace());
create policy "objectives ws"  on public.objectives  for all to authenticated using (workspace_id = public.current_workspace()) with check (workspace_id = public.current_workspace());
create policy "key_results ws" on public.key_results for all to authenticated using (workspace_id = public.current_workspace()) with check (workspace_id = public.current_workspace());
create policy "epics ws"       on public.epics       for all to authenticated using (workspace_id = public.current_workspace()) with check (workspace_id = public.current_workspace());
create policy "stories ws"     on public.stories     for all to authenticated using (workspace_id = public.current_workspace()) with check (workspace_id = public.current_workspace());

drop policy "comments: read"       on public.comments;
drop policy "comments: insert own" on public.comments;
drop policy "comments: update own" on public.comments;
drop policy "comments: delete own" on public.comments;
create policy "comments ws read"   on public.comments for select to authenticated using (workspace_id = public.current_workspace());
create policy "comments ws insert" on public.comments for insert to authenticated with check (workspace_id = public.current_workspace() and author_id = public.current_profile());
create policy "comments own upd"   on public.comments for update to authenticated using (author_id = public.current_profile()) with check (author_id = public.current_profile());
create policy "comments own del"   on public.comments for delete to authenticated using (author_id = public.current_profile());

drop policy "activity: read"     on public.activity;
create policy "activity ws read" on public.activity for select to authenticated using (workspace_id = public.current_workspace());

drop policy "kr_checkins: read"       on public.kr_checkins;
drop policy "kr_checkins: insert own" on public.kr_checkins;
drop policy "kr_checkins: update own" on public.kr_checkins;
drop policy "kr_checkins: delete own" on public.kr_checkins;
create policy "kr_checkins ws read"   on public.kr_checkins for select to authenticated using (workspace_id = public.current_workspace());
create policy "kr_checkins ws insert" on public.kr_checkins for insert to authenticated with check (workspace_id = public.current_workspace() and author_id = public.current_profile());
create policy "kr_checkins own upd"   on public.kr_checkins for update to authenticated using (author_id = public.current_profile()) with check (author_id = public.current_profile());
create policy "kr_checkins own del"   on public.kr_checkins for delete to authenticated using (author_id = public.current_profile());

drop policy "task_statuses: read"  on public.task_statuses;
drop policy "task_statuses: write" on public.task_statuses;
create policy "task_statuses ws read"  on public.task_statuses for select to authenticated using (workspace_id = public.current_workspace());
create policy "task_statuses ws write" on public.task_statuses for all to authenticated using (workspace_id = public.current_workspace()) with check (workspace_id = public.current_workspace());

create policy "workspaces read" on public.workspaces for select to authenticated using (id = public.current_workspace());

alter publication supabase_realtime add table public.workspaces;
