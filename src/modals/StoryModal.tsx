import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { useCreateStory, useEpics, useObjectives, useProfiles, useUpdateStory } from '@/lib/api'
import { STORY_PRIORITY, STORY_STATUS, type StoryFull, type StoryPriority, type StoryStatus } from '@/lib/types'
import { displayName } from '@/lib/format'

export function StoryModal({
  open,
  onClose,
  story,
  defaultStatus = 'backlog',
  defaultEpicId = '',
}: {
  open: boolean
  onClose: () => void
  story?: StoryFull | null
  defaultStatus?: StoryStatus
  defaultEpicId?: string
}) {
  const { data: epics = [] } = useEpics()
  const { data: profiles = [] } = useProfiles()
  const { data: objectives = [] } = useObjectives()
  const create = useCreateStory()
  const update = useUpdateStory()
  const editing = !!story

  const [title, setTitle] = useState(story?.title ?? '')
  const [description, setDescription] = useState(story?.description ?? '')
  const [status, setStatus] = useState<StoryStatus>(story?.status ?? defaultStatus)
  const [priority, setPriority] = useState<StoryPriority>(story?.priority ?? 'none')
  const [estimate, setEstimate] = useState(story?.estimate != null ? String(story.estimate) : '')
  const [epicId, setEpicId] = useState(story?.epic_id ?? defaultEpicId)
  const [assigneeId, setAssigneeId] = useState(story?.assignee_id ?? '')
  const [keyResultId, setKeyResultId] = useState(story?.key_result_id ?? '')
  const busy = create.isPending || update.isPending

  async function submit() {
    if (!title.trim()) return
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      estimate: estimate === '' ? null : Number(estimate),
      epic_id: epicId || null,
      assignee_id: assigneeId || null,
      key_result_id: keyResultId || null,
    }
    if (editing && story) {
      await update.mutateAsync({ id: story.id, ...payload })
    } else {
      await create.mutateAsync(payload)
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={editing ? `Edit story${story ? ` · NS-${story.ref}` : ''}` : 'New story'}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={busy || !title.trim()}>
            {editing ? 'Save' : 'Create story'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <input
            className="input text-base font-medium"
            aria-label="Story title"
            autoFocus
            placeholder="Story title — what needs to happen?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <textarea
            className="input min-h-[88px] resize-y"
            placeholder="As a … I want … so that …"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Status</label>
            <select className="input" aria-label="Story status" value={status} onChange={(e) => setStatus(e.target.value as StoryStatus)}>
              {Object.entries(STORY_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as StoryPriority)}>
              {Object.entries(STORY_PRIORITY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Estimate</label>
            <input
              className="input"
              type="number"
              min="0"
              placeholder="pts"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Assignee</label>
            <select className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {displayName(p)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Epic</label>
            <select className="input" value={epicId} onChange={(e) => setEpicId(e.target.value)}>
              <option value="">No epic</option>
              {epics.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Key result (direct link)</label>
            <select className="input" value={keyResultId} onChange={(e) => setKeyResultId(e.target.value)}>
              <option value="">None</option>
              {objectives.map((o) => (
                <optgroup key={o.id} label={o.title}>
                  {o.key_results.map((kr) => (
                    <option key={kr.id} value={kr.id}>
                      {kr.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
      </div>
    </Modal>
  )
}
