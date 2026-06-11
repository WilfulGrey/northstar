-- =====================================================================
-- Northstar v1.6 — server-side Airtable connection (per workspace)
--
-- The integration is connected ONCE for the whole workspace: the token lives
-- server-side in workspace_integrations, a table with RLS enabled and NO
-- policies, so only the service_role (edge functions / scheduled job) can read
-- it — never the browser, never other members. Clients see only non-secret
-- connection status on the workspaces row.
-- =====================================================================

create table public.workspace_integrations (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  provider     text not null default 'airtable',
  token        text not null,
  base_id      text not null,
  enabled      boolean not null default true,
  last_sync_at timestamptz,
  last_error   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- RLS on, zero policies → authenticated clients cannot touch it; service_role bypasses.
alter table public.workspace_integrations enable row level security;

-- Non-secret connection status that the UI can read.
-- (airtable_base_id + last_sync_at already exist on workspaces from v1.5.)
alter table public.workspaces add column if not exists airtable_connected boolean not null default false;
