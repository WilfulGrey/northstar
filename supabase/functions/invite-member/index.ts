// Northstar — invite a teammate by link.
//
// Creates (or reuses) an auth user for the email, links it to a profile in the
// caller's workspace (a synced Airtable Team contact gets upgraded to a login),
// and mints a one-time token. The caller turns the token into a link and shares
// it; the invitee opens it and sets a password (see accept-invite).

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

  const url = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!

  const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return json({ error: 'Unauthorized' }, 401)

  let payload: { email?: string; full_name?: string }
  try { payload = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }
  const email = (payload.email ?? '').trim().toLowerCase()
  const fullName = (payload.full_name ?? '').trim() || email.split('@')[0]
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'A valid email is required' }, 400)

  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: me } = await admin.from('profiles').select('workspace_id').eq('auth_user_id', user.id).maybeSingle()
  const W = me?.workspace_id as string | undefined
  if (!W) return json({ error: 'No workspace for this account.' }, 400)

  // 1. Auth user (created without a usable password until they accept).
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listErr) return json({ error: listErr.message }, 500)
  const existingUser = list.users.find((u) => u.email?.toLowerCase() === email)
  let userId: string
  if (existingUser) {
    userId = existingUser.id
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email, password: `pending-${crypto.randomUUID()}`, email_confirm: true, user_metadata: { full_name: fullName },
    })
    if (error || !data.user) return json({ error: error?.message ?? 'Could not create user' }, 400)
    userId = data.user.id
  }

  // 2. Link a workspace profile to that user. Prefer upgrading an existing
  //    contact (e.g. a synced Airtable Team member) with the same email.
  const { data: contact } = await admin
    .from('profiles').select('id,auth_user_id').eq('workspace_id', W).ilike('email', email).maybeSingle()
  let alreadyMember = false
  if (contact) {
    if (contact.auth_user_id && contact.auth_user_id === userId) alreadyMember = true
    await admin.from('profiles').update({ auth_user_id: userId, full_name: fullName }).eq('id', contact.id)
  } else {
    await admin.from('profiles').insert({ workspace_id: W, auth_user_id: userId, email, full_name: fullName })
  }

  // 3. One-time invite token (7 days).
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '')
  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
  const { error: invErr } = await admin.from('invites').insert({ token, email, auth_user_id: userId, workspace_id: W, expires_at: expires })
  if (invErr) return json({ error: invErr.message }, 500)

  return json({ ok: true, token, email, full_name: fullName, already_member: alreadyMember })
})
