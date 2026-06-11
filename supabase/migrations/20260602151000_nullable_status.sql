-- Airtable records may have no status — keep it 1:1 (null), don't invent one.
alter table public.stories    alter column status drop not null;
alter table public.epics      alter column status drop not null;
alter table public.objectives alter column status drop not null;
