import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'

const DEMO = { email: 'demo@northstar.app', password: 'northstar2026' }

export function Login() {
  const { session, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  async function submit(creds: { email: string; password: string }) {
    setBusy(true)
    setError(null)
    const { error } = await signIn(creds.email, creds.password)
    setBusy(false)
    if (error) {
      setError(error)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="flex h-full items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/star.svg" alt="" className="h-11 w-11" />
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-zinc-900">Welcome to Northstar</h1>
          <p className="mt-1 text-sm text-zinc-500">OKRs meet execution for small product teams.</p>
        </div>

        <form
          className="card space-y-4 p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault()
            void submit({ email, password })
          }}
        >
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="input"
              placeholder="you@team.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setEmail(DEMO.email)
            setPassword(DEMO.password)
            void submit(DEMO)
          }}
          disabled={busy}
          className="btn btn-secondary mt-3 w-full"
        >
          Try the demo workspace →
        </button>
        <p className="mt-3 text-center text-xs text-zinc-400">
          Demo: {DEMO.email} · {DEMO.password}
        </p>
      </div>
    </div>
  )
}
