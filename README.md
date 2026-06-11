# Northstar

**OKRs meet execution for small product teams.**

🔗 **Live:** https://northstar-3s95.onrender.com — sign in with the demo button (`demo@northstar.app` / `northstar2026`)
📦 **Repo:** https://github.com/WilfulGrey/northstar

Most tools make you choose: Linear is brilliant for *execution* (epics, stories, a fast
board) but has no concept of *why*; spreadsheets and OKR tools track the *why* but live
miles away from the day-to-day work. For a small product team that gap is where focus
leaks away — people ship things that feel busy but don't move a goal.

Northstar puts both in one model and makes the link between them a first-class, visible
thing:

```
Objective ──< Key Result          strategy: the measurable outcomes that define success
    ▲
    │  epic.objective_id            the bridge
    │
   Epic ──< Story                  execution: the shippable work
```

A story can also point straight at a key result, so traceability runs all the way from
"a card on the board" to "the number we promised to move."

### The one feature that earns its place

The **alignment metric** on the dashboard: *of the work in flight right now, what % is
connected to an objective?* — and a list of the in-flight stories that aren't. That single
view answers the question a small team actually argues about on a Monday: *are we working
on the right things?*

## What's new in v1.1 — "close the loop"

1. **Comments + an automatic activity log on every story.** The team talks where the work
   lives. Activity (status/assignee/priority/epic changes) is recorded **by Postgres
   triggers**, so the history is server-side and can't be bypassed by the client.
2. **Precise alignment — link an epic (or story) to a specific key result.** The new
   *key-result detail* shows a **leading indicator** (how much of the work meant to move
   the metric is done) next to the measured result (lagging). Often the earliest signal a
   result is on or off track.
3. **Command palette (⌘K)** — search objectives/epics/stories and quick-create from
   anywhere. The keyboard-first UX a daily driver needs.

## What's new in v1.2 — "the whole telescope + the rhythm of progress"

1. **Key-result check-ins (progress history).** Weekly check-ins are the heartbeat of OKRs.
   A KR is no longer a single "current" number — each check-in records a **value, a
   confidence call (on track / at risk / off track) and a note**, so the key-result detail
   shows the trend and the story behind it. Updating the value during a check-in preserves
   history (table `kr_checkins`).
2. **Objective rollup view.** Click any objective to telescope from goal to ground in one
   screen: each KR (lagging + leading), the epics serving it, the contributing stories, and
   an **objective-level leading indicator** (work-done across everything that drives it).
3. **My Work.** A personal home: stories assigned to me grouped by status — with the same
   alignment flag, so I can see whether *my* week maps to a goal — plus the objectives I own.

## What's new in v1.3 — "see the trend, share the link, grow the team"

1. **Invite teammates — via a Supabase Edge Function.** Creating an account needs the
   `service_role` key, which must never reach the browser. So a Deno **Edge Function**
   (`supabase/functions/invite-member`, `verify_jwt` on) does it: only a signed-in member
   can call it, and it provisions the account server-side. This is the first piece of
   privileged server logic — the right tool once RLS isn't enough. New **Team** page.
2. **KR trend sparklines.** The check-in history is drawn as an inline sparkline on the OKR
   list and the key-result detail — the trend at a glance, no click required.
3. **Shareable story deep links.** `…/board?story=NS-42` opens a story directly; the drawer
   has a **Copy link** button and ⌘K story results land straight on the card.

## What's new in v1.4 — Airtable connector

The team's data lives in Airtable; this brings it in. An **Integrations** page runs a
one-click sync that pulls the whole **Objective → Key Result → Epic → Task** hierarchy and
upserts it by Airtable record id (idempotent — re-running is safe).

The interesting decision: **statuses are no longer enums, they're data.** Airtable's Tasks
have 16 workflow statuses; rather than collapse them, the sync writes them **1:1** into a
`task_statuses` table that *drives the board columns*. Add a status in Airtable and it
becomes a new column on the next sync — no code change. A semantic `category` on each status
(inferred at sync time, editable) is what alignment/progress still key off, so the board can
have 16 columns while "done" and "in flight" keep their meaning.

The Airtable token never touches the browser — the sync is a second **Edge Function**
(`supabase/functions/sync-airtable`, `verify_jwt` on) that holds the token as a Supabase
secret. Real run: **3 objectives, 10 key results, 71 epics, 1220 tasks in ~5s.**

## Product decisions (and what I deliberately left out)

- **One shared workspace, not multi-tenant.** A small team is the unit. RLS gives every
  authenticated member full read/write; no roles/permissions matrix for v1.
- **Accounts are provisioned, sign-in only.** Internal team tools invite known people;
  public self-serve sign-up (and the email-confirmation dance) wasn't worth the v1 surface.
- **Progress is computed, never stored.** Objective progress = mean of its key results;
  key-result progress handles "12 bugs → 0" the same as "0% → 60%"; epic progress = done
  stories / total. One source of truth.
- **Cut for now:** sprints/velocity, custom fields, saved filters, labels, attachments.
  All are natural next steps. (Comments/activity/⌘K shipped in v1.1; check-ins, rollups and
  My Work in v1.2; team invites, sparklines and deep links in v1.3 — see above.)

## Architecture

| Concern   | Choice | Why |
|-----------|--------|-----|
| Frontend  | **Vite + React + TypeScript** SPA | Fast, simple, no SSR needed |
| Data/Auth | **Supabase** (Postgres + Auth + RLS + Realtime) | Browser talks to the DB directly; RLS is the security boundary |
| Hosting   | **Render Static Site** | On the free tier a static site has **no cold starts** — a Node server spins down after 15 min and demos badly |
| State     | **TanStack Query** | Caching, loading/error states, and Realtime-driven invalidation |
| Server    | **Supabase Edge Functions** (Deno): team invites + Airtable sync | Keeps service-role / Airtable tokens off the client |
| Tests     | **Playwright** e2e against the live database | Proves the real path, not mocks |

Because the app is a static bundle hitting Supabase directly, **Row Level Security is the
entire backend authorization layer** — see `supabase/migrations`.

## Data model

`profiles` · `cycles` · `objectives` · `key_results` · `epics` · `stories` ·
`comments` · `activity` · `kr_checkins` · `task_statuses` — full schema, triggers, RLS
policies and the Realtime publication live in
[`supabase/migrations/`](supabase/migrations) (v1.0 → v1.4). Statuses are free text backed
by `task_statuses`; `stories`/`epics`/`objectives`/`key_results` carry an `airtable_id` for
idempotent sync.

## Run it locally

```bash
npm install
cp .env.example .env.local      # fill in your Supabase URL + anon key
npm run dev                     # http://localhost:5173
```

Seed a realistic team workspace (needs the service-role key in `.env.local`):

```bash
node --env-file=.env.local scripts/seed.mjs
```

End-to-end tests (auto-starts the dev server, runs against your Supabase project):

```bash
npm run test:e2e
```

## Deploy

Static site on Render, database on Supabase. The repo includes a
[`render.yaml`](render.yaml) blueprint. Set two environment variables on the Render
service:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Render runs `npm install && npm run build` and serves `dist/`. SPA deep links are handled
by the `/* → /index.html` rewrite. Every push to `main` triggers a deploy.

## Demo

```
demo@northstar.app / northstar2026
```

The login screen has a **“Try the demo workspace”** button that signs you straight in.

## Project layout

```
src/
  auth/         AuthProvider (Supabase session + profile)
  components/   Layout, Modal, Avatar, ProgressBar, badges, states
  lib/          supabase client, types, progress/alignment math, React Query hooks
  modals/       create/edit forms for objectives, key results, epics, stories
  pages/        Login, Dashboard, My Work, OKRs, Epics, Board, Team, Integrations
supabase/migrations/             Postgres schema + RLS
supabase/functions/invite-member Edge Function — privileged team invites
supabase/functions/sync-airtable Edge Function — Airtable → Northstar sync
scripts/seed.mjs                 idempotent demo seed
e2e/                             Playwright specs (16)
```
