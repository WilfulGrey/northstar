// Northstar — invite a teammate.
//
// Why a server-side function? Creating an auth user needs the service_role key,
// which must never reach the browser. This Edge Function runs with verify_jwt
// on, so only an authenticated team member can call it; it then uses the
// service role (injected by the platform) to provision the account. Idempotent:
// inviting an existing email returns that member.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#64748b']

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // 1. Confirm the caller is a real, signed-in user (not just the anon key).
  const authHeader = req.headers.get('Authorization') ?? ''
  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
  const {
    data: { user },
    error: authErr,
  } = await caller.auth.getUser()
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  // 2. Validate input.
  let payload: { email?: string; full_name?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const email = (payload.email ?? '').trim().toLowerCase()
  const fullName = (payload.full_name ?? '').trim() || email.split('@')[0]
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'A valid email is required' }, 400)
  }

  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
  const color = COLORS[[...email].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length]

  // 3. Idempotent provisioning.
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listErr) return json({ error: listErr.message }, 500)
  const existing = list.users.find((u) => u.email?.toLowerCase() === email)

  let userId: string
  let tempPassword: string | null = null
  let created = false
  if (existing) {
    userId = existing.id
  } else {
    tempPassword = `ns-${crypto.randomUUID().slice(0, 10)}`
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (error || !data.user) return json({ error: error?.message ?? 'Could not create user' }, 400)
    userId = data.user.id
    created = true
  }

  // 4. Make sure the profile is filled in (the trigger creates a bare row).
  const { error: profileErr } = await admin
    .from('profiles')
    .upsert({ id: userId, email, full_name: fullName, avatar_color: color })
  if (profileErr) return json({ error: profileErr.message }, 500)

  return json({
    ok: true,
    created,
    member: { id: userId, email, full_name: fullName },
    temp_password: tempPassword,
  })
})
