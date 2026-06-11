import { useMemo } from 'react'
import { Drawer } from './Drawer'
import { ProgressBar } from './ProgressBar'
import { Avatar } from './Avatar'
import { ObjectiveStatusBadge, EpicStatusBadge, StoryStatusDot } from './Badges'
import { useEpics, useObjectives, useStories } from '@/lib/api'
import { epicProgress, isCanceledStory, isDoneStory, keyResultWork, krProgress, objectiveProgress, pct } from '@/lib/format'
import type { ObjectiveFull } from '@/lib/types'

export function ObjectiveDetail({ objective, onClose }: { objective: ObjectiveFull; onClose: () => void }) {
  const { data: objectives = [] } = useObjectives()
  const { data: epics = [] } = useEpics()
  const { data: stories = [] } = useStories()

  const obj = useMemo(() => objectives.find((o) => o.id === objective.id) ?? objective, [objectives, objective])

  const krIds = useMemo(() => new Set(obj.key_results.map((k) => k.id)), [obj])
  const servingEpics = useMemo(
    () => epics.filter((e) => e.objective_id === obj.id || (e.key_result_id != null && krIds.has(e.key_result_id))),
    [epics, obj.id, krIds],
  )
  const scope = useMemo(() => {
    const epicIds = new Set(servingEpics.map((e) => e.id))
    const contributing = stories.filter(
      (s) =>
        !isCanceledStory(s) &&
        ((s.epic_id != null && epicIds.has(s.epic_id)) || (s.key_result_id != null && krIds.has(s.key_result_id))),
    )
    const done = contributing.filter(isDoneStory).length
    return { contributing, done, total: contributing.length, ratio: contributing.length ? done / contributing.length : 0 }
  }, [servingEpics, stories, krIds])

  return (
    <Drawer open onClose={onClose} maxWidth={640}>
      <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Objective</span>
        <button className="btn btn-ghost px-2" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">{obj.title}</h2>
            {obj.description && <p className="mt-1 text-sm text-zinc-500">{obj.description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ObjectiveStatusBadge status={obj.status} />
            <Avatar profile={obj.owner} size={28} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-xs font-medium text-zinc-500">Objective progress (lagging)</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{pct(objectiveProgress(obj))}</p>
            <p className="mt-0.5 text-xs text-zinc-400">mean of {obj.key_results.length} key results</p>
            <ProgressBar ratio={objectiveProgress(obj)} className="mt-2" />
          </div>
          <div className="card p-4" data-testid="objective-leading">
            <p className="text-xs font-medium text-zinc-500">Work done (leading)</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-indigo-600">{pct(scope.ratio)}</p>
            <p className="mt-0.5 text-xs text-zinc-400">{scope.done}/{scope.total} contributing stories done</p>
            <ProgressBar ratio={scope.ratio} className="mt-2" />
          </div>
        </div>

        <div className="mt-5">
          <p className="label">Key results</p>
          <div className="card divide-y divide-zinc-100">
            {obj.key_results.length === 0 ? (
              <p className="p-3 text-sm text-zinc-400">No key results.</p>
            ) : (
              obj.key_results.map((kr) => {
                const lead = keyResultWork(kr.id, stories, epics)
                return (
                  <div key={kr.id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-800">{kr.title}</p>
                      <ProgressBar ratio={krProgress(kr)} className="mt-1.5 max-w-[260px]" />
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium tabular-nums text-zinc-700">{pct(krProgress(kr))}</p>
                      <p className="text-[11px] text-zinc-400">{lead.done}/{lead.total} done</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="mt-5">
          <p className="label">Epics serving this objective ({servingEpics.length})</p>
          {servingEpics.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-sm text-zinc-400">
              No epics linked yet.
            </p>
          ) : (
            <div className="space-y-2">
              {servingEpics.map((e) => {
                const prog = epicProgress(e.id, stories)
                return (
                  <div key={e.id} className="card flex items-center gap-3 p-3">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800">{e.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-500">{prog.done}/{prog.total}</span>
                    <EpicStatusBadge status={e.status} />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="mt-5">
          <p className="label">Contributing stories ({scope.contributing.length})</p>
          <ul className="divide-y divide-zinc-100">
            {scope.contributing.slice(0, 12).map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <StoryStatusDot status={s.status} color={s.status_info?.color} />
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">{s.title}</span>
                <span className="shrink-0 font-mono text-[11px] text-zinc-400">NS-{s.ref}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Drawer>
  )
}
