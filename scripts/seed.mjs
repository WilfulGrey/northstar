// Seed two workspaces:
//   • Demo     — a curated showcase (sign in: demo@northstar.app / northstar2026)
//   • Mamamia  — empty, populated only by the Airtable connector
//               (sign in: mamamia@northstar.app / mamamia2026)
//
// Uses the service_role key (bypasses RLS). Idempotent: wipes and recreates.
// Run:  node --env-file=.env.local scripts/seed.mjs

import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

const DEMO_PASSWORD = 'northstar2026'
const MAMAMIA_PASSWORD = 'mamamia2026'

const DEMO_PEOPLE = [
  { key: 'demo', email: 'demo@northstar.app', name: 'Demo User', color: '#6366f1', auth: true },
  { key: 'maya', email: 'maya@northstar.app', name: 'Maya Chen', color: '#ec4899', auth: false },
  { key: 'leo', email: 'leo@northstar.app', name: 'Leo Martins', color: '#0ea5e9', auth: false },
  { key: 'sofia', email: 'sofia@northstar.app', name: 'Sofia Alvarez', color: '#10b981', auth: false },
]

async function ensureAuthUser(email, password, name) {
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const existing = list.users.find((u) => u.email === email)
  if (existing) return existing.id
  const { data, error } = await db.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: name },
  })
  if (error) throw error
  return data.user.id
}

async function deleteAuthUsersByEmail(predicate) {
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
  let n = 0
  for (const u of list.users) {
    if (u.email && predicate(u.email)) { await db.auth.admin.deleteUser(u.id); n++ }
  }
  return n
}

async function insert(table, rows) {
  const { data, error } = await db.from(table).insert(rows).select()
  if (error) throw new Error(`insert ${table}: ${error.message}`)
  return data
}

async function main() {
  console.log('→ ensuring auth users (demo + mamamia)…')
  const demoAuthId = await ensureAuthUser('demo@northstar.app', DEMO_PASSWORD, 'Demo User')
  const mamamiaAuthId = await ensureAuthUser('mamamia@northstar.app', MAMAMIA_PASSWORD, 'Mamamia Admin')
  // Remove accounts from earlier iterations / invite tests.
  const removed = await deleteAuthUsersByEmail(
    (e) => e.startsWith('e2e-invite-') || ['maya@northstar.app', 'leo@northstar.app', 'sofia@northstar.app'].includes(e),
  )
  if (removed) console.log(`  removed ${removed} stale auth account(s).`)

  // SAFETY: we only ever reset the *Demo* workspace. Real workspaces (e.g.
  // Mamamia) and their members/connections are never touched, so re-seeding
  // can't wipe live data again.
  const found = await db.from('workspaces').select('id').eq('name', 'Demo').limit(1)
  if (found.error) throw new Error(`find Demo: ${found.error.message}`)
  let demoWs = found.data?.[0]
  if (!demoWs) demoWs = (await insert('workspaces', [{ name: 'Demo' }]))[0]
  const W = demoWs.id

  console.log('→ wiping the Demo workspace only…')
  for (const t of ['activity', 'comments', 'kr_checkins', 'stories', 'task_statuses', 'epics', 'key_results', 'objectives', 'cycles', 'profiles']) {
    const { error } = await db.from(t).delete().eq('workspace_id', W)
    if (error) throw new Error(`wipe ${t}: ${error.message}`)
  }

  console.log('→ creating demo people…')
  const demoProfiles = await insert(
    'profiles',
    DEMO_PEOPLE.map((p) => ({
      workspace_id: W,
      auth_user_id: p.auth ? demoAuthId : null,
      email: p.email, full_name: p.name, avatar_color: p.color,
    })),
  )
  const pid = Object.fromEntries(DEMO_PEOPLE.map((p, i) => [p.key, demoProfiles[i].id]))

  // Ensure a (separate) Mamamia workspace + admin exist — only if missing; never wiped.
  const mam = await db.from('workspaces').select('id').eq('name', 'Mamamia').limit(1)
  if (!mam.data?.length) {
    const mamWs = (await insert('workspaces', [{ name: 'Mamamia' }]))[0]
    await insert('profiles', [{
      workspace_id: mamWs.id, auth_user_id: mamamiaAuthId,
      email: 'mamamia@northstar.app', full_name: 'Mamamia Admin', avatar_color: '#0ea5e9',
    }])
  }

  console.log('→ demo board statuses…')
  await insert('task_statuses', [
    { workspace_id: demoWs.id, name: 'backlog', position: 0, category: 'backlog', color: '#a1a1aa' },
    { workspace_id: demoWs.id, name: 'todo', position: 1, category: 'todo', color: '#a1a1aa' },
    { workspace_id: demoWs.id, name: 'in_progress', position: 2, category: 'in_progress', color: '#f59e0b' },
    { workspace_id: demoWs.id, name: 'in_review', position: 3, category: 'in_review', color: '#3b82f6' },
    { workspace_id: demoWs.id, name: 'done', position: 4, category: 'done', color: '#10b981' },
    { workspace_id: demoWs.id, name: 'canceled', position: 5, category: 'canceled', color: '#a1a1aa' },
  ])

  console.log('→ demo objectives, key results, check-ins…')
  const [cycle] = await insert('cycles', [{ workspace_id: W, name: 'Q2 2026', starts_on: '2026-04-01', ends_on: '2026-06-30' }])

  const objectiveDefs = [
    { key: 'daily', title: "Make Northstar the team's daily driver", owner: 'demo', status: 'on_track', description: 'Teams should reach for Northstar first thing every morning.' },
    { key: 'platform', title: 'Ship a rock-solid v1 platform', owner: 'leo', status: 'at_risk', description: 'Reliability and performance worthy of daily, team-wide use.' },
    { key: 'delight', title: 'Make the product feel instant & delightful', owner: 'maya', status: 'on_track', description: 'Every core interaction should feel fast and obvious.' },
  ]
  const objectives = await insert('objectives', objectiveDefs.map((o) => ({
    workspace_id: W, title: o.title, description: o.description, status: o.status, owner_id: pid[o.owner], cycle_id: cycle.id,
  })))
  const objId = Object.fromEntries(objectiveDefs.map((o, i) => [o.key, objectives[i].id]))

  const krDefs = [
    { key: 'wat', obj: 'daily', title: 'Weekly active teams', unit: 'teams', start: 4, current: 14, target: 25 },
    { key: 'activation', obj: 'daily', title: 'Activation rate (signup → first story)', start: 20, current: 41, target: 60 },
    { key: 'incidents', obj: 'platform', title: 'P0 incidents per month', unit: 'incidents', start: 12, current: 5, target: 0 },
    { key: 'latency', obj: 'platform', title: 'API p95 latency', unit: 'ms', start: 800, current: 450, target: 200 },
    { key: 'ttc', obj: 'delight', title: 'Median time to create a story', unit: 'sec', start: 25, current: 14, target: 8 },
    { key: 'nps', obj: 'delight', title: 'Team NPS', start: 30, current: 38, target: 50 },
  ]
  const krs = await insert('key_results', krDefs.map((k) => ({
    workspace_id: W, objective_id: objId[k.obj], title: k.title, metric: 'number', unit: k.unit ?? null,
    start_value: k.start, current_value: k.current, target_value: k.target,
  })))
  const krId = Object.fromEntries(krDefs.map((k, i) => [k.key, krs[i].id]))

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
  await insert('kr_checkins', checkinDefs.map(([kr, who, value, confidence, note, d]) => ({
    workspace_id: W, key_result_id: krId[kr], author_id: pid[who], value, confidence, note, created_at: daysAgo(d),
  })))

  console.log('→ demo epics + stories…')
  const epicDefs = [
    { key: 'onboarding', title: 'Onboarding & activation flow', obj: 'daily', kr: 'activation', owner: 'maya', status: 'in_progress', color: '#ec4899' },
    { key: 'realtime', title: 'Realtime collaboration', obj: 'daily', kr: 'wat', owner: 'leo', status: 'planned', color: '#6366f1' },
    { key: 'reliability', title: 'Reliability & observability', obj: 'platform', kr: 'incidents', owner: 'leo', status: 'in_progress', color: '#ef4444' },
    { key: 'perf', title: 'Performance pass', obj: 'platform', kr: 'latency', owner: 'leo', status: 'backlog', color: '#f59e0b' },
    { key: 'design', title: 'Design system & micro-interactions', obj: 'delight', kr: 'ttc', owner: 'maya', status: 'in_progress', color: '#8b5cf6' },
    { key: 'cmdk', title: 'Command palette & shortcuts', obj: 'delight', kr: 'ttc', owner: 'sofia', status: 'planned', color: '#0ea5e9' },
    { key: 'tooling', title: 'Internal tooling cleanup', obj: null, kr: null, owner: 'sofia', status: 'backlog', color: '#64748b' },
  ]
  const epics = await insert('epics', epicDefs.map((e) => ({
    workspace_id: W, title: e.title, status: e.status, color: e.color,
    objective_id: e.obj ? objId[e.obj] : null, key_result_id: e.kr ? krId[e.kr] : null, owner_id: pid[e.owner],
  })))
  const epicId = Object.fromEntries(epicDefs.map((e, i) => [e.key, epics[i].id]))

  const storyDefs = [
    ['Design first-run welcome checklist', 'in_review', 'high', 3, 'onboarding', 'maya', 'activation'],
    ['Seed a sample workspace on signup', 'in_progress', 'high', 5, 'onboarding', 'maya', 'activation'],
    ['Empty states with guided CTAs', 'todo', 'medium', 2, 'onboarding', 'sofia', null],
    ['Invite teammates flow', 'backlog', 'medium', 3, 'onboarding', 'leo', null],
    ['Track activation funnel events', 'done', 'medium', 2, 'onboarding', 'leo', 'activation'],
    ['Live board updates via Realtime', 'in_progress', 'high', 5, 'realtime', 'leo', 'wat'],
    ['Presence avatars on the board', 'backlog', 'low', 3, 'realtime', 'leo', null],
    ['Add Sentry error tracking', 'done', 'high', 2, 'reliability', 'leo', 'incidents'],
    ['Health-check & uptime alerts', 'in_progress', 'urgent', 3, 'reliability', 'leo', 'incidents'],
    ['Postmortem template & on-call rota', 'todo', 'medium', 1, 'reliability', 'demo', null],
    ['Profile the slow dashboard query', 'todo', 'high', 3, 'perf', 'leo', 'latency'],
    ['Add DB indexes for hot paths', 'backlog', 'medium', 2, 'perf', 'leo', 'latency'],
    ['Unify button & input components', 'done', 'medium', 3, 'design', 'maya', null],
    ['Optimistic UI on status change', 'in_progress', 'medium', 3, 'design', 'maya', 'ttc'],
    ['Keyboard focus & a11y pass', 'todo', 'low', 2, 'design', 'sofia', null],
    ['Cmd-K command palette', 'backlog', 'medium', 5, 'cmdk', 'sofia', 'ttc'],
    ['Quick-create story shortcut (C)', 'backlog', 'low', 2, 'cmdk', 'sofia', null],
    ['Migrate legacy seed scripts', 'in_progress', 'low', 2, 'tooling', 'sofia', null],
    ['Clean up unused feature flags', 'todo', 'low', 1, 'tooling', 'demo', null],
    ['Spike: evaluate analytics vendors', 'todo', 'low', 2, null, 'demo', null],
  ]
  const insertedStories = await insert('stories', storyDefs.map(([title, status, priority, estimate, epic, assignee, kr], i) => ({
    workspace_id: W, title, status, priority, estimate,
    epic_id: epic ? epicId[epic] : null, assignee_id: pid[assignee], key_result_id: kr ? krId[kr] : null, position: i,
  })))
  const storyByTitle = Object.fromEntries(insertedStories.map((s) => [s.title, s.id]))

  await insert('comments', [
    ['Health-check & uptime alerts', 'leo', 'Uptime checks are live and alerting to #oncall. Want a runbook link before we close this.'],
    ['Health-check & uptime alerts', 'demo', "Great. I'll fold the runbook into the postmortem template story."],
    ['Seed a sample workspace on signup', 'maya', 'Sample workspace lands on first login. Open question: do we wipe it once a real story is created?'],
  ].filter(([t]) => storyByTitle[t]).map(([t, who, body]) => ({ workspace_id: W, story_id: storyByTitle[t], author_id: pid[who], body })))

  console.log(`\n✓ Seed complete.`)
  console.log(`  Demo workspace: ${objectiveDefs.length} objectives, ${krDefs.length} KRs, ${epicDefs.length} epics, ${storyDefs.length} stories.`)
  console.log(`  Sign in — demo:    demo@northstar.app / ${DEMO_PASSWORD}`)
  console.log(`  Sign in — mamamia: mamamia@northstar.app / ${MAMAMIA_PASSWORD} (empty; populate via Integrations → Sync)`)
}

main().catch((err) => {
  console.error('\n✗ Seed failed:', err.message)
  process.exit(1)
})
