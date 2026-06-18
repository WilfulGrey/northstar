-- =====================================================================
-- Attachments — images & files on tasks and comments.
--
-- Files live in a private Storage bucket under {workspace_id}/... ; access is
-- gated by the same workspace membership as everything else. The attachments
-- table holds the metadata (which task / comment, original name, type, size).
-- =====================================================================

-- Private bucket, 25 MB/file cap, any mime type.
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400)
on conflict (id) do nothing;

-- Storage RLS: a member may touch objects whose first path segment is their workspace.
create policy "attachments: ws read" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = public.current_workspace()::text);
create policy "attachments: ws insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = public.current_workspace()::text);
create policy "attachments: ws delete" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = public.current_workspace()::text);

-- ---------- metadata ----------
create table public.attachments (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade default public.current_workspace(),
  story_id     uuid references public.stories (id) on delete cascade,
  comment_id   uuid references public.comments (id) on delete cascade,
  uploaded_by  uuid references public.profiles (id) on delete set null,
  path         text not null,
  file_name    text not null,
  mime_type    text,
  size_bytes   bigint,
  created_at   timestamptz not null default now()
);
create index on public.attachments (story_id);
create index on public.attachments (comment_id);

alter table public.attachments enable row level security;
create policy "attachments ws read"   on public.attachments for select to authenticated using (workspace_id = public.current_workspace());
create policy "attachments ws insert" on public.attachments for insert to authenticated with check (workspace_id = public.current_workspace());
create policy "attachments ws delete" on public.attachments for delete to authenticated using (workspace_id = public.current_workspace());

alter publication supabase_realtime add table public.attachments;
