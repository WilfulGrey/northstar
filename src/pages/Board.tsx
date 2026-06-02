import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { PageHeader } from '@/components/Layout'
import { Avatar } from '@/components/Avatar'
import { PriorityIcon } from '@/components/Badges'
import { ErrorState, Spinner } from '@/components/States'
import { StoryModal } from '@/modals/StoryModal'
import { StoryDetail } from '@/components/StoryDetail'
import { useEpics, useStories, useUpdateStory } from '@/lib/api'
import { BOARD_COLUMNS, STORY_STATUS, type StoryFull, type StoryStatus } from '@/lib/types'

export function Board() {
  const { data: stories, isLoading, error } = useStories()
  const { data: epics = [] } = useEpics()
  const update = useUpdateStory()

  const [epicFilter, setEpicFilter] = useState('')
  const [creating, setCreating] = useState<StoryStatus | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const location = useLocation()

  // Quick-create from the command palette.
  useEffect(() => {
    if ((location.state as { quickCreate?: string } | null)?.quickCreate === 'story') {
      setCreating('backlog')
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const filtered = useMemo(
    () => (stories ?? []).filter((s) => (epicFilter ? s.epic_id === epicFilter : true)),
    [stories, epicFilter],
  )

  const byStatus = useMemo(() => {
    const map: Record<StoryStatus, StoryFull[]> = {
      backlog: [], todo: [], in_progress: [], in_review: [], done: [], canceled: [],
    }
    for (const s of filtered) map[s.status]?.push(s)
    return map
  }, [filtered])

  function moveTo(storyId: string, status: StoryStatus) {
    const story = stories?.find((s) => s.id === storyId)
    if (story && story.status !== status) update.mutate({ id: storyId, status })
  }

  return (
    <>
      <PageHeader
        title="Board"
        subtitle="Every story, by status. Drag to move, click to open."
        action={
          <div className="flex items-center gap-2">
            <select className="input h-8 w-44 py-1 text-sm" value={epicFilter} onChange={(e) => setEpicFilter(e.target.value)}>
              <option value="">All epics</option>
              {epics.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={() => setCreating('backlog')}>
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
        ) : (
          <div className="scroll-thin flex h-full gap-3 overflow-x-auto px-7 py-5">
            {BOARD_COLUMNS.map((status) => (
              <div
                key={status}
                data-testid={`column-${status}`}
                className="flex h-full w-72 shrink-0 flex-col rounded-xl bg-zinc-100/70"
                onDragOver={(e) => {
                  if (dragId) e.preventDefault()
                }}
                onDrop={() => {
                  if (dragId) moveTo(dragId, status)
                  setDragId(null)
                }}
              >
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${STORY_STATUS[status].dot}`} />
                    <span className="text-sm font-medium text-zinc-700">{STORY_STATUS[status].label}</span>
                    <span className="text-xs text-zinc-400">{byStatus[status].length}</span>
                  </div>
                  <button
                    className="btn btn-ghost px-1.5 py-0.5 text-base leading-none"
                    title={`New story in ${STORY_STATUS[status].label}`}
                    onClick={() => setCreating(status)}
                  >
                    +
                  </button>
                </div>

                <div className="scroll-thin flex-1 space-y-2 overflow-y-auto px-2 pb-3">
                  {byStatus[status].map((story) => (
                    <StoryCard
                      key={story.id}
                      story={story}
                      onOpen={() => setOpenId(story.id)}
                      onDragStart={() => setDragId(story.id)}
                      onDragEnd={() => setDragId(null)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {creating && <StoryModal open defaultStatus={creating} defaultEpicId={epicFilter} onClose={() => setCreating(null)} />}
      {openId && <StoryDetail storyId={openId} onClose={() => setOpenId(null)} />}
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
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen()
      }}
      data-testid="story-card"
      data-story-title={story.title}
      className="card cursor-pointer p-3 shadow-sm transition hover:border-indigo-300 hover:shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug text-zinc-800">{story.title}</p>
        <PriorityIcon priority={story.priority} />
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[11px] text-zinc-400">NS-{story.ref}</span>
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
