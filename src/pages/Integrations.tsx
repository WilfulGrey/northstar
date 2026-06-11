import { useState } from 'react'
import { PageHeader } from '@/components/Layout'
import { useSyncAirtable, type SyncResult } from '@/lib/api'

const BASE_KEY = 'northstar:airtableBaseId'

export function Integrations() {
  const sync = useSyncAirtable()
  const [token, setToken] = useState('')
  const [baseId, setBaseId] = useState(() => localStorage.getItem(BASE_KEY) ?? '')
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setError(null)
    setResult(null)
    try {
      const res = await sync.mutateAsync({ token: token.trim(), baseId: baseId.trim() })
      setResult(res)
      localStorage.setItem(BASE_KEY, baseId.trim()) // base id is not secret; remember it
      setToken('') // never keep the token around
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    }
  }

  const canSync = token.trim().length > 0 && baseId.trim().length > 0 && !sync.isPending

  return (
    <>
      <PageHeader title="Integrations" subtitle="Connect this workspace to the tools your team already uses." />
      <div className="flex-1 overflow-y-auto px-7 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-base">🗂️</span>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Airtable</h2>
                <p className="text-xs text-zinc-500">Import Objectives, Key Results, Epics, Tasks and Team.</p>
              </div>
            </div>

            <p className="mt-3 text-sm text-zinc-500">
              Bring your <strong>own</strong> Airtable Personal Access Token and Base ID — the sync pulls into{' '}
              <em>this</em> workspace only. Tables are matched by name (Objectives, Key Results, Epics, Tasks, Team).
              Statuses come across 1:1, so a new status in Airtable becomes a new board column. The token is sent over
              HTTPS to a server-side function and is <strong>never stored</strong>.
            </p>

            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                void run()
              }}
            >
              <div>
                <label className="label">Airtable Personal Access Token</label>
                <input
                  aria-label="Airtable token"
                  type="password"
                  autoComplete="off"
                  className="input font-mono"
                  placeholder="pat…"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Base ID</label>
                <input
                  aria-label="Airtable base id"
                  className="input font-mono"
                  placeholder="app…"
                  value={baseId}
                  onChange={(e) => setBaseId(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn btn-primary" disabled={!canSync}>
                  {sync.isPending ? 'Syncing…' : 'Sync from Airtable'}
                </button>
              </div>
            </form>

            {error && (
              <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            {result && (
              <div data-testid="sync-result" className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
                <p className="text-sm font-medium text-emerald-800">
                  Synced in {(result.ms / 1000).toFixed(1)}s · {result.statuses} statuses · {result.people} people
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Tile label="Objectives" r={result.objectives} />
                  <Tile label="Key results" r={result.key_results} />
                  <Tile label="Epics" r={result.epics} />
                  <Tile label="Stories" r={result.stories} />
                </div>
                {result.key_results.skipped > 0 && (
                  <p className="mt-2 text-xs text-zinc-500">
                    {result.key_results.skipped} key results skipped (no linked objective).
                  </p>
                )}
              </div>
            )}
          </div>

          <p className="px-1 text-xs text-zinc-400">
            More connectors (Linear, Jira, GitHub) would slot in here the same way — a server-side function and an
            upsert keyed by an external id.
          </p>
        </div>
      </div>
    </>
  )
}

function Tile({ label, r }: { label: string; r: { created: number; updated: number; total: number } }) {
  return (
    <div className="rounded-lg bg-white p-3 ring-1 ring-zinc-100">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tracking-tight text-zinc-900">{r.total}</p>
      <p className="text-[11px] text-zinc-400">
        {r.created} new · {r.updated} updated
      </p>
    </div>
  )
}
