import { useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/Layout'
import { Avatar } from '@/components/Avatar'
import { PriorityIcon } from '@/components/Badges'
import { ErrorState, Spinner } from '@/components/States'
import { StoryModal } from '@/modals/StoryModal'
import { StoryDetail } from '@/components/StoryDetail'
import { useEpics, useProfiles, useStories, useTaskStatuses, useUpdateStory } from '@/lib/api'
import { useAuth } from '@/auth/AuthProvider'
import { ArchiveToggle, ArchivedTag } from '@/components/Archive'
import { displayName, humanizeStatus, isStoryArchived } from '@/lib/format'
import type { StoryFull, TaskStatus } from '@/lib/types'

const NONE = '__none'
const UNASSIGNED = '__unassigned' // assignee-filter sentinel for "nobody"
const CAP = 50 // keep the board responsive even after syncing 1000+ tasks
const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'none'

export function Board() {
  const { data: stories, isLoading, error } = useStories()
  const { data: epics = [] } = useEpics()
  const { data: statuses = [] } = useTaskStatuses()
  const { data: people = [] } = useProfiles()
  const { profile } = useAuth()
  const update = useUpdateStory()

  const [epicFilter, setEpicFilter] = useState('')
  // undefined = "not touched" → defaults to the current user ("Me"); '' = everyone.
  const [assigneeFilter, setAssigneeFilter] = useState<string | undefined>(undefined)
  const me = profile?.id ?? ''
  const assignee = assigneeFilter === undefined ? me : assigneeFilter
  const [showArchived, setShowArchived] = useState(false)
  const [view, setView] = useState<'board' | 'list'>('board')
  const [creating, setCreating] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    if ((location.state as { quickCreate?: string } | null)?.quickCreate === 'story') {
      setCreating(statuses[0]?.name ?? 'backlog')
      window.history.replaceState({}, '')
    }
  }, [location.state, statuses])

  useEffect(() => {
    const param = searchParams.get('story')
    if (!param || !stories) return
    const story = param.toUpperCase().startsWith('NS-')
      ? stories.find((s) => s.ref === Number(param.slice(3)))
      : stories.find((s) => s.id === param)
    if (story) setOpenId(story.id)
  }, [searchParams, stories])

  function closeDrawer() {
    setOpenId(null)
    if (searchParams.has('story')) {
      setSearchParams((prev) => { prev.delete('story'); return prev }, { replace: true })
    }
  }

  const known = useMemo(() => new Set(statuses.map((s) => s.name)), [statuses])
  const matchesAssignee = (s: StoryFull) =>
    !assignee ? true : assignee === UNASSIGNED ? s.assignee_id == null : s.assignee_id === assignee
  const filtered = useMemo(
    () =>
      (stories ?? []).filter(
        (s) =>
          (epicFilter ? s.epic_id === epicFilter : true) &&
          matchesAssignee(s) &&
          (showArchived || !isStoryArchived(s)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stories, epicFilter, assignee, showArchived],
  )
  const byStatus = useMemo(() => {
    const map = new Map<string, StoryFull[]>()
    for (const s of statuses) map.set(s.name, [])
    map.set(NONE, [])
    for (const s of filtered) {
      const col = s.status && known.has(s.status) ? s.status : NONE
      map.get(col)?.push(s)
    }
    return map
  }, [filtered, statuses, known])

  // Render columns in order; only show "No status" if it has cards.
  const columns = useMemo(() => {
    const cols = statuses.map((s) => ({ name: s.name, color: s.color }))
    if ((byStatus.get(NONE)?.length ?? 0) > 0) cols.push({ name: NONE, color: '#d4d4d8' })
    return cols
  }, [statuses, byStatus])

  function moveTo(storyId: string, status: string) {
    if (status === NONE) return
    const story = stories?.find((s) => s.id === storyId)
    if (story && story.status !== status) update.mutate({ id: storyId, status })
  }

  return (
    <>
      <PageHeader
        title="Board"
        subtitle="Drag to move, click to open."
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-zinc-200 p-0.5">
              <button
                data-testid="view-board"
                onClick={() => setView('board')}
                className={`rounded px-2.5 py-1 text-sm ${view === 'board' ? 'bg-zinc-100 font-medium text-zinc-800' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                Board
              </button>
              <button
                data-testid="view-list"
                onClick={() => setView('list')}
                className={`rounded px-2.5 py-1 text-sm ${view === 'list' ? 'bg-zinc-100 font-medium text-zinc-800' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                List
              </button>
            </div>
            <div className="flex items-center">
              <select
                aria-label="Filter by assignee"
                className="input h-8 w-40 py-1 text-sm"
                value={assignee}
                onChange={(e) => setAssigneeFilter(e.target.value)}
              >
                <option value="">All assignees</option>
                <option value={UNASSIGNED}>Unassigned</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id === me ? `Me · ${displayName(p)}` : displayName(p)}
                  </option>
                ))}
              </select>
              {assignee && (
                <button
                  type="button"
                  title="Clear assignee filter"
                  aria-label="Clear assignee filter"
                  onClick={() => setAssigneeFilter('')}
                  className="btn btn-ghost px-1.5"
                >
                  ✕
                </button>
              )}
            </div>
            <select className="input h-8 w-40 py-1 text-sm" value={epicFilter} onChange={(e) => setEpicFilter(e.target.value)}>
              <option value="">All epics</option>
              {epics.map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
            <ArchiveToggle on={showArchived} onChange={setShowArchived} />
            <button className="btn btn-primary" onClick={() => setCreating(statuses[0]?.name ?? 'backlog')}>
              + New story
            </button>
          </div>
        }
      />
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorState error={error} />
        ) : filtered.length === 0 && (stories?.length ?? 0) > 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-zinc-400">
            <p>No tasks match the current filter.</p>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setAssigneeFilter('')
                setEpicFilter('')
              }}
            >
              Show all tasks
            </button>
          </div>
        ) : view === 'list' ? (
          <TasksList stories={filtered} statuses={statuses} onOpen={setOpenId} />
        ) : (
          <div className="scroll-thin flex h-full gap-3 overflow-x-auto px-7 py-5">
            {columns.map((col) => {
              const list = byStatus.get(col.name) ?? []
              const label = col.name === NONE ? 'No status' : humanizeStatus(col.name)
              return (
                <div
                  key={col.name}
                  data-testid={`column-${slug(col.name)}`}
                  className="flex h-full w-72 shrink-0 flex-col rounded-xl bg-zinc-100/70"
                  onDragOver={(e) => { if (dragId) e.preventDefault() }}
                  onDrop={() => { if (dragId) moveTo(dragId, col.name); setDragId(null) }}
                >
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: col.color ?? '#d4d4d8' }} />
                      <span className="truncate text-sm font-medium text-zinc-700" title={label}>{label}</span>
                      <span className="shrink-0 text-xs text-zinc-400">{list.length}</span>
                    </div>
                    {col.name !== NONE && (
                      <button
                        className="btn btn-ghost px-1.5 py-0.5 text-base leading-none"
                        title={`New story in ${label}`}
                        onClick={() => setCreating(col.name)}
                      >
                        +
                      </button>
                    )}
                  </div>

                  <div className="scroll-thin flex-1 space-y-2 overflow-y-auto px-2 pb-3">
                    {list.slice(0, CAP).map((story) => (
                      <StoryCard
                        key={story.id}
                        story={story}
                        onOpen={() => setOpenId(story.id)}
                        onDragStart={() => setDragId(story.id)}
                        onDragEnd={() => setDragId(null)}
                      />
                    ))}
                    {list.length > CAP && (
                      <p className="px-1 py-2 text-center text-xs text-zinc-400">+{list.length - CAP} more</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {creating && <StoryModal open defaultStatus={creating} defaultEpicId={epicFilter} onClose={() => setCreating(null)} />}
      {openId && <StoryDetail storyId={openId} onClose={closeDrawer} />}
    </>
  )
}

function StoryCard({
  story,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  story: StoryFull
  onOpen: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const archived = isStoryArchived(story)
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }}
      data-testid="story-card"
      data-story-title={story.title}
      className={`card cursor-pointer p-3 shadow-sm transition hover:border-indigo-300 hover:shadow ${archived ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug text-zinc-800">{story.title}</p>
        <PriorityIcon priority={story.priority} />
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[11px] text-zinc-400">NS-{story.ref}</span>
          {archived && <ArchivedTag />}
          {story.epic && (
            <span className="inline-flex min-w-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-zinc-600" style={{ backgroundColor: `${story.epic.color}1a` }}>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: story.epic.color }} />
              <span className="truncate">{story.epic.title}</span>
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {story.estimate != null && (
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">{story.estimate}</span>
          )}
          <Avatar profile={story.assignee} size={20} />
        </div>
      </div>
    </div>
  )
}

function TasksList({
  stories,
  statuses,
  onOpen,
}: {
  stories: StoryFull[]
  statuses: TaskStatus[]
  onOpen: (id: string) => void
}) {
  const pos = new Map(statuses.map((s) => [s.name, s.position]))
  const color = new Map(statuses.map((s) => [s.name, s.color]))
  const sorted = [...stories].sort((a, b) => {
    const pa = a.status ? pos.get(a.status) ?? 999 : 1000
    const pb = b.status ? pos.get(b.status) ?? 999 : 1000
    return pa - pb || a.ref - b.ref
  })

  return (
    <div className="h-full overflow-y-auto px-7 py-5">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-xs font-medium text-zinc-500">
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-2 py-2.5 font-medium">Task</th>
              <th className="px-2 py-2.5 font-medium">Epic</th>
              <th className="px-2 py-2.5 text-center font-medium">Pri</th>
              <th className="px-2 py-2.5 text-center font-medium">Est</th>
              <th className="px-4 py-2.5 font-medium">Assignee</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr
                key={s.id}
                data-testid="task-row"
                data-story-title={s.title}
                onClick={() => onOpen(s.id)}
                className={`cursor-pointer border-b border-zinc-50 last:border-0 hover:bg-zinc-50 ${isStoryArchived(s) ? 'opacity-60' : ''}`}
              >
                <td className="whitespace-nowrap px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-xs text-zinc-600">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: (s.status ? color.get(s.status) : null) ?? '#d4d4d8' }} />
                    {humanizeStatus(s.status)}
                  </span>
                </td>
                <td className="px-2 py-2.5">
                  <span className="font-mono text-[11px] text-zinc-400">NS-{s.ref}</span>{' '}
                  <span className="text-zinc-800">{s.title}</span>
                  {isStoryArchived(s) && <ArchivedTag className="ml-2 align-middle" />}
                </td>
                <td className="max-w-[180px] truncate px-2 py-2.5 text-xs text-zinc-500">{s.epic?.title ?? '—'}</td>
                <td className="px-2 py-2.5 text-center"><PriorityIcon priority={s.priority} /></td>
                <td className="px-2 py-2.5 text-center text-xs text-zinc-500">{s.estimate ?? ''}</td>
                <td className="px-4 py-2.5"><Avatar profile={s.assignee} size={22} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && <p className="px-4 py-8 text-center text-sm text-zinc-400">No tasks.</p>}
      </div>
    </div>
  )
}
