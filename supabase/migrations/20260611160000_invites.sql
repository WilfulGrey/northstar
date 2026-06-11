-- =====================================================================
-- Invite-by-link: one-time, expiring tokens. The admin generates a link and
-- shares it however they like; the invitee opens it, sets a password, and the
-- account (already in the workspace) becomes a real login.
--
-- RLS enabled with NO policies → only the service role (Edge Functions) can
-- read/write tokens, never the browser.
-- =====================================================================
create table public.invites (
  token        text primary key,
  email        text not null,
  auth_user_id uuid references auth.users (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  expires_at   timestamptz not null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.invites enable row level security;
