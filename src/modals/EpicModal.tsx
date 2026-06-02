import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { useCreateEpic, useObjectives, useProfiles, useUpdateEpic } from '@/lib/api'
import { EPIC_STATUS, type Epic, type EpicStatus } from '@/lib/types'
import { displayName } from '@/lib/format'

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#64748b']

export function EpicModal({ open, onClose, epic }: { open: boolean; onClose: () => void; epic?: Epic | null }) {
  const { data: objectives = [] } = useObjectives()
  const { data: profiles = [] } = useProfiles()
  const create = useCreateEpic()
  const update = useUpdateEpic()
  const editing = !!epic

  const [title, setTitle] = useState(epic?.title ?? '')
  const [description, setDescription] = useState(epic?.description ?? '')
  const [status, setStatus] = useState<EpicStatus>(epic?.status ?? 'backlog')
  const [objectiveId, setObjectiveId] = useState(epic?.objective_id ?? '')
  const [ownerId, setOwnerId] = useState(epic?.owner_id ?? '')
  const [color, setColor] = useState(epic?.color ?? COLORS[0])
  const busy = create.isPending || update.isPending

  async function submit() {
    if (!title.trim()) return
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      objective_id: objectiveId || null,
      owner_id: ownerId || null,
      color,
    }
    if (editing && epic) {
      await update.mutateAsync({ id: epic.id, ...payload })
    } else {
      await create.mutateAsync(payload)
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit epic' : 'New epic'}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={busy || !title.trim()}>
            {editing ? 'Save' : 'Create epic'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Epic</label>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <input
              className="input"
              aria-label="Epic title"
              autoFocus
              placeholder="e.g. Onboarding & activation flow"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            className="input min-h-[64px] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as EpicStatus)}>
              {Object.entries(EPIC_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Owner</label>
            <select className="input" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Unassigned</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {displayName(p)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Linked objective — connects this work to a goal</label>
          <select className="input" aria-label="Linked objective" value={objectiveId} onChange={(e) => setObjectiveId(e.target.value)}>
            <option value="">No objective (unaligned)</option>
            {objectives.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Color</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-6 w-6 rounded-full ring-2 ring-offset-2 transition ${color === c ? 'ring-zinc-400' : 'ring-transparent'}`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
