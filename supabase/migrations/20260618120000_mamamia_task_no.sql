-- Use Mamamia's own task number as the primary human-facing ref.
-- Airtable Tasks expose a "Record ID" autoNumber (e.g. 1041); Mamamia shows it
-- as "Task ID" = 't-1041'. We store the number and render 't-<n>', falling back
-- to the local NS-<ref> identity for tasks created natively in Northstar.
alter table public.stories add column if not exists mamamia_no integer;

create index if not exists stories_workspace_mamamia_no_idx
  on public.stories (workspace_id, mamamia_no);
