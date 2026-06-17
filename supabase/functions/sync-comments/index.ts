// Northstar — incremental crawl of Airtable native record comments.
//
// Airtable comments live on each record (per-record endpoint, ~5 req/s), so we
// can't pull them inline with the main sync. This processes a window of each
// connected workspace's tasks per call, advances a stored cursor, and imports
// the comments it finds. The scheduler (pg_cron) calls it repeatedly; over a few
// runs it covers the whole base, then loops to keep comments fresh.
//
// No user session: deployed with --no-verify-jwt, guarded by x-sync-secret.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { syncCommentsBatch } from '../_shared/sync.ts'

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })

// Tasks scanned per call — sized to finish well under the 150s function limit
// (per-task latency runs ~250ms incl. pacing).
const BATCH = 300

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const secret = Deno.env.get('SYNC_SECRET')
  if (!secret || req.headers.get('x-sync-secret') !== secret) return json({ error: 'Forbidden' }, 403)

  const url = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: integrations, error } = await db
    .from('workspace_integrations')
    .select('workspace_id,token,base_id,comments_cursor')
    .eq('enabled', true)
  if (error) return json({ error: error.message }, 500)

  const results: unknown[] = []
  for (const it of integrations ?? []) {
    try {
      const res = await syncCommentsBatch(db, {
        token: it.token, baseId: it.base_id, workspaceId: it.workspace_id, cursor: it.comments_cursor ?? 0, limit: BATCH,
      })
      await db.from('workspace_integrations').update({ comments_cursor: res.cursor }).eq('workspace_id', it.workspace_id)
      results.push({ workspace_id: it.workspace_id, ok: true, ...res })
    } catch (e) {
      results.push({ workspace_id: it.workspace_id, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return json({ ok: true, results })
})
