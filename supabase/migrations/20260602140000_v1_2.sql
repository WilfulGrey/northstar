-- =====================================================================
-- Northstar v1.2 — progress check-ins
--
-- Weekly check-ins are the heartbeat of OKRs: a key result shouldn't be a
-- single "current" number, it should have a history and a confidence call.
-- This records that history; updating a KR's value during a check-in writes
-- one row here so the trend is preserved.
-- =====================================================================

create type checkin_confidence as enum ('on_track', 'at_risk', 'off_track');

create table public.kr_checkins (
  id            uuid primary key default gen_random_uuid(),
  key_result_id uuid not null references public.key_results (id) on delete cascade,
  author_id     uuid references public.profiles (id) on delete set null,
  value         numeric not null,
  confidence    checkin_confidence not null default 'on_track',
  note          text,
  created_at    timestamptz not null default now()
);
create index on public.kr_checkins (key_result_id, created_at);

alter table public.kr_checkins enable row level security;

create policy "kr_checkins: read"       on public.kr_checkins for select to authenticated using (true);
create policy "kr_checkins: insert own" on public.kr_checkins for insert to authenticated with check (auth.uid() = author_id);
create policy "kr_checkins: update own" on public.kr_checkins for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "kr_checkins: delete own" on public.kr_checkins for delete to authenticated using (auth.uid() = author_id);

alter publication supabase_realtime add table public.kr_checkins;
