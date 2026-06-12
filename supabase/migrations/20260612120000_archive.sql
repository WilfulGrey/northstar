-- =====================================================================
-- Archiving — hide things you no longer want to see without deleting them.
--
-- archived_at is a nullable timestamp on each planning entity (null = active).
-- The Airtable sync upserts named columns only, so it never touches archived_at
-- — archiving survives re-syncs. Tasks INHERIT their epic's archived state
-- (derived in the app), so archiving an epic hides its tasks too, with no
-- cascade writes to undo on unarchive.
-- =====================================================================

alter table public.objectives  add column archived_at timestamptz;
alter table public.key_results add column archived_at timestamptz;
alter table public.epics       add column archived_at timestamptz;
alter table public.stories     add column archived_at timestamptz;

create index on public.epics (archived_at);
create index on public.stories (archived_at);
