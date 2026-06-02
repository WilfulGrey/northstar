import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/Layout'
import { ProgressBar } from '@/components/ProgressBar'
import { Avatar } from '@/components/Avatar'
import { ObjectiveStatusBadge } from '@/components/Badges'
import { EmptyState, ErrorState, Spinner } from '@/components/States'
import { ObjectiveModal } from '@/modals/ObjectiveModal'
import { KeyResultModal } from '@/modals/KeyResultModal'
import {
  useDeleteKeyResult,
  useDeleteObjective,
  useObjectives,
  useUpdateKeyResult,
} from '@/lib/api'
import { formatMetric, krProgress, objectiveProgress, pct } from '@/lib/format'
import type { KeyResult, ObjectiveFull } from '@/lib/types'

export function Okrs() {
  const { data: objectives, isLoading, error } = useObjectives()
  const [newOpen, setNewOpen] = useState(false)
  const [edit, setEdit] = useState<ObjectiveFull | null>(null)

  const groups = useMemo(() => groupByCycle(objectives ?? []), [objectives])

  return (
    <>
      <PageHeader
        title="OKRs"
        subtitle="Objectives and the measurable results that define success."
        action={
          <button className="btn btn-primary" onClick={() => setNewOpen(true)}>
            + New objective
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-7 py-6">
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorState error={error} />
        ) : (objectives?.length ?? 0) === 0 ? (
          <EmptyState
            title="No objectives yet"
            hint="Start by defining what success looks like this quarter, then link epics to it."
            action={
              <button className="btn btn-primary" onClick={() => setNewOpen(true)}>
                + New objective
              </button>
            }
          />
        ) : (
          <div className="mx-auto max-w-4xl space-y-8">
            {groups.map((group) => (
              <section key={group.name}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{group.name}</h2>
                <div className="space-y-4">
                  {group.objectives.map((o) => (
                    <ObjectiveCard key={o.id} objective={o} onEdit={() => setEdit(o)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {newOpen && <ObjectiveModal open onClose={() => setNewOpen(false)} />}
      {edit && <ObjectiveModal open objective={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function ObjectiveCard({ objective, onEdit }: { objective: ObjectiveFull; onEdit: () => void }) {
  const [addKr, setAddKr] = useState(false)
  const [editKr, setEditKr] = useState<KeyResult | null>(null)
  const del = useDeleteObjective()
  const progress = objectiveProgress(objective)

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-zinc-900">{objective.title}</h3>
            <ObjectiveStatusBadge status={objective.status} />
          </div>
          {objective.description && <p className="mt-1 text-sm text-zinc-500">{objective.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Avatar profile={objective.owner} size={26} />
          <button className="btn btn-ghost px-2" onClick={onEdit} title="Edit objective">
            Edit
          </button>
          <button
            className="btn btn-danger px-2"
            title="Delete objective"
            onClick={() => {
              if (confirm(`Delete "${objective.title}" and its key results?`)) del.mutate(objective.id)
            }}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="w-16 text-xs font-medium text-zinc-400">Progress</span>
        <ProgressBar ratio={progress} showLabel />
      </div>

      <div className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
        {objective.key_results.length === 0 ? (
          <p className="py-3 text-sm text-zinc-400">No key results yet.</p>
        ) : (
          objective.key_results.map((kr) => <KeyResultRow key={kr.id} kr={kr} onEdit={() => setEditKr(kr)} />)
        )}
      </div>

      <button className="btn btn-ghost mt-2 px-1 text-indigo-600 hover:text-indigo-700" onClick={() => setAddKr(true)}>
        + Add key result
      </button>

      {addKr && <KeyResultModal open objectiveId={objective.id} onClose={() => setAddKr(false)} />}
      {editKr && <KeyResultModal open objectiveId={objective.id} keyResult={editKr} onClose={() => setEditKr(null)} />}
    </div>
  )
}

function KeyResultRow({ kr, onEdit }: { kr: KeyResult; onEdit: () => void }) {
  const update = useUpdateKeyResult()
  const del = useDeleteKeyResult()
  const [value, setValue] = useState(String(kr.current_value))
  const ratio = krProgress({ ...kr, current_value: Number(value) || 0 })

  function commit() {
    const next = Number(value)
    if (Number.isNaN(next) || next === kr.current_value) {
      setValue(String(kr.current_value))
      return
    }
    update.mutate({ id: kr.id, current_value: next })
  }

  return (
    <div className="flex items-center gap-4 py-3" data-testid="kr-row" data-kr-title={kr.title}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-800">{kr.title}</p>
        <div className="mt-1.5 flex items-center gap-3">
          <ProgressBar ratio={ratio} className="max-w-[220px]" />
          <span className="text-xs font-medium tabular-nums text-zinc-500">{pct(ratio)}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-sm text-zinc-500">
        <input
          aria-label={`Current value for ${kr.title}`}
          data-testid="kr-current"
          className="input w-20 px-2 py-1 text-right tabular-nums"
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
        <span className="whitespace-nowrap text-xs text-zinc-400">
          / {formatMetric(kr.target_value, kr.metric, kr.unit)}
        </span>
      </div>
      <div className="flex shrink-0 items-center">
        <button className="btn btn-ghost px-1.5 text-xs" onClick={onEdit}>
          Edit
        </button>
        <button
          className="btn btn-danger px-1.5 text-xs"
          onClick={() => {
            if (confirm(`Delete key result "${kr.title}"?`)) del.mutate(kr.id)
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function groupByCycle(objectives: ObjectiveFull[]): { name: string; objectives: ObjectiveFull[] }[] {
  const map = new Map<string, { name: string; objectives: ObjectiveFull[] }>()
  for (const o of objectives) {
    const name = o.cycle?.name ?? 'No cycle'
    if (!map.has(name)) map.set(name, { name, objectives: [] })
    map.get(name)!.objectives.push(o)
  }
  return [...map.values()]
}
