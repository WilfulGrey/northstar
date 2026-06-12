import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/Layout'
import { ProgressBar } from '@/components/ProgressBar'
import { Avatar } from '@/components/Avatar'
import { EpicStatusBadge } from '@/components/Badges'
import { EmptyState, ErrorState, Spinner } from '@/components/States'
import { EpicModal } from '@/modals/EpicModal'
import { ArchiveToggle, ArchivedTag } from '@/components/Archive'
import { useDeleteEpic, useEpics, useStories, useUpdateEpic } from '@/lib/api'
import { epicProgress, isArchived, pct } from '@/lib/format'
import type { Epic, EpicFull } from '@/lib/types'

export function Epics() {
  const { data: epics, isLoading, error } = useEpics()
  const { data: stories = [] } = useStories()
  const [newOpen, setNewOpen] = useState(false)
  const [edit, setEdit] = useState<Epic | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const del = useDeleteEpic()
  const update = useUpdateEpic()
  const location = useLocation()
  const navigate = useNavigate()

  const visible = (epics ?? []).filter((e) => showArchived || !isArchived(e))

  useEffect(() => {
    if ((location.state as { quickCreate?: string } | null)?.quickCreate === 'epic') {
      setNewOpen(true)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  return (
    <>
      <PageHeader
        title="Epics"
        subtitle="Bodies of work, each linked to the objective it serves."
        action={
          <div className="flex items-center gap-2">
            <ArchiveToggle on={showArchived} onChange={setShowArchived} />
            <button className="btn btn-primary" onClick={() => setNewOpen(true)}>
              + New epic
            </button>
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto px-7 py-6">
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorState error={error} />
        ) : (epics?.length ?? 0) === 0 ? (
          <EmptyState
            title="No epics yet"
            hint="Group related stories into an epic and link it to an objective to keep work aligned."
            action={
              <button className="btn btn-primary" onClick={() => setNewOpen(true)}>
                + New epic
              </button>
            }
          />
        ) : (
          <div className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-2">
            {visible.map((epic) => {
              const prog = epicProgress(epic.id, stories)
              const archived = isArchived(epic)
              return (
                <div key={epic.id} className={`card group p-4 ${archived ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: epic.color }} />
                      <h3 className="truncate text-sm font-semibold text-zinc-900">{epic.title}</h3>
                      {archived && <ArchivedTag />}
                    </div>
                    <EpicStatusBadge status={epic.status} />
                  </div>

                  {epic.description && <p className="mt-1.5 line-clamp-2 text-sm text-zinc-500">{epic.description}</p>}

                  <div className="mt-3 flex items-center gap-3">
                    <ProgressBar ratio={prog.ratio} color={epic.color} />
                    <span className="shrink-0 text-xs font-medium tabular-nums text-zinc-500">
                      {prog.done}/{prog.total} · {pct(prog.ratio)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
                    <ObjectiveLink epic={epic} />
                    <div className="flex items-center gap-1">
                      <button
                        className="btn btn-secondary px-2 py-1 text-xs"
                        onClick={() => navigate(`/board?epic=${epic.id}`)}
                        title="View this epic's tasks on the board"
                      >
                        Tasks →
                      </button>
                      <Avatar profile={epic.owner} size={22} />
                      <button
                        className="btn btn-ghost px-1.5 text-xs opacity-0 transition group-hover:opacity-100"
                        onClick={() => update.mutate({ id: epic.id, archived_at: archived ? null : new Date().toISOString() })}
                      >
                        {archived ? 'Unarchive' : 'Archive'}
                      </button>
                      <button className="btn btn-ghost px-1.5 text-xs opacity-0 transition group-hover:opacity-100" onClick={() => setEdit(epic)}>
                        Edit
                      </button>
                      <button
                        className="btn btn-danger px-1.5 text-xs opacity-0 transition group-hover:opacity-100"
                        onClick={() => {
                          if (confirm(`Delete epic "${epic.title}"? Stories will be kept but unlinked.`)) del.mutate(epic.id)
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {newOpen && <EpicModal open onClose={() => setNewOpen(false)} />}
      {edit && <EpicModal open epic={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function ObjectiveLink({ epic }: { epic: EpicFull }) {
  if (!epic.objective) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        ⚠ Unaligned
      </span>
    )
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-zinc-500" title={epic.key_result ? `${epic.objective.title} · ${epic.key_result.title}` : epic.objective.title}>
      <span className="text-zinc-400">→</span>
      <span className="truncate">{epic.objective.title}</span>
      {epic.key_result && (
        <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-600">
          KR
        </span>
      )}
    </span>
  )
}
