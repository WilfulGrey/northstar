import { useState } from 'react'
import { PageHeader } from '@/components/Layout'
import { useSyncAirtable, type SyncResult } from '@/lib/api'
import { timeAgo } from '@/lib/format'

const LAST_KEY = 'northstar:lastAirtableSync'

export function Integrations() {
  const sync = useSyncAirtable()
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastAt, setLastAt] = useState<string | null>(() => localStorage.getItem(LAST_KEY))

  async function run() {
    setError(null)
    setResult(null)
    try {
      const res = await sync.mutateAsync()
      setResult(res)
      const now = new Date().toISOString()
      localStorage.setItem(LAST_KEY, now)
      setLastAt(now)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    }
  }

  return (
    <>
      <PageHeader title="Integrations" subtitle="Connect Northstar to the tools your team already uses." />
      <div className="flex-1 overflow-y-auto px-7 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-base">🗂️</span>
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900">Airtable</h2>
                    <p className="text-xs text-zinc-500">Import Objectives, Key Results, Epics and Tasks.</p>
                  </div>
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => void run()} disabled={sync.isPending}>
                {sync.isPending ? 'Syncing…' : 'Sync from Airtable'}
              </button>
            </div>

            <p className="mt-3 text-sm text-zinc-500">
              Pulls the whole hierarchy and upserts it by record id, so re-running is safe. Statuses come across 1:1 —
              a new status in Airtable becomes a new board column. The Airtable token stays server-side in an Edge
              Function.
            </p>
            {lastAt && !result && (
              <p className="mt-2 text-xs text-zinc-400">Last synced {timeAgo(lastAt)}.</p>
            )}

            {error && (
              <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            {result && (
              <div data-testid="sync-result" className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
                <p className="text-sm font-medium text-emerald-800">
                  Synced in {(result.ms / 1000).toFixed(1)}s · {result.statuses} statuses
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
