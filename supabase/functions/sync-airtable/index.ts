// Northstar — Airtable → Northstar sync.
//
// Pulls the Airtable hierarchy (Objectives → Key Results → Epics → Tasks) and
// upserts it into Northstar keyed by airtable_id (idempotent). Task statuses are
// taken 1:1 from Airtable's Status field options and written to task_statuses,
// so a new status in Airtable becomes a new board column. Runs server-side with
// verify_jwt on; the Airtable token never reaches the browser.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const env = (k: string) => Deno.env.get(k) ?? ''
const AT_TOKEN = env('AIRTABLE_TOKEN')
const BASE = env('AIRTABLE_BASE_ID')
const T_TASKS = env('AIRTABLE_TASKS_TABLE_ID')
const T_EPICS = env('AIRTABLE_EPICS_TABLE_ID')
const T_OBJ = env('AIRTABLE_OBJECTIVES_TABLE_ID')
const T_KR = env('AIRTABLE_KEY_RESULTS_TABLE_ID')

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#64748b']
const CAT_COLOR: Record<string, string> = {
  backlog: '#a1a1aa', todo: '#a1a1aa', in_progress: '#f59e0b', in_review: '#3b82f6', done: '#10b981', canceled: '#a1a1aa',
}
const colorFor = (s: string) => PALETTE[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length]

function taskCategory(name: string): string {
  const n = name.trim().toLowerCase()
  const explicit: Record<string, string> = {
    'backlog': 'backlog', 'sprint backlog': 'backlog',
    'to do': 'todo', 'sprint': 'todo',
    'in progress': 'in_progress', 'rollback': 'in_progress', 'frozen development': 'in_progress',
    'ready for test on beta': 'in_review', 'verification beta': 'in_review', 'frozen testing': 'in_review',
    'tests on beta passed': 'in_review', 'ready for prod test': 'in_review', 'verification on prod': 'in_review',
    'merged to prod': 'done', 'mm live': 'done',
    'rejected': 'canceled',
  }
  if (explicit[n]) return explicit[n]
  if (/(done|live|complete|shipped|merged)/.test(n)) return 'done'
  if (/(reject|cancel|dropped)/.test(n)) return 'canceled'
  if (/(review|test|verif|qa|beta)/.test(n)) return 'in_review'
  if (/(progress|doing|\bdev\b|rollback)/.test(n)) return 'in_progress'
  if (/(to ?do|sprint|ready|next)/.test(n)) return 'todo'
  return 'backlog'
}

function mapPriority(v: unknown): string {
  if (!v) return 'none'
  const n = String(v).toLowerCase()
  if (n.includes('urgent')) return 'urgent'
  if (n.includes('high')) return 'high'
  if (n.includes('med')) return 'medium'
  if (n.includes('low')) return 'low'
  return 'none'
}

type Rec = { id: string; fields: Record<string, unknown> }

async function fetchAll(table: string, fields: string[]): Promise<Rec[]> {
  const out: Rec[] = []
  let offset: string | undefined
  do {
    const u = new URL(`https://api.airtable.com/v0/${BASE}/${table}`)
    u.searchParams.set('pageSize', '100')
    for (const f of fields) u.searchParams.append('fields[]', f)
    if (offset) u.searchParams.set('offset', offset)
    const r = await fetch(u, { headers: { Authorization: `Bearer ${AT_TOKEN}` } })
    const j = await r.json()
    if (j.error) throw new Error(`Airtable ${table}: ${JSON.stringify(j.error)}`)
    out.push(...j.records)
    offset = j.offset
  } while (offset)
  return out
}

async function statusOptions(): Promise<string[]> {
  const r = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE}/tables`, {
    headers: { Authorization: `Bearer ${AT_TOKEN}` },
  })
  const j = await r.json()
  if (j.error) throw new Error(`Airtable schema: ${JSON.stringify(j.error)}`)
  const tasks = j.tables.find((t: { id: string }) => t.id === T_TASKS)
  const field = tasks?.fields.find((f: { name: string }) => f.name === 'Status')
  return (field?.options?.choices ?? []).map((c: { name: string }) => c.name)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = env('SUPABASE_URL')
  const service = env('SUPABASE_SERVICE_ROLE_KEY')
  const anon = env('SUPABASE_ANON_KEY')

  // Only signed-in members may trigger a sync.
  const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)

  if (!AT_TOKEN || !BASE) return json({ error: 'Airtable env not configured' }, 500)

  const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
  const started = Date.now()

  async function existingIds(table: string): Promise<Set<string>> {
    const { data, error } = await db.from(table).select('airtable_id').not('airtable_id', 'is', null)
    if (error) throw new Error(`${table} ids: ${error.message}`)
    return new Set((data ?? []).map((r: { airtable_id: string }) => r.airtable_id))
  }
  async function upsertChunked(table: string, rows: Record<string, unknown>[], conflict: string) {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await db.from(table).upsert(rows.slice(i, i + 200), { onConflict: conflict })
      if (error) throw new Error(`upsert ${table}: ${error.message}`)
    }
  }
  const tally = (ids: Set<string>, rows: { airtable_id: string }[]) => {
    let created = 0
    for (const r of rows) if (!ids.has(r.airtable_id)) created++
    return { created, updated: rows.length - created, total: rows.length }
  }

  try {
    // ---- Task statuses (1:1 from Airtable) ----
    const optionNames = await statusOptions()

    // ---- Objectives ----
    const objBefore = await existingIds('objectives')
    const objRecs = await fetchAll(T_OBJ, ['Objective Name', 'Objective Description', 'Status'])
    const objRows = objRecs.map((r) => ({
      airtable_id: r.id,
      title: String(r.fields['Objective Name'] ?? '(untitled objective)'),
      description: (r.fields['Objective Description'] as string) ?? null,
      status: (r.fields['Status'] as string) ?? null,
    }))
    await upsertChunked('objectives', objRows, 'airtable_id')
    const { data: objMap } = await db.from('objectives').select('id,airtable_id').not('airtable_id', 'is', null)
    const objByAt = new Map((objMap ?? []).map((o: { id: string; airtable_id: string }) => [o.airtable_id, o.id]))

    // ---- Key Results ----
    const krBefore = await existingIds('key_results')
    const krRecs = await fetchAll(T_KR, ['Key Result', 'Objective', 'Status', 'Progress'])
    let skippedKr = 0
    const krRows: Record<string, unknown>[] = []
    for (const r of krRecs) {
      const objIds = (r.fields['Objective'] as string[]) ?? []
      const nsObj = objIds.length ? objByAt.get(objIds[0]) : null
      if (!nsObj) { skippedKr++; continue } // objective_id is required
      const p = r.fields['Progress']
      const current = typeof p === 'number' ? (p <= 1 ? Math.round(p * 100) : Math.round(p)) : 0
      krRows.push({
        airtable_id: r.id, objective_id: nsObj,
        title: String(r.fields['Key Result'] ?? '(untitled KR)'),
        metric: 'percent', start_value: 0, target_value: 100, current_value: current,
        status: (r.fields['Status'] as string) ?? null,
      })
    }
    await upsertChunked('key_results', krRows, 'airtable_id')
    const { data: krMap } = await db.from('key_results').select('id,objective_id,airtable_id').not('airtable_id', 'is', null)
    const krByAt = new Map((krMap ?? []).map((k: { id: string; airtable_id: string }) => [k.airtable_id, k.id]))
    const krObj = new Map((krMap ?? []).map((k: { id: string; objective_id: string }) => [k.id, k.objective_id]))

    // ---- Epics ----
    const epBefore = await existingIds('epics')
    const epRecs = await fetchAll(T_EPICS, ['Epic Name', 'Description', 'Epic Status', 'Key Result'])
    const epRows = epRecs.map((r) => {
      const krIds = (r.fields['Key Result'] as string[]) ?? []
      const nsKr = krIds.length ? krByAt.get(krIds[0]) ?? null : null
      const name = String(r.fields['Epic Name'] ?? '(untitled epic)')
      return {
        airtable_id: r.id, title: name,
        description: (r.fields['Description'] as string) ?? null,
        status: (r.fields['Epic Status'] as string) ?? null,
        key_result_id: nsKr,
        objective_id: nsKr ? krObj.get(nsKr) ?? null : null,
        color: colorFor(name),
      }
    })
    await upsertChunked('epics', epRows, 'airtable_id')
    const { data: epMap } = await db.from('epics').select('id,airtable_id').not('airtable_id', 'is', null)
    const epByAt = new Map((epMap ?? []).map((e: { id: string; airtable_id: string }) => [e.airtable_id, e.id]))

    // ---- Tasks (+ statuses) ----
    const taskRecs = await fetchAll(T_TASKS, ['Task Name', 'Status', 'Priority Level', 'Estimated hours', 'Associated Epic', 'Task Description'])

    // Union of schema options and any status actually present on a record.
    const names: string[] = [...optionNames]
    const seen = new Set(optionNames)
    for (const r of taskRecs) {
      const s = r.fields['Status'] as string | undefined
      if (s && !seen.has(s)) { seen.add(s); names.push(s) }
    }
    const tsRows = names.map((name, i) => ({ name, position: i, category: taskCategory(name), color: CAT_COLOR[taskCategory(name)] }))
    await upsertChunked('task_statuses', tsRows, 'name')

    const stBefore = await existingIds('stories')
    const stRows = taskRecs.map((r) => {
      const epIds = (r.fields['Associated Epic'] as string[]) ?? []
      const nsEpic = epIds.length ? epByAt.get(epIds[0]) ?? null : null
      const hours = r.fields['Estimated hours']
      return {
        airtable_id: r.id,
        title: String(r.fields['Task Name'] ?? '(untitled task)'),
        description: (r.fields['Task Description'] as string) ?? null,
        status: (r.fields['Status'] as string) ?? null,
        priority: mapPriority(r.fields['Priority Level']),
        estimate: typeof hours === 'number' ? Math.round(hours) : null,
        epic_id: nsEpic,
      }
    })
    await upsertChunked('stories', stRows, 'airtable_id')

    return json({
      ok: true,
      ms: Date.now() - started,
      statuses: tsRows.length,
      objectives: tally(objBefore, objRows),
      key_results: { ...tally(krBefore, krRows as { airtable_id: string }[]), skipped: skippedKr },
      epics: tally(epBefore, epRows),
      stories: tally(stBefore, stRows),
    })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
