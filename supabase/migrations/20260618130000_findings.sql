-- Findings = bugs & observations from the AI chatbot, imported from Airtable's
-- "Findings" table. They live in the stories table with kind='finding' so they
-- reuse the drawer, comments and attachments machinery; the kind flag keeps them
-- out of the task board, My Work, dashboard metrics and the command palette.
alter table public.stories add column if not exists kind text not null default 'task';
create index if not exists stories_workspace_kind_idx on public.stories (workspace_id, kind);

-- Airtable hosts finding images on expiring URLs, so the sync re-hosts them into
-- the attachments bucket. Track the source Airtable attachment id to keep the
-- backfill idempotent (one stored copy per Airtable attachment).
alter table public.attachments add column if not exists source_airtable_id text;
create index if not exists attachments_source_airtable_id_idx
  on public.attachments (workspace_id, source_airtable_id);
