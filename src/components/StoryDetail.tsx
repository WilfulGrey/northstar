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
  useAttachments,
  useComments,
  useDeleteAttachment,
  useDeleteComment,
  useDeleteStory,
  useEpics,
  useObjectives,
  useProfiles,
  useStories,
  useStory,
  useTaskStatuses,
  useUpdateStory,
  useUploadAttachment,
} from '@/lib/api'
import { ArchivedTag } from './Archive'
import { AttachButton, AttachmentList, filesFromEvent } from './Attachments'
import { displayName, humanizeStatus, isStoryArchived, timeAgo } from '@/lib/format'
import {
  STORY_PRIORITY,
  type Activity,
  type Attachment,
  type Comment,
  type Profile,
  type StoryPriority,
} from '@/lib/types'

export function StoryDetail({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const { data: stories } = useStories()
  const { data: profiles = [] } = useProfiles()
  const { data: epics = [] } = useEpics()
  const { data: objectives = [] } = useObjectives()
  const { data: statuses = [] } = useTaskStatuses()
  const { data: full } = useStory(storyId)
  const update = useUpdateStory()
  const del = useDeleteStory()
  const qc = useQueryClient()
  const { profile } = useAuth()
  const { data: attachments = [] } = useAttachments(storyId)
  const upload = useUploadAttachment(storyId)
  const delAtt = useDeleteAttachment(storyId)
  const [copied, setCopied] = useState(false)

  const story = stories?.find((s) => s.id === storyId) ?? null

  const storyAttachments = useMemo(() => attachments.filter((a) => a.comment_id == null), [attachments])
  const attByComment = useMemo(() => {
    const m = new Map<string, Attachment[]>()
    for (const a of attachments) {
      if (!a.comment_id) continue
      if (!m.has(a.comment_id)) m.set(a.comment_id, [])
      m.get(a.comment_id)!.push(a)
    }
    return m
  }, [attachments])

  async function uploadFiles(files: File[], commentId: string | null) {
    if (!profile?.workspace_id || !files.length) return
    for (const file of files) {
      try {
        await upload.mutateAsync({ file, commentId, workspaceId: profile.workspace_id, uploadedBy: profile.id })
      } catch (e) {
        alert(`Upload failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

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
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: keys.activity(story.id) })
          qc.invalidateQueries({ queryKey: ['story', story.id] })
        },
      },
    )
  }

  return (
    <Drawer open onClose={onClose} maxWidth={580}>
      {!story ? (
        <Spinner />
      ) : (
        <>
          <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-zinc-400">NS-{story.ref}</span>
              {isStoryArchived(story) && <ArchivedTag />}
            </div>
            <div className="flex items-center gap-1">
              <button
                className="btn btn-ghost px-2 text-xs"
                onClick={() => set({ archived_at: story.archived_at ? null : new Date().toISOString() })}
              >
                {story.archived_at ? 'Unarchive' : 'Archive'}
              </button>
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
              <select className="prop-select" aria-label="Story status" value={story.status ?? ''} onChange={(e) => set({ status: e.target.value })}>
                {story.status == null && <option value="">No status</option>}
                {statuses.map((s) => (
                  <option key={s.name} value={s.name}>{humanizeStatus(s.name)}</option>
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
                defaultValue={full?.description ?? ''}
                key={`desc-${story.id}-${full ? 'loaded' : 'loading'}`}
                placeholder="As a … I want … so that …  (paste an image to attach)"
                onPaste={(e) => {
                  const files = filesFromEvent(e)
                  if (files.length) {
                    e.preventDefault()
                    void uploadFiles(files, null)
                  }
                }}
                onBlur={(e) => {
                  const v = e.target.value.trim() || null
                  if (v !== (full?.description ?? null)) set({ description: v })
                }}
              />
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="label mb-0">Attachments</p>
                <AttachButton onFiles={(f) => void uploadFiles(f, null)} disabled={upload.isPending} />
              </div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  void uploadFiles(filesFromEvent(e), null)
                }}
                className="rounded-lg border border-dashed border-zinc-200 p-3"
              >
                {storyAttachments.length ? (
                  <AttachmentList items={storyAttachments} onDelete={(a) => delAtt.mutate({ id: a.id, path: a.path })} />
                ) : (
                  <p className="text-center text-xs text-zinc-400">Drop files or paste an image — images, PDF, CSV…</p>
                )}
                {upload.isPending && <p className="mt-2 text-xs text-zinc-400">Uploading…</p>}
              </div>
            </div>

            <Timeline storyId={story.id} profilesById={profilesById} epicsById={epicsById} attByComment={attByComment} />
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
  attByComment,
}: {
  storyId: string
  profilesById: Map<string, Profile>
  epicsById: Map<string, { title: string }>
  attByComment: Map<string, Attachment[]>
}) {
  const { data: comments = [], isLoading: lc } = useComments(storyId)
  const { data: activity = [], isLoading: la } = useActivity(storyId)
  const del = useDeleteComment(storyId)
  const { profile } = useAuth()

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
                    {profile?.id === it.data.author_id && (
                      <button className="ml-auto text-xs text-zinc-400 hover:text-red-600" onClick={() => del.mutate(it.data.id)}>
                        delete
                      </button>
                    )}
                  </div>
                  {it.data.body && (
                    <p className="mt-0.5 whitespace-pre-wrap rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">{it.data.body}</p>
                  )}
                  {attByComment.get(it.data.id)?.length ? (
                    <div className="mt-1.5">
                      <AttachmentList items={attByComment.get(it.data.id)!} />
                    </div>
                  ) : null}
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
  const { profile } = useAuth()
  const add = useAddComment(storyId)
  const upload = useUploadAttachment(storyId)
  const [body, setBody] = useState('')
  const [pending, setPending] = useState<File[]>([])
  const busy = add.isPending || upload.isPending

  const addFiles = (files: File[]) => files.length && setPending((p) => [...p, ...files])

  async function submit() {
    const text = body.trim()
    if ((!text && !pending.length) || !profile || busy) return
    const comment = (await add.mutateAsync({ body: text, author_id: profile.id })) as unknown as { id: string } | null
    if (pending.length && profile.workspace_id && comment?.id) {
      for (const file of pending) {
        try {
          await upload.mutateAsync({ file, commentId: comment.id, workspaceId: profile.workspace_id, uploadedBy: profile.id })
        } catch {
          // best effort; the comment is already posted
        }
      }
    }
    setBody('')
    setPending([])
  }

  return (
    <div
      className="flex items-start gap-2.5 border-t border-zinc-100 px-5 py-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        addFiles(filesFromEvent(e))
      }}
    >
      <Avatar profile={profile} size={26} />
      <div className="flex-1">
        <textarea
          aria-label="Add a comment"
          className="input min-h-[40px] resize-y"
          placeholder="Leave a comment… (paste or drop files to attach)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onPaste={(e) => {
            const files = filesFromEvent(e)
            if (files.length) {
              e.preventDefault()
              addFiles(files)
            }
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void submit()
          }}
        />
        {pending.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pending.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                📎 <span className="max-w-[140px] truncate">{f.name}</span>
                <button type="button" className="text-zinc-400 hover:text-red-600" onClick={() => setPending((p) => p.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <AttachButton onFiles={addFiles} disabled={busy} />
          <button className="btn btn-primary" onClick={() => void submit()} disabled={(!body.trim() && !pending.length) || busy}>
            {busy ? 'Posting…' : 'Comment'}
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
  const status = (v: string | null) => (v ? humanizeStatus(v) : '—')
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
