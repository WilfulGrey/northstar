import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'

export function AcceptInvite() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setError(null)
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setBusy(true)
    const { data, error: fnErr } = await supabase.functions.invoke('accept-invite', { body: { token, password } })
    if (fnErr) {
      let message = fnErr.message
      try {
        const body = await (fnErr as { context?: Response }).context?.json()
        if (body?.error) message = body.error
      } catch {
        // keep default
      }
      setBusy(false)
      return setError(message)
    }
    const email = (data as { email: string }).email
    const { error: signErr } = await signIn(email, password)
    setBusy(false)
    if (signErr) return setError(signErr)
    navigate('/', { replace: true })
  }

  return (
    <div className="flex h-full items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/star.svg" alt="" className="h-11 w-11" />
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-zinc-900">Join the workspace</h1>
          <p className="mt-1 text-sm text-zinc-500">Set a password to finish setting up your Northstar account.</p>
        </div>

        {!token ? (
          <div className="card p-6 text-center text-sm text-zinc-600">This invite link is missing its token.</div>
        ) : (
          <form
            className="card space-y-4 p-6 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <div>
              <label className="label" htmlFor="pw">Password</label>
              <input
                id="pw"
                type="password"
                autoComplete="new-password"
                className="input"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="pw2">Confirm password</label>
              <input
                id="pw2"
                type="password"
                autoComplete="new-password"
                className="input"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button type="submit" className="btn btn-primary w-full" disabled={busy}>
              {busy ? 'Setting up…' : 'Set password & sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
