import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Drawer } from './Drawer'
import { Avatar } from './Avatar'
import { Spinner } from './States'
import { useAuth } from '@/auth/AuthProvider'
import {
  keys,
  useActivity,
  useAddComment,
  useComments,
  useDeleteComment,
  useDeleteStory,
  useEpics,
  useObjectives,
  useProfiles,
  useStories,
  useUpdateStory,
} from '@/lib/api'
import { displayName, timeAgo } from '@/lib/format'
import {
  STORY_PRIORITY,
  STORY_STATUS,
  type Activity,
  type Comment,
  type Profile,
  type StoryPriority,
  type StoryStatus,
} from '@/lib/types'

export function StoryDetail({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const { data: stories } = useStories()
  const { data: profiles = [] } = useProfiles()
  const { data: epics = [] } = useEpics()
  const { data: objectives = [] } = useObjectives()
  const update = useUpdateStory()
  const del = useDeleteStory()
  const qc = useQueryClient()
  const [copied, setCopied] = useState(false)

  const story = stories?.find((s) => s.id === storyId) ?? null

  // If the story disappears (deleted), close the drawer.
  useEffect(() => {
    if (stories && !story) onClose()
  }, [stories, story, onClose])

  const profilesById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles])
  const epicsById = useMemo(() => new Map(epics.map((e) => [e.id, e])), [epics])

  function set(patch: Record<string, unknown>) {
    if (!story) return
    update.mutate(
      { id: story.id, ...patch },
      { onSuccess: () => qc.invalidateQueries({ queryKey: keys.activity(story.id) }) },
    )
  }

  return (
    <Drawer open onClose={onClose} maxWidth={580}>
      {!story ? (
        <Spinner />
      ) : (
        <>
          <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
            <span className="font-mono text-xs text-zinc-400">NS-{story.ref}</span>
            <div className="flex items-center gap-1">
              <button
                className="btn btn-ghost px-2 text-xs"
                onClick={() => {
                  navigator.clipboard?.writeText(`${window.location.origin}/board?story=NS-${story.ref}`)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
              >
                {copied ? 'Copied!' : 'Copy link'}
              </button>
              <button
                className="btn btn-danger px-2 text-xs"
                onClick={() => {
                  if (confirm('Delete this story?')) del.mutate(story.id)
                }}
              >
                Delete
              </button>
              <button className="btn btn-ghost px-2" onClick={onClose} aria-label="Close">
                ✕
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <input
              aria-label="Story title"
              className="w-full rounded-md border border-transparent px-2 py-1 text-lg font-semibold text-zinc-900 hover:border-zinc-200 focus:border-indigo-400 focus:outline-none"
              defaultValue={story.title}
              key={story.title}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== story.title) set({ title: v })
              }}
            />

            <div className="mt-4 grid grid-cols-[110px_1fr] items-center gap-y-2.5 rounded-lg border border-zinc-100 bg-zinc-50/60 px-4 py-3 text-sm">
              <PropLabel>Status</PropLabel>
              <select className="prop-select" aria-label="Story status" value={story.status} onChange={(e) => set({ status: e.target.value as StoryStatus })}>
                {Object.entries(STORY_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              <PropLabel>Priority</PropLabel>
              <select className="prop-select" aria-label="Story priority" value={story.priority} onChange={(e) => set({ priority: e.target.value as StoryPriority })}>
                {Object.entries(STORY_PRIORITY).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              <PropLabel>Assignee</PropLabel>
              <select className="prop-select" aria-label="Assignee" value={story.assignee_id ?? ''} onChange={(e) => set({ assignee_id: e.target.value || null })}>
                <option value="">Unassigned</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{displayName(p)}</option>
                ))}
              </select>

              <PropLabel>Estimate</PropLabel>
              <input
                className="prop-select"
                type="number"
                min="0"
                aria-label="Estimate"
                defaultValue={story.estimate ?? ''}
                key={`est-${story.estimate}`}
                onBlur={(e) => {
                  const v = e.target.value === '' ? null : Number(e.target.value)
                  if (v !== story.estimate) set({ estimate: v })
                }}
              />

              <PropLabel>Epic</PropLabel>
              <select className="prop-select" aria-label="Epic" value={story.epic_id ?? ''} onChange={(e) => set({ epic_id: e.target.value || null })}>
                <option value="">No epic</option>
                {epics.map((ep) => (
                  <option key={ep.id} value={ep.id}>{ep.title}</option>
                ))}
              </select>

              <PropLabel>Key result</PropLabel>
              <select className="prop-select" aria-label="Story key result" value={story.key_result_id ?? ''} onChange={(e) => set({ key_result_id: e.target.value || null })}>
                <option value="">None</option>
                {objectives.map((o) => (
                  <optgroup key={o.id} label={o.title}>
                    {o.key_results.map((kr) => (
                      <option key={kr.id} value={kr.id}>{kr.title}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <p className="label">Description</p>
              <textarea
                aria-label="Story description"
                className="input min-h-[80px] resize-y"
                defaultValue={story.description ?? ''}
                key={`desc-${story.id}`}
                placeholder="As a … I want … so that …"
                onBlur={(e) => {
                  const v = e.target.value.trim() || null
                  if (v !== (story.description ?? null)) set({ description: v })
                }}
              />
            </div>

            <Timeline storyId={story.id} profilesById={profilesById} epicsById={epicsById} />
          </div>

          <Composer storyId={story.id} />
        </>
      )}
    </Drawer>
  )
}

function PropLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs font-medium text-zinc-500">{children}</span>
}

function Timeline({
  storyId,
  profilesById,
  epicsById,
}: {
  storyId: string
  profilesById: Map<string, Profile>
  epicsById: Map<string, { title: string }>
}) {
  const { data: comments = [], isLoading: lc } = useComments(storyId)
  const { data: activity = [], isLoading: la } = useActivity(storyId)
  const del = useDeleteComment(storyId)
  const { user } = useAuth()

  type Item =
    | { kind: 'comment'; at: string; data: Comment }
    | { kind: 'activity'; at: string; data: Activity }
  const items: Item[] = useMemo(() => {
    const merged: Item[] = [
      ...comments.map((c) => ({ kind: 'comment' as const, at: c.created_at, data: c })),
      ...activity.map((a) => ({ kind: 'activity' as const, at: a.created_at, data: a })),
    ]
    return merged.sort((x, y) => x.at.localeCompare(y.at))
  }, [comments, activity])

  return (
    <div className="mt-6">
      <p className="label">Activity</p>
      {lc || la ? (
        <p className="py-2 text-sm text-zinc-400">Loading…</p>
      ) : (
        <ul className="space-y-3" data-testid="timeline">
          {items.map((it) =>
            it.kind === 'comment' ? (
              <li key={`c-${it.data.id}`} className="flex gap-2.5" data-testid="comment">
                <Avatar profile={it.data.author ?? null} size={26} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-800">{displayName(it.data.author)}</span>
                    <span className="text-xs text-zinc-400">{timeAgo(it.data.created_at)}</span>
                    {user?.id === it.data.author_id && (
                      <button className="ml-auto text-xs text-zinc-400 hover:text-red-600" onClick={() => del.mutate(it.data.id)}>
                        delete
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">{it.data.body}</p>
                </div>
              </li>
            ) : (
              <li key={`a-${it.data.id}`} className="flex items-center gap-2 pl-1 text-xs text-zinc-500">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" />
                <span>{activitySentence(it.data, profilesById, epicsById)}</span>
                <span className="text-zinc-300">· {timeAgo(it.data.created_at)}</span>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}

function Composer({ storyId }: { storyId: string }) {
  const { user, profile } = useAuth()
  const add = useAddComment(storyId)
  const [body, setBody] = useState('')

  async function submit() {
    const text = body.trim()
    if (!text || !user) return
    await add.mutateAsync({ body: text, author_id: user.id })
    setBody('')
  }

  return (
    <div className="flex items-start gap-2.5 border-t border-zinc-100 px-5 py-3">
      <Avatar profile={profile} size={26} />
      <div className="flex-1">
        <textarea
          aria-label="Add a comment"
          className="input min-h-[40px] resize-y"
          placeholder="Leave a comment…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void submit()
          }}
        />
        <div className="mt-2 flex justify-end">
          <button className="btn btn-primary" onClick={() => void submit()} disabled={!body.trim() || add.isPending}>
            Comment
          </button>
        </div>
      </div>
    </div>
  )
}

function activitySentence(
  a: Activity,
  profilesById: Map<string, Profile>,
  epicsById: Map<string, { title: string }>,
): string {
  const who = displayName(a.actor) === 'Unassigned' ? 'Someone' : displayName(a.actor)
  const status = (v: string | null) => (v ? STORY_STATUS[v as StoryStatus]?.label ?? v : '—')
  const prio = (v: string | null) => (v ? STORY_PRIORITY[v as StoryPriority]?.label ?? v : '—')
  const person = (v: string | null) => (v ? displayName(profilesById.get(v)) : 'Unassigned')
  const epic = (v: string | null) => (v ? epicsById.get(v)?.title ?? 'an epic' : 'No epic')
  switch (a.type) {
    case 'created':
      return `${who} created this story`
    case 'status_changed':
      return `${who} moved ${status(a.from_value)} → ${status(a.to_value)}`
    case 'priority_changed':
      return `${who} set priority ${prio(a.to_value)}`
    case 'assignee_changed':
      return `${who} assigned ${person(a.to_value)}`
    case 'epic_changed':
      return `${who} moved to epic ${epic(a.to_value)}`
    default:
      return `${who} updated this story`
  }
}
