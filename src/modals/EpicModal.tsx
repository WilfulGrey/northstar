import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { ArchivedTag } from '@/components/Archive'
import { useCreateEpic, useObjectives, useProfiles, useUpdateEpic } from '@/lib/api'
import { EPIC_STATUS, type Epic } from '@/lib/types'
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
  const [status, setStatus] = useState<string>(epic?.status ?? 'backlog')
  const [objectiveId, setObjectiveId] = useState(epic?.objective_id ?? '')
  const [keyResultId, setKeyResultId] = useState(epic?.key_result_id ?? '')
  const [ownerId, setOwnerId] = useState(epic?.owner_id ?? '')
  const [color, setColor] = useState(epic?.color ?? COLORS[0])
  const busy = create.isPending || update.isPending

  function objectiveForKr(krId: string): string {
    for (const o of objectives) if (o.key_results.some((k) => k.id === krId)) return o.id
    return ''
  }

  async function submit() {
    if (!title.trim()) return
    // A key result implies its objective — keep them consistent.
    const resolvedObjective = keyResultId ? objectiveForKr(keyResultId) || objectiveId : objectiveId
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      objective_id: resolvedObjective || null,
      key_result_id: keyResultId || null,
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
        {epic?.archived_at && (
          <div className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2">
            <ArchivedTag />
            <span className="text-xs text-zinc-400">Its tasks are archived too.</span>
          </div>
        )}
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
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
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
          <select
            className="input"
            aria-label="Linked objective"
            value={objectiveId}
            onChange={(e) => {
              setObjectiveId(e.target.value)
              // Clear a key result that no longer belongs to the chosen objective.
              if (keyResultId && objectiveForKr(keyResultId) !== e.target.value) setKeyResultId('')
            }}
          >
            <option value="">No objective (unaligned)</option>
            {objectives.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Key result (optional) — which metric this moves</label>
          <select
            className="input"
            aria-label="Linked key result"
            value={keyResultId}
            onChange={(e) => {
              setKeyResultId(e.target.value)
              if (e.target.value) setObjectiveId(objectiveForKr(e.target.value))
            }}
          >
            <option value="">No key result</option>
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
