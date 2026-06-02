import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { useCreateObjective, useCycles, useProfiles, useUpdateObjective } from '@/lib/api'
import { OBJECTIVE_STATUS, type ObjectiveFull, type ObjectiveStatus } from '@/lib/types'
import { displayName } from '@/lib/format'

export function ObjectiveModal({
  open,
  onClose,
  objective,
}: {
  open: boolean
  onClose: () => void
  objective?: ObjectiveFull | null
}) {
  const { data: profiles = [] } = useProfiles()
  const { data: cycles = [] } = useCycles()
  const create = useCreateObjective()
  const update = useUpdateObjective()
  const editing = !!objective

  const [title, setTitle] = useState(objective?.title ?? '')
  const [description, setDescription] = useState(objective?.description ?? '')
  const [status, setStatus] = useState<ObjectiveStatus>(objective?.status ?? 'on_track')
  const [ownerId, setOwnerId] = useState(objective?.owner_id ?? '')
  const [cycleId, setCycleId] = useState(objective?.cycle_id ?? '')
  const busy = create.isPending || update.isPending

  async function submit() {
    if (!title.trim()) return
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      owner_id: ownerId || null,
      cycle_id: cycleId || null,
    }
    if (editing && objective) {
      await update.mutateAsync({ id: objective.id, ...payload })
    } else {
      await create.mutateAsync(payload)
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit objective' : 'New objective'}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={busy || !title.trim()}>
            {editing ? 'Save' : 'Create objective'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Objective</label>
          <input
            className="input"
            aria-label="Objective title"
            autoFocus
            placeholder="e.g. Make Northstar the team's daily driver"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            className="input min-h-[72px] resize-y"
            placeholder="Why does this matter this quarter?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as ObjectiveStatus)}>
              {Object.entries(OBJECTIVE_STATUS).map(([k, v]) => (
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
          <div>
            <label className="label">Cycle</label>
            <select className="input" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
              <option value="">No cycle</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </Modal>
  )
}
