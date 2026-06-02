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

## Product decisions (and what I deliberately left out)

- **One shared workspace, not multi-tenant.** A small team is the unit. RLS gives every
  authenticated member full read/write; no roles/permissions matrix for v1.
- **Accounts are provisioned, sign-in only.** Internal team tools invite known people;
  public self-serve sign-up (and the email-confirmation dance) wasn't worth the v1 surface.
- **Progress is computed, never stored.** Objective progress = mean of its key results;
  key-result progress handles "12 bugs → 0" the same as "0% → 60%"; epic progress = done
  stories / total. One source of truth.
- **Cut for v1:** comments/activity feed, sprints/velocity, custom fields, saved filters,
  labels, attachments. All are natural next steps; none are needed to prove the thesis.

## Architecture

| Concern   | Choice | Why |
|-----------|--------|-----|
| Frontend  | **Vite + React + TypeScript** SPA | Fast, simple, no SSR needed |
| Data/Auth | **Supabase** (Postgres + Auth + RLS + Realtime) | Browser talks to the DB directly; RLS is the security boundary |
| Hosting   | **Render Static Site** | On the free tier a static site has **no cold starts** — a Node server spins down after 15 min and demos badly |
| State     | **TanStack Query** | Caching, loading/error states, and Realtime-driven invalidation |
| Tests     | **Playwright** e2e against the live database | Proves the real path, not mocks |

Because the app is a static bundle hitting Supabase directly, **Row Level Security is the
entire backend authorization layer** — see `supabase/migrations`.

## Data model

`profiles` · `cycles` · `objectives` · `key_results` · `epics` · `stories`
— full schema, enums, triggers, RLS policies and the Realtime publication live in
[`supabase/migrations/20260602120000_init.sql`](supabase/migrations/20260602120000_init.sql).

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
  pages/        Login, Dashboard (alignment), OKRs, Epics, Board
supabase/migrations/   Postgres schema + RLS
scripts/seed.mjs       idempotent demo seed
e2e/                   Playwright specs
```
