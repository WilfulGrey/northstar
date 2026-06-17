import { useState } from 'react'
import { PageHeader } from '@/components/Layout'
import { Spinner } from '@/components/States'
import { useDisconnectAirtable, useSyncAirtable, useWorkspace, type SyncResult } from '@/lib/api'
import { timeAgo } from '@/lib/format'

export function Integrations() {
  const { data: ws, isLoading } = useWorkspace()
  const sync = useSyncAirtable()
  const disconnect = useDisconnectAirtable()
  const [token, setToken] = useState('')
  const [baseId, setBaseId] = useState('')
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const connected = !!ws?.airtable_connected

  async function connect() {
    setError(null); setResult(null)
    try {
      setResult(await sync.mutateAsync({ token: token.trim(), baseId: baseId.trim() }))
      setToken('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    }
  }
  async function syncNow() {
    setError(null); setResult(null)
    try {
      setResult(await sync.mutateAsync({}))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    }
  }

  return (
    <>
      <PageHeader title="Integrations" subtitle="Connect this workspace to the tools your team already uses." />
      <div className="flex-1 overflow-y-auto px-7 py-6">
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-base">🗂️</span>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">Airtable</h2>
                  <p className="text-xs text-zinc-500">Objectives, Key Results, Epics, Tasks and Team.</p>
                </div>
              </div>
              {connected && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
                </span>
              )}
            </div>

            {isLoading ? (
              <Spinner />
            ) : connected ? (
              <div data-testid="integration-connected" className="mt-4">
                <p className="text-sm text-zinc-600">
                  Connected to base <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">{ws?.airtable_base_id}</code>.
                  Syncs automatically in the background about every 10 minutes
                  {ws?.last_sync_at ? ` · last synced ${timeAgo(ws.last_sync_at)}` : ''}.
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  The token is stored once for the whole workspace, server-side — teammates don't re-enter it.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button className="btn btn-primary" onClick={() => void syncNow()} disabled={sync.isPending}>
                    {sync.isPending ? 'Syncing…' : 'Sync now'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => void disconnect.mutateAsync()} disabled={disconnect.isPending}>
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => { e.preventDefault(); void connect() }}
              >
                <p className="text-sm text-zinc-500">
                  Connect with an Airtable Personal Access Token and Base ID. It's stored <strong>once for this
                  workspace</strong> (server-side, encrypted at rest) so the whole team benefits and the background
                  job keeps data fresh — no one has to keep the app open. Tables are matched by name.
                </p>
                <div>
                  <label className="label">Airtable Personal Access Token</label>
                  <input aria-label="Airtable token" type="password" autoComplete="off" className="input font-mono" placeholder="pat…" value={token} onChange={(e) => setToken(e.target.value)} />
                </div>
                <div>
                  <label className="label">Base ID</label>
                  <input aria-label="Airtable base id" className="input font-mono" placeholder="app…" value={baseId} onChange={(e) => setBaseId(e.target.value)} />
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="btn btn-primary" disabled={!token.trim() || !baseId.trim() || sync.isPending}>
                    {sync.isPending ? 'Connecting…' : 'Connect & sync from Airtable'}
                  </button>
                </div>
              </form>
            )}

            {error && (
              <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            {result && (
              <div data-testid="sync-result" className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
                <p className="text-sm font-medium text-emerald-800">
                  Synced in {(result.ms / 1000).toFixed(1)}s · {result.statuses} statuses · {result.people} people
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <Tile label="Objectives" r={result.objectives} />
                  <Tile label="Key results" r={result.key_results} />
                  <Tile label="Epics" r={result.epics} />
                  <Tile label="Stories" r={result.stories} />
                  <Tile label="Comments" r={result.comments} />
                </div>
              </div>
            )}
          </div>

          <p className="px-1 text-xs text-zinc-400">
            Sync is one-way (Airtable → Northstar), upserting by record id. More connectors would slot in the same way.
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
      <p className="text-[11px] text-zinc-400">{r.created} new · {r.updated} updated</p>
    </div>
  )
}
