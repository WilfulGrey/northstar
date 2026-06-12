import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { PageHeader } from '@/components/Layout'
import { ProgressBar } from '@/components/ProgressBar'
import { Sparkline } from '@/components/Sparkline'
import { Avatar } from '@/components/Avatar'
import { ObjectiveStatusBadge } from '@/components/Badges'
import { EmptyState, ErrorState, Spinner } from '@/components/States'
import { ObjectiveModal } from '@/modals/ObjectiveModal'
import { KeyResultModal } from '@/modals/KeyResultModal'
import { KeyResultDetail } from '@/components/KeyResultDetail'
import { ObjectiveDetail } from '@/components/ObjectiveDetail'
import { ArchiveToggle, ArchivedTag } from '@/components/Archive'
import {
  useAllCheckins,
  useDeleteKeyResult,
  useDeleteObjective,
  useObjectives,
  useUpdateKeyResult,
  useUpdateObjective,
} from '@/lib/api'
import { formatMetric, isArchived, krProgress, objectiveProgress, pct, timeAgo } from '@/lib/format'
import type { KeyResult, ObjectiveFull } from '@/lib/types'

export function Okrs() {
  const { data: objectives, isLoading, error } = useObjectives()
  const { data: allCheckins = [] } = useAllCheckins()
  const [newOpen, setNewOpen] = useState(false)
  const [edit, setEdit] = useState<ObjectiveFull | null>(null)
  const [detailKr, setDetailKr] = useState<KeyResult | null>(null)
  const [detailObj, setDetailObj] = useState<ObjectiveFull | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const state = location.state as { quickCreate?: string; openObjective?: string } | null
    if (state?.quickCreate === 'objective') {
      setNewOpen(true)
      window.history.replaceState({}, '')
    }
    if (state?.openObjective && objectives) {
      const found = objectives.find((o) => o.id === state.openObjective)
      if (found) setDetailObj(found)
      window.history.replaceState({}, '')
    }
  }, [location.state, objectives])

  const groups = useMemo(
    () => groupByCycle((objectives ?? []).filter((o) => showArchived || !isArchived(o))),
    [objectives, showArchived],
  )
  const checkinsByKr = useMemo(() => {
    const m = new Map<string, number[]>()
    for (const c of allCheckins) {
      if (!m.has(c.key_result_id)) m.set(c.key_result_id, [])
      m.get(c.key_result_id)!.push(c.value)
    }
    return m
  }, [allCheckins])

  return (
    <>
      <PageHeader
        title="OKRs"
        subtitle="Objectives and the measurable results that define success."
        action={
          <div className="flex items-center gap-2">
            <ArchiveToggle on={showArchived} onChange={setShowArchived} />
            <button className="btn btn-primary" onClick={() => setNewOpen(true)}>
              + New objective
            </button>
          </div>
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
                    <ObjectiveCard
                      key={o.id}
                      objective={o}
                      onEdit={() => setEdit(o)}
                      onOpenKr={setDetailKr}
                      onOpenDetail={() => setDetailObj(o)}
                      checkinsByKr={checkinsByKr}
                      showArchived={showArchived}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {newOpen && <ObjectiveModal open onClose={() => setNewOpen(false)} />}
      {edit && <ObjectiveModal open objective={edit} onClose={() => setEdit(null)} />}
      {detailKr && <KeyResultDetail keyResult={detailKr} onClose={() => setDetailKr(null)} />}
      {detailObj && <ObjectiveDetail objective={detailObj} onClose={() => setDetailObj(null)} />}
    </>
  )
}

function ObjectiveCard({
  objective,
  onEdit,
  onOpenKr,
  onOpenDetail,
  checkinsByKr,
  showArchived,
}: {
  objective: ObjectiveFull
  onEdit: () => void
  onOpenKr: (kr: KeyResult) => void
  onOpenDetail: () => void
  checkinsByKr: Map<string, number[]>
  showArchived: boolean
}) {
  const [addKr, setAddKr] = useState(false)
  const [editKr, setEditKr] = useState<KeyResult | null>(null)
  const del = useDeleteObjective()
  const update = useUpdateObjective()
  const progress = objectiveProgress(objective)
  const archived = isArchived(objective)
  const krs = objective.key_results.filter((kr) => showArchived || !isArchived(kr))

  return (
    <div className={`card p-5 ${archived ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button className="text-left text-base font-semibold text-zinc-900 hover:text-indigo-600" onClick={onOpenDetail} title="View rollup">
              {objective.title}
            </button>
            <ObjectiveStatusBadge status={objective.status} />
            {archived && <ArchivedTag />}
          </div>
          {objective.description && <p className="mt-1 text-sm text-zinc-500">{objective.description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Avatar profile={objective.owner} size={26} />
          <button
            className="btn btn-ghost px-2"
            onClick={() => update.mutate({ id: objective.id, archived_at: archived ? null : new Date().toISOString() })}
            title={archived ? 'Unarchive objective' : 'Archive objective'}
          >
            {archived ? 'Unarchive' : 'Archive'}
          </button>
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
        {krs.length === 0 ? (
          <p className="py-3 text-sm text-zinc-400">No key results yet.</p>
        ) : (
          krs.map((kr) => (
            <KeyResultRow
              key={kr.id}
              kr={kr}
              history={checkinsByKr.get(kr.id) ?? []}
              onEdit={() => setEditKr(kr)}
              onOpenDetail={() => onOpenKr(kr)}
            />
          ))
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

function KeyResultRow({
  kr,
  history,
  onEdit,
  onOpenDetail,
}: {
  kr: KeyResult
  history: number[]
  onEdit: () => void
  onOpenDetail: () => void
}) {
  const update = useUpdateKeyResult()
  const del = useDeleteKeyResult()
  const [value, setValue] = useState(String(kr.current_value))
  const ratio = krProgress({ ...kr, current_value: Number(value) || 0 })
  const archived = isArchived(kr)

  function commit() {
    const next = Number(value)
    if (Number.isNaN(next) || next === kr.current_value) {
      setValue(String(kr.current_value))
      return
    }
    update.mutate({ id: kr.id, current_value: next })
  }

  return (
    <div className={`flex items-center gap-4 py-3 ${archived ? 'opacity-60' : ''}`} data-testid="kr-row" data-kr-title={kr.title}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <button
            className="truncate rounded text-left text-sm font-medium text-zinc-800 hover:text-indigo-600"
            onClick={onOpenDetail}
            title="View contributing work"
          >
            {kr.title}
          </button>
          {archived && <ArchivedTag />}
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          <ProgressBar ratio={ratio} className="max-w-[220px]" />
          <span className="text-xs font-medium tabular-nums text-zinc-500">{pct(ratio)}</span>
          <span className="hidden text-xs text-zinc-400 sm:inline">· updated {timeAgo(kr.updated_at)}</span>
        </div>
      </div>
      {history.length >= 2 && (
        <span className="hidden md:block" data-testid="kr-sparkline" title="Check-in trend">
          <Sparkline values={history} />
        </span>
      )}
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
        <button
          className="btn btn-ghost px-1.5 text-xs"
          onClick={() => update.mutate({ id: kr.id, archived_at: archived ? null : new Date().toISOString() })}
        >
          {archived ? 'Unarchive' : 'Archive'}
        </button>
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
