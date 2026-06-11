-- Make the (workspace_id, airtable_id) unique indexes non-partial so they can be
-- used as ON CONFLICT arbiters by the sync upserts. NULL airtable_ids are still
-- allowed many-per-workspace (NULLs are distinct in a unique index).
drop index public.profiles_ws_airtable_idx;
create unique index profiles_ws_airtable_idx on public.profiles (workspace_id, airtable_id);

do $$
declare t text;
begin
  foreach t in array array['objectives','key_results','epics','stories']
  loop
    execute format('drop index public.%I_ws_airtable_idx', t);
    execute format('create unique index %I_ws_airtable_idx on public.%I (workspace_id, airtable_id)', t, t);
  end loop;
end $$;
