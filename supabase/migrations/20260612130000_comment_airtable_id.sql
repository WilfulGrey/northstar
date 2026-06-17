-- Let the Airtable sync import comments idempotently.
alter table public.comments add column airtable_id text;
create unique index comments_ws_airtable_idx on public.comments (workspace_id, airtable_id);
