// Northstar — scheduled sync for every connected workspace.
//
// Called by an external scheduler (GitHub Actions) every few minutes. No user
// session: deployed with --no-verify-jwt and protected by a shared secret
// (x-sync-secret). Uses each workspace's stored token, so the org's data stays
// fresh in the background without anyone having the app open.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { syncWorkspace } from '../_shared/sync.ts'

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const secret = Deno.env.get('SYNC_SECRET')
  if (!secret || req.headers.get('x-sync-secret') !== secret) return json({ error: 'Forbidden' }, 403)

  const url = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: integrations, error } = await db
    .from('workspace_integrations')
    .select('workspace_id,token,base_id')
    .eq('enabled', true)
  if (error) return json({ error: error.message }, 500)

  const results: { workspace_id: string; ok: boolean; stories?: number; error?: string }[] = []
  for (const it of integrations ?? []) {
    try {
      const summary = await syncWorkspace(db, { token: it.token, baseId: it.base_id, workspaceId: it.workspace_id })
      await db.from('workspace_integrations').update({ last_sync_at: new Date().toISOString(), last_error: null }).eq('workspace_id', it.workspace_id)
      results.push({ workspace_id: it.workspace_id, ok: true, stories: summary.stories.total })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await db.from('workspace_integrations').update({ last_error: msg }).eq('workspace_id', it.workspace_id)
      results.push({ workspace_id: it.workspace_id, ok: false, error: msg })
    }
  }
  return json({ ok: true, synced: results.length, results })
})
