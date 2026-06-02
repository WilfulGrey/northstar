import { useMemo } from 'react'
import { Drawer } from './Drawer'
import { ProgressBar } from './ProgressBar'
import { StoryStatusDot } from './Badges'
import { useEpics, useStories } from '@/lib/api'
import { formatMetric, keyResultWork, krProgress, pct } from '@/lib/format'
import type { KeyResult } from '@/lib/types'

export function KeyResultDetail({ keyResult, onClose }: { keyResult: KeyResult; onClose: () => void }) {
  const { data: stories = [] } = useStories()
  const { data: epics = [] } = useEpics()

  const epicIds = useMemo(
    () => new Set(epics.filter((e) => e.key_result_id === keyResult.id).map((e) => e.id)),
    [epics, keyResult.id],
  )
  const contributing = useMemo(
    () =>
      stories.filter(
        (s) => s.key_result_id === keyResult.id || (s.epic_id != null && epicIds.has(s.epic_id)),
      ),
    [stories, epicIds, keyResult.id],
  )

  const lagging = krProgress(keyResult)
  const leading = keyResultWork(keyResult.id, stories, epics)

  return (
    <Drawer open onClose={onClose} maxWidth={520}>
      <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Key result</span>
        <button className="btn btn-ghost px-2" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <h2 className="text-base font-semibold text-zinc-900">{keyResult.title}</h2>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-xs font-medium text-zinc-500">Result (lagging)</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{pct(lagging)}</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {formatMetric(keyResult.current_value, keyResult.metric, keyResult.unit)} /{' '}
              {formatMetric(keyResult.target_value, keyResult.metric, keyResult.unit)}
            </p>
            <ProgressBar ratio={lagging} className="mt-2" />
          </div>
          <div className="card p-4" data-testid="kr-leading">
            <p className="text-xs font-medium text-zinc-500">Work done (leading)</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-indigo-600">{pct(leading.ratio)}</p>
            <p className="mt-0.5 text-xs text-zinc-400">{leading.done}/{leading.total} stories done</p>
            <ProgressBar ratio={leading.ratio} className="mt-2" />
          </div>
        </div>

        <p className="mt-3 text-xs text-zinc-400">
          The leading indicator shows whether the work meant to move this metric is actually getting done — often the
          earliest signal that a result is on or off track.
        </p>

        <div className="mt-5">
          <p className="label">Contributing work ({contributing.length})</p>
          {contributing.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-sm text-zinc-400">
              No stories linked yet. Link a story directly, or an epic to this key result.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {contributing.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2">
                  <StoryStatusDot status={s.status} />
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">{s.title}</span>
                  <span className="shrink-0 font-mono text-[11px] text-zinc-400">NS-{s.ref}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Drawer>
  )
}
