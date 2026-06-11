// Disconnect Airtable for the caller's workspace: remove the stored token and
// clear connection status. (Synced data is left in place.)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!

  const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const db = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: prof } = await db.from('profiles').select('workspace_id').eq('auth_user_id', user.id).maybeSingle()
  const W = prof?.workspace_id as string | undefined
  if (!W) return json({ error: 'No workspace for this account.' }, 400)

  await db.from('workspace_integrations').delete().eq('workspace_id', W)
  await db.from('workspaces').update({ airtable_connected: false, airtable_base_id: null }).eq('id', W)
  return json({ ok: true })
})
