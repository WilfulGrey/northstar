// Seed the Northstar workspace with a realistic small-team scenario.
//
// Uses the service_role key (bypasses RLS). Idempotent: re-running wipes the
// planning data and recreates it, and reuses existing auth users.
//
// Run:  node --env-file=.env.local scripts/seed.mjs

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}

const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

const PASSWORD = 'northstar2026'
const TEAM = [
  { key: 'demo', email: 'demo@northstar.app', name: 'Demo User', color: '#6366f1' },
  { key: 'maya', email: 'maya@northstar.app', name: 'Maya Chen', color: '#ec4899' },
  { key: 'leo', email: 'leo@northstar.app', name: 'Leo Martins', color: '#0ea5e9' },
  { key: 'sofia', email: 'sofia@northstar.app', name: 'Sofia Alvarez', color: '#10b981' },
]

async function ensureUser({ email, name }) {
  // Look for an existing user (small team — one page is plenty).
  const { data: list, error: listErr } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listErr) throw listErr
  const existing = list.users.find((u) => u.email === email)
  if (existing) return existing.id

  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name },
  })
  if (error) throw error
  return data.user.id
}

async function wipe() {
  // FK-safe order; profiles & auth users are preserved.
  for (const table of ['stories', 'epics', 'key_results', 'objectives', 'cycles']) {
    const { error } = await db.from(table).delete().not('id', 'is', null)
    if (error) throw new Error(`wipe ${table}: ${error.message}`)
  }
}

async function insert(table, rows) {
  const { data, error } = await db.from(table).insert(rows).select()
  if (error) throw new Error(`insert ${table}: ${error.message}`)
  return data
}

async function main() {
  console.log('→ ensuring team users…')
  const ids = {}
  for (const m of TEAM) {
    ids[m.key] = await ensureUser(m)
    const { error } = await db.from('profiles').upsert({
      id: ids[m.key],
      email: m.email,
      full_name: m.name,
      avatar_color: m.color,
    })
    if (error) throw new Error(`profile ${m.email}: ${error.message}`)
  }
  console.log(`  ${TEAM.length} users ready.`)

  // Remove throwaway accounts created by the invite e2e test.
  const { data: all } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const teamEmails = new Set(TEAM.map((m) => m.email))
  let removed = 0
  for (const u of all.users) {
    if (u.email && u.email.startsWith('e2e-invite-') && !teamEmails.has(u.email)) {
      await db.auth.admin.deleteUser(u.id)
      removed++
    }
  }
  if (removed) console.log(`  removed ${removed} throwaway invite account(s).`)

  console.log('→ wiping existing planning data…')
  await wipe()

  console.log('→ creating cycle, objectives, key results…')
  const [cycle] = await insert('cycles', [
    { name: 'Q2 2026', starts_on: '2026-04-01', ends_on: '2026-06-30' },
  ])

  const objectiveDefs = [
    { key: 'daily', title: "Make Northstar the team's daily driver", owner: 'demo', status: 'on_track',
      description: 'Teams should reach for Northstar first thing every morning.' },
    { key: 'platform', title: 'Ship a rock-solid v1 platform', owner: 'leo', status: 'at_risk',
      description: 'Reliability and performance worthy of daily, team-wide use.' },
    { key: 'delight', title: 'Make the product feel instant & delightful', owner: 'maya', status: 'on_track',
      description: 'Every core interaction should feel fast and obvious.' },
  ]
  const objectives = await insert(
    'objectives',
    objectiveDefs.map((o) => ({
      title: o.title, description: o.description, status: o.status,
      owner_id: ids[o.owner], cycle_id: cycle.id,
    })),
  )
  const objId = Object.fromEntries(objectiveDefs.map((o, i) => [o.key, objectives[i].id]))

  const krDefs = [
    { key: 'wat', obj: 'daily', title: 'Weekly active teams', metric: 'number', unit: 'teams', start: 4, current: 14, target: 25 },
    { key: 'activation', obj: 'daily', title: 'Activation rate (signup → first story)', metric: 'percent', start: 20, current: 41, target: 60 },
    { key: 'incidents', obj: 'platform', title: 'P0 incidents per month', metric: 'number', unit: 'incidents', start: 12, current: 5, target: 0 },
    { key: 'latency', obj: 'platform', title: 'API p95 latency', metric: 'number', unit: 'ms', start: 800, current: 450, target: 200 },
    { key: 'ttc', obj: 'delight', title: 'Median time to create a story', metric: 'number', unit: 'sec', start: 25, current: 14, target: 8 },
    { key: 'nps', obj: 'delight', title: 'Team NPS', metric: 'number', start: 30, current: 38, target: 50 },
  ]
  const krs = await insert(
    'key_results',
    krDefs.map((k) => ({
      objective_id: objId[k.obj], title: k.title, metric: k.metric, unit: k.unit ?? null,
      start_value: k.start, current_value: k.current, target_value: k.target,
    })),
  )
  const krId = Object.fromEntries(krDefs.map((k, i) => [k.key, krs[i].id]))

  console.log('→ adding KR check-ins (progress history)…')
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()
  const checkinDefs = [
    ['activation', 'maya', 25, 'on_track', 'Onboarding checklist live for ~half of new signups.', 21],
    ['activation', 'maya', 33, 'on_track', 'Sample workspace pushed activation up again.', 14],
    ['activation', 'demo', 41, 'at_risk', 'Plateauing a bit — the invite flow is the next lever.', 7],
    ['incidents', 'leo', 9, 'on_track', 'Sentry in place, working through the long tail.', 18],
    ['incidents', 'leo', 7, 'on_track', 'Fixed two recurring crashers.', 11],
    ['incidents', 'leo', 5, 'at_risk', 'Uptime alerts surfaced a flaky dependency.', 4],
    ['wat', 'demo', 8, 'on_track', 'Two design partners onboarded.', 20],
    ['wat', 'leo', 11, 'on_track', 'Word of mouth after the realtime demo.', 10],
    ['wat', 'demo', 14, 'on_track', 'Steady growth — retention is the next focus.', 3],
  ]
  await insert(
    'kr_checkins',
    checkinDefs.map(([kr, who, value, confidence, note, d]) => ({
      key_result_id: krId[kr], author_id: ids[who], value, confidence, note, created_at: daysAgo(d),
    })),
  )

  console.log('→ creating epics…')
  const epicDefs = [
    { key: 'onboarding', title: 'Onboarding & activation flow', obj: 'daily', kr: 'activation', owner: 'maya', status: 'in_progress', color: '#ec4899' },
    { key: 'realtime', title: 'Realtime collaboration', obj: 'daily', kr: 'wat', owner: 'leo', status: 'planned', color: '#6366f1' },
    { key: 'reliability', title: 'Reliability & observability', obj: 'platform', kr: 'incidents', owner: 'leo', status: 'in_progress', color: '#ef4444' },
    { key: 'perf', title: 'Performance pass', obj: 'platform', kr: 'latency', owner: 'leo', status: 'backlog', color: '#f59e0b' },
    { key: 'design', title: 'Design system & micro-interactions', obj: 'delight', kr: 'ttc', owner: 'maya', status: 'in_progress', color: '#8b5cf6' },
    { key: 'cmdk', title: 'Command palette & shortcuts', obj: 'delight', kr: 'ttc', owner: 'sofia', status: 'planned', color: '#0ea5e9' },
    { key: 'tooling', title: 'Internal tooling cleanup', obj: null, kr: null, owner: 'sofia', status: 'backlog', color: '#64748b' },
  ]
  const epics = await insert(
    'epics',
    epicDefs.map((e) => ({
      title: e.title, status: e.status, color: e.color,
      objective_id: e.obj ? objId[e.obj] : null,
      key_result_id: e.kr ? krId[e.kr] : null,
      owner_id: ids[e.owner],
    })),
  )
  const epicId = Object.fromEntries(epicDefs.map((e, i) => [e.key, epics[i].id]))

  console.log('→ creating stories…')
  const storyDefs = [
    // Onboarding & activation (aligned → daily)
    ['Design first-run welcome checklist', 'in_review', 'high', 3, 'onboarding', 'maya', 'activation'],
    ['Seed a sample workspace on signup', 'in_progress', 'high', 5, 'onboarding', 'maya', 'activation'],
    ['Empty states with guided CTAs', 'todo', 'medium', 2, 'onboarding', 'sofia', null],
    ['Invite teammates flow', 'backlog', 'medium', 3, 'onboarding', 'leo', null],
    ['Track activation funnel events', 'done', 'medium', 2, 'onboarding', 'leo', 'activation'],
    // Realtime (aligned → daily)
    ['Live board updates via Realtime', 'in_progress', 'high', 5, 'realtime', 'leo', 'wat'],
    ['Presence avatars on the board', 'backlog', 'low', 3, 'realtime', 'leo', null],
    // Reliability (aligned → platform)
    ['Add Sentry error tracking', 'done', 'high', 2, 'reliability', 'leo', 'incidents'],
    ['Health-check & uptime alerts', 'in_progress', 'urgent', 3, 'reliability', 'leo', 'incidents'],
    ['Postmortem template & on-call rota', 'todo', 'medium', 1, 'reliability', 'demo', null],
    // Performance (aligned → platform)
    ['Profile the slow dashboard query', 'todo', 'high', 3, 'perf', 'leo', 'latency'],
    ['Add DB indexes for hot paths', 'backlog', 'medium', 2, 'perf', 'leo', 'latency'],
    // Design (aligned → delight)
    ['Unify button & input components', 'done', 'medium', 3, 'design', 'maya', null],
    ['Optimistic UI on status change', 'in_progress', 'medium', 3, 'design', 'maya', 'ttc'],
    ['Keyboard focus & a11y pass', 'todo', 'low', 2, 'design', 'sofia', null],
    // Command palette (aligned → delight, all backlog)
    ['Cmd-K command palette', 'backlog', 'medium', 5, 'cmdk', 'sofia', 'ttc'],
    ['Quick-create story shortcut (C)', 'backlog', 'low', 2, 'cmdk', 'sofia', null],
    // Unaligned active work — surfaced on the dashboard
    ['Migrate legacy seed scripts', 'in_progress', 'low', 2, 'tooling', 'sofia', null],
    ['Clean up unused feature flags', 'todo', 'low', 1, 'tooling', 'demo', null],
    ['Spike: evaluate analytics vendors', 'todo', 'low', 2, null, 'demo', null],
  ]
  const insertedStories = await insert(
    'stories',
    storyDefs.map(([title, status, priority, estimate, epic, assignee, kr], i) => ({
      title, status, priority, estimate,
      epic_id: epic ? epicId[epic] : null,
      assignee_id: ids[assignee],
      key_result_id: kr ? krId[kr] : null,
      position: i,
    })),
  )
  const storyByTitle = Object.fromEntries(insertedStories.map((s) => [s.title, s.id]))

  console.log('→ adding a few comments…')
  const comments = [
    ['Health-check & uptime alerts', 'leo', 'Uptime checks are live and alerting to #oncall. Want a runbook link before we close this.'],
    ['Health-check & uptime alerts', 'demo', "Great. I'll fold the runbook into the postmortem template story."],
    ['Seed a sample workspace on signup', 'maya', 'Sample workspace lands on first login. Open question: do we wipe it once a real story is created?'],
  ]
  await insert(
    'comments',
    comments
      .filter(([title]) => storyByTitle[title])
      .map(([title, who, body]) => ({ story_id: storyByTitle[title], author_id: ids[who], body })),
  )

  console.log(`\n✓ Seed complete: ${objectiveDefs.length} objectives, ${krDefs.length} key results, ${checkinDefs.length} check-ins, ${epicDefs.length} epics, ${storyDefs.length} stories, ${comments.length} comments.`)
  console.log(`  Sign in as ${TEAM[0].email} / ${PASSWORD}`)
}

main().catch((err) => {
  console.error('\n✗ Seed failed:', err.message)
  process.exit(1)
})
