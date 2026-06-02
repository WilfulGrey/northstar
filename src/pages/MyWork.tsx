import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/Layout'
import { ProgressBar } from '@/components/ProgressBar'
import { PriorityIcon } from '@/components/Badges'
import { EmptyState, ErrorState, Spinner } from '@/components/States'
import { StoryDetail } from '@/components/StoryDetail'
import { useAuth } from '@/auth/AuthProvider'
import { useEpics, useObjectives, useStories } from '@/lib/api'
import { epicAlignmentMap, isStoryAligned, objectiveProgress } from '@/lib/format'
import { ACTIVE_STORY_STATUSES, BOARD_COLUMNS, STORY_STATUS, type StoryFull, type StoryStatus } from '@/lib/types'

export function MyWork() {
  const { user } = useAuth()
  const storiesQ = useStories()
  const { data: epics = [] } = useEpics()
  const { data: objectives = [] } = useObjectives()
  const [openId, setOpenId] = useState<string | null>(null)

  const uid = user?.id
  const stories = storiesQ.data ?? []
  const epicAligned = useMemo(() => epicAlignmentMap(epics), [epics])

  const mine = useMemo(() => stories.filter((s) => s.assignee_id === uid), [stories, uid])
  const byStatus = useMemo(() => {
    const map = new Map<StoryStatus, StoryFull[]>()
    for (const status of BOARD_COLUMNS) map.set(status, [])
    for (const s of mine) map.get(s.status)?.push(s)
    return map
  }, [mine])
  const myObjectives = useMemo(() => objectives.filter((o) => o.owner_id === uid), [objectives, uid])

  const activeMine = mine.filter((s) => ACTIVE_STORY_STATUSES.includes(s.status))

  return (
    <>
      <PageHeader title="My Work" subtitle="Everything assigned to you, and the goals you own." />
      <div className="flex-1 overflow-y-auto px-7 py-6">
        {storiesQ.isLoading ? (
          <Spinner />
        ) : storiesQ.error ? (
          <ErrorState error={storiesQ.error} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-8">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Assigned" value={String(mine.length)} />
              <Stat label="In flight" value={String(activeMine.length)} />
              <Stat label="Objectives owned" value={String(myObjectives.length)} />
            </div>

            <section>
              <h2 className="mb-2 text-sm font-semibold text-zinc-700">Assigned to me</h2>
              {mine.length === 0 ? (
                <EmptyState title="Nothing assigned to you" hint="Stories you're assigned will show up here, grouped by status." />
              ) : (
                <div className="space-y-5">
                  {BOARD_COLUMNS.map((status) => {
                    const list = byStatus.get(status) ?? []
                    if (list.length === 0) return null
                    return (
                      <div key={status}>
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${STORY_STATUS[status].dot}`} />
                          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            {STORY_STATUS[status].label}
                          </span>
                          <span className="text-xs text-zinc-400">{list.length}</span>
                        </div>
                        <div className="card divide-y divide-zinc-100">
                          {list.map((s) => {
                            const aligned = isStoryAligned(s, epicAligned)
                            const flagUnaligned = ACTIVE_STORY_STATUSES.includes(s.status) && !aligned
                            return (
                              <button
                                key={s.id}
                                onClick={() => setOpenId(s.id)}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50"
                              >
                                <PriorityIcon priority={s.priority} />
                                <span className="min-w-0 flex-1 truncate text-sm text-zinc-800">{s.title}</span>
                                {flagUnaligned && (
                                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                    Unaligned
                                  </span>
                                )}
                                {s.epic && (
                                  <span
                                    className="hidden shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-zinc-600 sm:inline-flex"
                                    style={{ backgroundColor: `${s.epic.color}1a` }}
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.epic.color }} />
                                    {s.epic.title}
                                  </span>
                                )}
                                <span className="shrink-0 font-mono text-[11px] text-zinc-400">NS-{s.ref}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {myObjectives.length > 0 && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-700">Objectives I own</h2>
                  <Link to="/okrs" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                    View OKRs →
                  </Link>
                </div>
                <div className="card divide-y divide-zinc-100">
                  {myObjectives.map((o) => (
                    <div key={o.id} className="flex items-center gap-4 p-4">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800">{o.title}</span>
                      <div className="w-40">
                        <ProgressBar ratio={objectiveProgress(o)} showLabel />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {openId && <StoryDetail storyId={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">{value}</p>
    </div>
  )
}
