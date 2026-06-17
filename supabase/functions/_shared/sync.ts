// Shared Airtable → Northstar sync core, used by the manual, connect and
// scheduled entry points. Writes into one workspace; upserts by
// (workspace_id, airtable_id). Caller passes a service-role Supabase client.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#64748b']
const CAT_COLOR: Record<string, string> = { backlog: '#a1a1aa', todo: '#a1a1aa', in_progress: '#f59e0b', in_review: '#3b82f6', done: '#10b981', canceled: '#a1a1aa' }
const colorFor = (s: string) => PALETTE[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length]

function taskCategory(name: string): string {
  const n = name.trim().toLowerCase()
  const m: Record<string, string> = {
    'backlog': 'backlog', 'sprint backlog': 'backlog', 'to do': 'todo', 'sprint': 'todo',
    'in progress': 'in_progress', 'rollback': 'in_progress', 'frozen development': 'in_progress',
    'ready for test on beta': 'in_review', 'verification beta': 'in_review', 'frozen testing': 'in_review',
    'tests on beta passed': 'in_review', 'ready for prod test': 'in_review', 'verification on prod': 'in_review',
    'merged to prod': 'done', 'mm live': 'done', 'rejected': 'canceled',
  }
  if (m[n]) return m[n]
  if (/(done|live|complete|shipped|merged)/.test(n)) return 'done'
  if (/(reject|cancel|dropped)/.test(n)) return 'canceled'
  if (/(review|test|verif|qa|beta)/.test(n)) return 'in_review'
  if (/(progress|doing|rollback)/.test(n)) return 'in_progress'
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
const first = (v: unknown): string | null => (Array.isArray(v) && v.length ? (v[0] as string) : null)

export interface SyncSummary {
  ms: number
  statuses: number
  people: number
  objectives: { created: number; updated: number; total: number }
  key_results: { created: number; updated: number; total: number; skipped: number }
  epics: { created: number; updated: number; total: number }
  stories: { created: number; updated: number; total: number }
}

// Native record comments are crawled separately (per-task endpoint, rate-limited)
// by syncCommentsBatch below — too slow to do inline with the main sync.
export interface CommentBatchResult {
  total: number // tasks in the workspace
  processed: number // tasks scanned this batch
  imported: number // comment rows upserted
  cursor: number // next cursor (wraps to 0 after a full pass)
  done: boolean // true when this batch completed a full pass
}

export async function syncWorkspace(
  db: SupabaseClient,
  opts: { token: string; baseId: string; workspaceId: string },
): Promise<SyncSummary> {
  const { token, baseId, workspaceId: W } = opts
  const at = { Authorization: `Bearer ${token}` }
  const started = Date.now()

  async function fetchAll(tableId: string, fields: string[]): Promise<Rec[]> {
    const out: Rec[] = []
    let offset: string | undefined
    do {
      const u = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`)
      u.searchParams.set('pageSize', '100')
      for (const f of fields) u.searchParams.append('fields[]', f)
      if (offset) u.searchParams.set('offset', offset)
      const r = await fetch(u, { headers: at })
      const j = await r.json()
      if (j.error) throw new Error(`Airtable ${tableId}: ${JSON.stringify(j.error)}`)
      out.push(...j.records); offset = j.offset
    } while (offset)
    return out
  }
  async function upsert(table: string, rows: Record<string, unknown>[]) {
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await db.from(table).upsert(rows.slice(i, i + 200), { onConflict: 'workspace_id,airtable_id' })
      if (error) throw new Error(`upsert ${table}: ${error.message}`)
    }
  }
  async function idMap(table: string, extra = ''): Promise<Map<string, Record<string, unknown>>> {
    const { data, error } = await db.from(table).select(`id,airtable_id${extra}`).eq('workspace_id', W).not('airtable_id', 'is', null)
    if (error) throw new Error(`map ${table}: ${error.message}`)
    return new Map((data ?? []).map((r: Record<string, unknown>) => [r.airtable_id as string, r]))
  }
  async function existing(table: string): Promise<Set<string>> {
    const { data } = await db.from(table).select('airtable_id').eq('workspace_id', W).not('airtable_id', 'is', null)
    return new Set((data ?? []).map((r: { airtable_id: string }) => r.airtable_id))
  }
  const tally = (before: Set<string>, rows: { airtable_id: string }[]) => {
    const created = rows.filter((r) => !before.has(r.airtable_id)).length
    return { created, updated: rows.length - created, total: rows.length }
  }

  // ---- discover tables + task status options ----
  const metaRes = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, { headers: at })
  const meta = await metaRes.json()
  if (meta.error) throw new Error(`Airtable schema: ${JSON.stringify(meta.error)}`)
  const byName = (n: string) => meta.tables.find((t: { name: string }) => t.name.toLowerCase() === n.toLowerCase())
  const T_TEAM = byName('Team')?.id
  const T_OBJ = byName('Objectives')?.id
  const T_KR = byName('Key Results')?.id
  const T_EPICS = byName('Epics')?.id
  const T_TASKS = byName('Tasks')?.id
  if (!T_TASKS) throw new Error('No "Tasks" table found in this base.')
  const statusField = byName('Tasks').fields.find((f: { name: string }) => f.name === 'Status')
  const optionNames: string[] = (statusField?.options?.choices ?? []).map((c: { name: string }) => c.name)

  // ---- Team → profiles ----
  let teamByAt = new Map<string, string>()
  if (T_TEAM) {
    const recs = await fetchAll(T_TEAM, ['Name', 'Email'])
    await upsert('profiles', recs.map((r) => ({
      workspace_id: W, airtable_id: r.id,
      full_name: String(r.fields['Name'] ?? 'Unknown'),
      email: (r.fields['Email'] as string) ?? null,
      avatar_color: colorFor(String(r.fields['Name'] ?? r.id)),
    })))
    const m = await idMap('profiles')
    teamByAt = new Map([...m].map(([atId, row]) => [atId, row.id as string]))
  }

  // ---- Objectives ----
  let objSummary = { created: 0, updated: 0, total: 0 }
  let objByAt = new Map<string, Record<string, unknown>>()
  if (T_OBJ) {
    const before = await existing('objectives')
    const recs = await fetchAll(T_OBJ, ['Objective Name', 'Objective Description', 'Status', 'Assigned Stakeholders'])
    const rows = recs.map((r) => ({
      workspace_id: W, airtable_id: r.id,
      title: String(r.fields['Objective Name'] ?? '(untitled objective)'),
      description: (r.fields['Objective Description'] as string) ?? null,
      status: (r.fields['Status'] as string) ?? null,
      owner_id: teamByAt.get(first(r.fields['Assigned Stakeholders']) ?? '') ?? null,
    }))
    await upsert('objectives', rows)
    objSummary = tally(before, rows)
    objByAt = await idMap('objectives')
  }

  // ---- Key Results ----
  let krSummary = { created: 0, updated: 0, total: 0, skipped: 0 }
  let krByAt = new Map<string, Record<string, unknown>>()
  if (T_KR) {
    const before = await existing('key_results')
    const recs = await fetchAll(T_KR, ['Key Result', 'Objective', 'Status', 'Progress'])
    let skipped = 0
    const rows: Record<string, unknown>[] = []
    for (const r of recs) {
      const obj = objByAt.get(first(r.fields['Objective']) ?? '')
      if (!obj) { skipped++; continue }
      const p = r.fields['Progress']
      const current = typeof p === 'number' ? (p <= 1 ? Math.round(p * 100) : Math.round(p)) : 0
      rows.push({
        workspace_id: W, airtable_id: r.id, objective_id: obj.id,
        title: String(r.fields['Key Result'] ?? '(untitled KR)'),
        metric: 'percent', start_value: 0, target_value: 100, current_value: current,
        status: (r.fields['Status'] as string) ?? null,
      })
    }
    await upsert('key_results', rows)
    krSummary = { ...tally(before, rows as { airtable_id: string }[]), skipped }
    krByAt = await idMap('key_results', ',objective_id')
  }

  // ---- Epics ----
  let epSummary = { created: 0, updated: 0, total: 0 }
  let epByAt = new Map<string, Record<string, unknown>>()
  if (T_EPICS) {
    const before = await existing('epics')
    const recs = await fetchAll(T_EPICS, ['Epic Name', 'Description', 'Epic Status', 'Key Result', 'DRI'])
    const rows = recs.map((r) => {
      const kr = krByAt.get(first(r.fields['Key Result']) ?? '')
      const name = String(r.fields['Epic Name'] ?? '(untitled epic)')
      return {
        workspace_id: W, airtable_id: r.id, title: name,
        description: (r.fields['Description'] as string) ?? null,
        status: (r.fields['Epic Status'] as string) ?? null,
        key_result_id: kr?.id ?? null,
        objective_id: kr?.objective_id ?? null,
        owner_id: teamByAt.get(first(r.fields['DRI']) ?? '') ?? null,
        color: colorFor(name),
      }
    })
    await upsert('epics', rows)
    epSummary = tally(before, rows)
    epByAt = await idMap('epics')
  }

  // ---- Task statuses + Tasks ----
  const before = await existing('stories')
  const taskRecs = await fetchAll(T_TASKS, ['Task Name', 'Status', 'Priority Level', 'Estimated hours', 'Associated Epic', 'Task Description', 'DRI'])
  const names: string[] = [...optionNames]
  const seen = new Set(optionNames)
  for (const r of taskRecs) {
    const s = r.fields['Status'] as string | undefined
    if (s && !seen.has(s)) { seen.add(s); names.push(s) }
  }
  const tsRows = names.map((name, i) => ({
    workspace_id: W, name, position: i, category: taskCategory(name), color: CAT_COLOR[taskCategory(name)],
  }))
  for (let i = 0; i < tsRows.length; i += 200) {
    const { error } = await db.from('task_statuses').upsert(tsRows.slice(i, i + 200), { onConflict: 'workspace_id,name' })
    if (error) throw new Error(`upsert task_statuses: ${error.message}`)
  }

  const stRows = taskRecs.map((r) => {
    const ep = epByAt.get(first(r.fields['Associated Epic']) ?? '')
    const hours = r.fields['Estimated hours']
    return {
      workspace_id: W, airtable_id: r.id,
      title: String(r.fields['Task Name'] ?? '(untitled task)'),
      description: (r.fields['Task Description'] as string) ?? null,
      status: (r.fields['Status'] as string) ?? null,
      priority: mapPriority(r.fields['Priority Level']),
      estimate: typeof hours === 'number' ? Math.round(hours) : null,
      epic_id: ep?.id ?? null,
      assignee_id: teamByAt.get(first(r.fields['DRI']) ?? '') ?? null,
    }
  })
  await upsert('stories', stRows)

  const now = new Date().toISOString()
  await db.from('workspaces').update({ airtable_base_id: baseId, last_sync_at: now }).eq('id', W)

  return {
    ms: Date.now() - started, statuses: names.length, people: teamByAt.size,
    objectives: objSummary, key_results: krSummary, epics: epSummary, stories: tally(before, stRows),
  }
}

/**
 * Crawl Airtable's native record comments for a window of this workspace's tasks
 * and upsert them. Per-record + rate-limited (~5 req/s), so it processes `limit`
 * tasks per call and advances a cursor; the background scheduler walks the whole
 * base over several runs. Task record ids come from already-synced stories, so
 * no task re-fetch is needed.
 */
export async function syncCommentsBatch(
  db: SupabaseClient,
  opts: { token: string; baseId: string; workspaceId: string; cursor: number; limit: number },
): Promise<CommentBatchResult> {
  const { token, baseId, workspaceId: W, cursor, limit } = opts
  const at = { Authorization: `Bearer ${token}` }
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  const metaRes = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, { headers: at })
  const meta = await metaRes.json()
  if (meta.error) throw new Error(`Airtable schema: ${JSON.stringify(meta.error)}`)
  const T_TASKS = meta.tables.find((t: { name: string }) => t.name.toLowerCase() === 'tasks')?.id
  if (!T_TASKS) throw new Error('No "Tasks" table found in this base.')

  // Page past the 1000-row cap so every task is covered.
  const storyRows: { id: string; airtable_id: string }[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from('stories').select('id,airtable_id').eq('workspace_id', W).not('airtable_id', 'is', null).range(from, from + 999)
    storyRows.push(...((data ?? []) as { id: string; airtable_id: string }[]))
    if (!data || data.length < 1000) break
  }
  const storyByAt = new Map(storyRows.map((s) => [s.airtable_id, s.id]))
  const { data: profs } = await db.from('profiles').select('id,email').eq('workspace_id', W).not('email', 'is', null)
  const profByEmail = new Map((profs ?? []).map((p: { id: string; email: string }) => [p.email.toLowerCase(), p.id]))

  const taskIds = [...storyByAt.keys()].sort() // stable order so the cursor covers everything
  const total = taskIds.length
  const start = cursor >= total ? 0 : cursor
  const window = taskIds.slice(start, start + limit)

  // Flush to the DB as we go so progress survives even if the run is cut short.
  let imported = 0
  let rows: Record<string, unknown>[] = []
  const flush = async () => {
    if (!rows.length) return
    const { error } = await db.from('comments').upsert(rows, { onConflict: 'workspace_id,airtable_id' })
    if (error) throw new Error(`upsert comments: ${error.message}`)
    imported += rows.length
    rows = []
  }

  for (const taskAtId of window) {
    const storyId = storyByAt.get(taskAtId)
    let offset: string | undefined
    do {
      const u = new URL(`https://api.airtable.com/v0/${baseId}/${T_TASKS}/${taskAtId}/comments`)
      u.searchParams.set('pageSize', '100')
      if (offset) u.searchParams.set('offset', offset)
      const r = await fetch(u, { headers: at })
      const j = await r.json()
      if (j.error) break // skip a record we can't read (deleted, etc.)
      for (const c of j.comments ?? []) {
        const body = String(c.text ?? '').trim()
        if (!body || !storyId) continue
        const email = (c.author?.email ?? '').toLowerCase()
        rows.push({
          workspace_id: W, airtable_id: c.id, story_id: storyId, body,
          author_id: email ? (profByEmail.get(email) ?? null) : null,
          created_at: c.createdTime ?? undefined,
        })
      }
      offset = j.offset
      await sleep(110) // stay under Airtable's 5 req/s
    } while (offset)
    if (rows.length >= 100) await flush()
  }
  await flush()

  const next = start + limit
  return { total, processed: window.length, imported, cursor: next >= total ? 0 : next, done: next >= total }
}
