-- =====================================================================
-- Northstar v1.4 — Airtable sync foundations
--
-- Statuses become data, not enums. Tasks (the board) are the case that needs
-- ordered, manageable, colored columns, so stories.status is free text backed
-- by a task_statuses table; the Airtable sync upserts that table from the
-- source's Status options, so a new status in Airtable becomes a new board
-- column automatically. Epic / objective / key-result statuses become free
-- text too (stored 1:1 from Airtable, rendered dynamically).
--
-- Every synced row carries airtable_id so re-syncs upsert in place.
-- =====================================================================

-- ---------- task_statuses (drives the board) ----------
create table public.task_statuses (
  name       text primary key,                 -- the raw status label (1:1 with Airtable)
  position   double precision not null default 0,
  color      text,
  category   text not null default 'backlog',  -- semantic bucket: backlog|todo|in_progress|in_review|done|canceled
  created_at timestamptz not null default now()
);

-- Seed the existing demo statuses so the FK below is satisfied.
insert into public.task_statuses (name, position, category, color) values
  ('backlog',     0, 'backlog',     '#a1a1aa'),
  ('todo',        1, 'todo',        '#a1a1aa'),
  ('in_progress', 2, 'in_progress', '#f59e0b'),
  ('in_review',   3, 'in_review',   '#3b82f6'),
  ('done',        4, 'done',        '#10b981'),
  ('canceled',    5, 'canceled',    '#a1a1aa');

-- ---------- convert status columns enum -> text ----------
alter table public.stories    alter column status drop default;
alter table public.stories    alter column status type text using status::text;
alter table public.stories    alter column status set default 'backlog';

alter table public.epics      alter column status drop default;
alter table public.epics      alter column status type text using status::text;
alter table public.epics      alter column status set default 'backlog';

alter table public.objectives alter column status drop default;
alter table public.objectives alter column status type text using status::text;
alter table public.objectives alter column status set default 'on_track';

-- key results gain a status (Airtable has one; Northstar didn't)
alter table public.key_results add column status text;

-- Referential integrity for the board: a story's status must be a known status.
alter table public.stories
  add constraint stories_status_fkey
  foreign key (status) references public.task_statuses (name) on update cascade;

-- ---------- airtable_id for idempotent upserts ----------
alter table public.objectives  add column airtable_id text unique;
alter table public.key_results add column airtable_id text unique;
alter table public.epics       add column airtable_id text unique;
alter table public.stories     add column airtable_id text unique;

-- ---------- stop maintaining completed_at (unused; simplifies dynamic status) ----------
create or replace function public.handle_story_change()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- RLS: statuses readable by all, manageable by the team ----------
alter table public.task_statuses enable row level security;
create policy "task_statuses: read"  on public.task_statuses for select to authenticated using (true);
create policy "task_statuses: write" on public.task_statuses for all to authenticated using (true) with check (true);

-- ---------- realtime ----------
alter publication supabase_realtime add table public.task_statuses;
