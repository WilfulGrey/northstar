// Northstar — accept an invite link. Public (the invitee has no session yet);
// the one-time token is the credential. Validates it, sets the chosen password,
// and burns the token. The page then signs in with email + the new password.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: { token?: string; password?: string }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }
  const token = (body.token ?? '').trim()
  const password = body.password ?? ''
  if (!token) return json({ error: 'Missing invite token' }, 400)
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)

  const url = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: invite } = await admin.from('invites').select('*').eq('token', token).maybeSingle()
  if (!invite) return json({ error: 'This invite link is not valid.' }, 400)
  if (invite.used_at) return json({ error: 'This invite link has already been used.' }, 400)
  if (new Date(invite.expires_at).getTime() < Date.now()) return json({ error: 'This invite link has expired.' }, 400)

  const { error: updErr } = await admin.auth.admin.updateUserById(invite.auth_user_id, { password, email_confirm: true })
  if (updErr) return json({ error: updErr.message }, 500)

  await admin.from('invites').update({ used_at: new Date().toISOString() }).eq('token', token)
  return json({ ok: true, email: invite.email })
})
