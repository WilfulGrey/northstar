import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/Layout'
import { ProgressBar } from '@/components/ProgressBar'
import { Avatar } from '@/components/Avatar'
import { ObjectiveStatusBadge, PriorityIcon } from '@/components/Badges'
import { ErrorState, Spinner } from '@/components/States'
import { StoryModal } from '@/modals/StoryModal'
import { useAuth } from '@/auth/AuthProvider'
import { useEpics, useObjectives, useStories } from '@/lib/api'
import { alignment, displayName, objectiveProgress, pct } from '@/lib/format'
import { ACTIVE_STORY_STATUSES, type StoryFull } from '@/lib/types'

export function Dashboard() {
  const { profile } = useAuth()
  const objectivesQ = useObjectives()
  const epicsQ = useEpics()
  const storiesQ = useStories()
  const [openStory, setOpenStory] = useState<StoryFull | null>(null)

  const objectives = objectivesQ.data ?? []
  const epics = epicsQ.data ?? []
  const stories = storiesQ.data ?? []

  const loading = objectivesQ.isLoading || epicsQ.isLoading || storiesQ.isLoading
  const error = objectivesQ.error || epicsQ.error || storiesQ.error

  const align = useMemo(() => alignment(stories, epics), [stories, epics])
  const avgProgress = useMemo(
    () => (objectives.length ? objectives.reduce((a, o) => a + objectiveProgress(o), 0) / objectives.length : 0),
    [objectives],
  )
  const epicToObjective = useMemo(() => new Map(epics.map((e) => [e.id, e.objective_id])), [epics])
  const unaligned = useMemo(
    () =>
      stories.filter(
        (s) =>
          ACTIVE_STORY_STATUSES.includes(s.status) &&
          s.key_result_id == null &&
          (s.epic_id == null || epicToObjective.get(s.epic_id) == null),
      ),
    [stories, epicToObjective],
  )
  const activeCount = stories.filter((s) => ACTIVE_STORY_STATUSES.includes(s.status)).length

  return (
    <>
      <PageHeader
        title={`Welcome back, ${displayName(profile).split(' ')[0]}`}
        subtitle="How strategy and execution line up right now."
      />
      <div className="flex-1 overflow-y-auto px-7 py-6">
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorState error={error} />
        ) : (
          <div className="mx-auto max-w-5xl space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Objectives" value={String(objectives.length)} hint="this workspace" />
              <Stat label="Avg OKR progress" value={pct(avgProgress)} hint="across objectives" />
              <Stat label="Work aligned" value={pct(align.ratio)} hint={`${align.aligned}/${align.total} active stories`} emphasis />
              <Stat label="In flight" value={String(activeCount)} hint="stories in progress" />
            </div>

            <div className="grid gap-6 lg:grid-cols-5">
              {/* Objectives */}
              <section className="lg:col-span-3">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-700">Objectives</h2>
                  <Link to="/okrs" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                    View OKRs →
                  </Link>
                </div>
                <div className="card divide-y divide-zinc-100">
                  {objectives.length === 0 ? (
                    <p className="p-4 text-sm text-zinc-400">No objectives yet.</p>
                  ) : (
                    objectives.map((o) => (
                      <div key={o.id} className="flex items-center gap-4 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-zinc-800">{o.title}</p>
                            <ObjectiveStatusBadge status={o.status} />
                          </div>
                          <div className="mt-2 max-w-md">
                            <ProgressBar ratio={objectiveProgress(o)} showLabel />
                          </div>
                        </div>
                        <Avatar profile={o.owner} size={26} />
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Alignment */}
              <section className="lg:col-span-2">
                <h2 className="mb-2 text-sm font-semibold text-zinc-700">Alignment</h2>
                <div className="card p-5">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-semibold tracking-tight text-zinc-900" data-testid="alignment-pct">
                        {pct(align.ratio)}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {align.aligned} of {align.total} active stories drive an objective.
                      </p>
                    </div>
                  </div>
                  <ProgressBar ratio={align.ratio} className="mt-4" />

                  <div className="mt-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Unaligned work in flight ({unaligned.length})
                    </p>
                    {unaligned.length === 0 ? (
                      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        🎉 Everything in progress maps to a goal.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {unaligned.slice(0, 6).map((s) => (
                          <li key={s.id}>
                            <button
                              onClick={() => setOpenStory(s)}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-600 hover:bg-zinc-50"
                            >
                              <PriorityIcon priority={s.priority} />
                              <span className="truncate">{s.title}</span>
                              <span className="ml-auto shrink-0 font-mono text-[11px] text-zinc-400">NS-{s.ref}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {unaligned.length > 0 && (
                      <p className="mt-2 text-xs text-zinc-400">Open a story to link it to an epic or key result.</p>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>

      {openStory && <StoryModal open story={openStory} onClose={() => setOpenStory(null)} />}
    </>
  )
}

function Stat({ label, value, hint, emphasis }: { label: string; value: string; hint?: string; emphasis?: boolean }) {
  return (
    <div className={`card p-4 ${emphasis ? 'ring-1 ring-indigo-100' : ''}`}>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${emphasis ? 'text-indigo-600' : 'text-zinc-900'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-400">{hint}</p>}
    </div>
  )
}
