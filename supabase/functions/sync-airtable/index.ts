// Northstar — manual sync / connect (per workspace).
//
// First call with { token, baseId } CONNECTS the workspace: the token is stored
// server-side (workspace_integrations) for the whole org. Later calls with no
// body re-use the stored token ("Sync now"). Statuses come 1:1 from Airtable.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { syncWorkspace } from '../_shared/sync.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!

  const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)

  let body: { token?: string; baseId?: string } = {}
  try { body = await req.json() } catch { /* empty body = sync with stored creds */ }
  const token = (body.token ?? '').trim()
  const baseId = (body.baseId ?? '').trim()

  const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: prof } = await db.from('profiles').select('workspace_id').eq('auth_user_id', user.id).maybeSingle()
  const W = prof?.workspace_id as string | undefined
  if (!W) return json({ error: 'No workspace for this account.' }, 400)

  // Connect / update credentials if provided.
  if (token && baseId) {
    const { error } = await db.from('workspace_integrations').upsert({
      workspace_id: W, provider: 'airtable', token, base_id: baseId, enabled: true, updated_at: new Date().toISOString(),
    })
    if (error) return json({ error: `Could not save connection: ${error.message}` }, 500)
    await db.from('workspaces').update({ airtable_connected: true, airtable_base_id: baseId }).eq('id', W)
  }

  // Load stored credentials (works whether we just connected or not).
  const { data: integ } = await db.from('workspace_integrations').select('token,base_id,enabled').eq('workspace_id', W).maybeSingle()
  if (!integ) return json({ error: 'Airtable is not connected. Provide a token and base id first.' }, 400)

  try {
    const summary = await syncWorkspace(db, { token: integ.token, baseId: integ.base_id, workspaceId: W })
    await db.from('workspace_integrations').update({ last_sync_at: new Date().toISOString(), last_error: null }).eq('workspace_id', W)
    return json({ ok: true, ...summary })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await db.from('workspace_integrations').update({ last_error: msg }).eq('workspace_id', W)
    return json({ error: msg }, 500)
  }
})
