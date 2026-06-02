import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { useCreateKeyResult, useUpdateKeyResult } from '@/lib/api'
import { KR_METRIC, type KeyResult, type KrMetric } from '@/lib/types'

export function KeyResultModal({
  open,
  onClose,
  objectiveId,
  keyResult,
}: {
  open: boolean
  onClose: () => void
  objectiveId: string
  keyResult?: KeyResult | null
}) {
  const create = useCreateKeyResult()
  const update = useUpdateKeyResult()
  const editing = !!keyResult

  const [title, setTitle] = useState(keyResult?.title ?? '')
  const [metric, setMetric] = useState<KrMetric>(keyResult?.metric ?? 'percent')
  const [start, setStart] = useState(String(keyResult?.start_value ?? 0))
  const [target, setTarget] = useState(String(keyResult?.target_value ?? 100))
  const [current, setCurrent] = useState(String(keyResult?.current_value ?? 0))
  const [unit, setUnit] = useState(keyResult?.unit ?? '')
  const busy = create.isPending || update.isPending

  async function submit() {
    if (!title.trim()) return
    const payload = {
      objective_id: objectiveId,
      title: title.trim(),
      metric,
      start_value: Number(start) || 0,
      target_value: Number(target) || 0,
      current_value: Number(current) || 0,
      unit: unit.trim() || null,
    }
    if (editing && keyResult) {
      await update.mutateAsync({ id: keyResult.id, ...payload })
    } else {
      await create.mutateAsync(payload)
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit key result' : 'New key result'}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={busy || !title.trim()}>
            {editing ? 'Save' : 'Add key result'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">Key result</label>
          <input
            className="input"
            aria-label="Key result title"
            autoFocus
            placeholder="e.g. Activation rate (signup → first story)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Metric type</label>
            <select className="input" value={metric} onChange={(e) => setMetric(e.target.value as KrMetric)}>
              {Object.entries(KR_METRIC).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Unit (optional)</label>
            <input className="input" placeholder="teams, ms, …" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Start</label>
            <input className="input" type="number" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="label">Current</label>
            <input className="input" type="number" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div>
            <label className="label">Target</label>
            <input className="input" type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-zinc-400">
          Progress is computed from start → current → target, so "12 bugs → 0" works just like "0% → 60%".
        </p>
      </div>
    </Modal>
  )
}
