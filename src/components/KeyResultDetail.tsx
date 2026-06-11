import { useMemo, useState } from 'react'
import { Drawer } from './Drawer'
import { ProgressBar } from './ProgressBar'
import { Sparkline } from './Sparkline'
import { KrStatusBadge, StoryStatusDot } from './Badges'
import { Avatar } from './Avatar'
import { useAuth } from '@/auth/AuthProvider'
import { useAddCheckin, useEpics, useKrCheckins, useObjectives, useStories } from '@/lib/api'
import { displayName, formatMetric, keyResultWork, krProgress, pct, timeAgo } from '@/lib/format'
import { CHECKIN_CONFIDENCE, type CheckinConfidence, type KeyResult } from '@/lib/types'

export function KeyResultDetail({ keyResult, onClose }: { keyResult: KeyResult; onClose: () => void }) {
  const { data: stories = [] } = useStories()
  const { data: epics = [] } = useEpics()
  const { data: objectives = [] } = useObjectives()

  // Always render the freshest copy so a check-in is reflected immediately.
  const kr = useMemo(
    () => objectives.flatMap((o) => o.key_results).find((k) => k.id === keyResult.id) ?? keyResult,
    [objectives, keyResult],
  )

  const epicIds = useMemo(
    () => new Set(epics.filter((e) => e.key_result_id === kr.id).map((e) => e.id)),
    [epics, kr.id],
  )
  const contributing = useMemo(
    () => stories.filter((s) => s.key_result_id === kr.id || (s.epic_id != null && epicIds.has(s.epic_id))),
    [stories, epicIds, kr.id],
  )

  const lagging = krProgress(kr)
  const leading = keyResultWork(kr.id, stories, epics)

  return (
    <Drawer open onClose={onClose} maxWidth={560}>
      <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Key result</span>
        <button className="btn btn-ghost px-2" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-zinc-900">{kr.title}</h2>
          {kr.status && <KrStatusBadge status={kr.status} />}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-xs font-medium text-zinc-500">Result (lagging)</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900" data-testid="kr-lagging">{pct(lagging)}</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {formatMetric(kr.current_value, kr.metric, kr.unit)} / {formatMetric(kr.target_value, kr.metric, kr.unit)}
            </p>
            <ProgressBar ratio={lagging} className="mt-2" />
          </div>
          <div className="card p-4" data-testid="kr-leading">
            <p className="text-xs font-medium text-zinc-500">Work done (leading)</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-indigo-600">{pct(leading.ratio)}</p>
            <p className="mt-0.5 text-xs text-zinc-400">{leading.done}/{leading.total} stories done</p>
            <ProgressBar ratio={leading.ratio} className="mt-2" />
          </div>
        </div>

        <CheckinSection kr={kr} />

        <div className="mt-6">
          <p className="label">Contributing work ({contributing.length})</p>
          {contributing.length === 0 ? (
            <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-sm text-zinc-400">
              No stories linked yet. Link a story directly, or an epic to this key result.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {contributing.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2">
                  <StoryStatusDot status={s.status} color={s.status_info?.color} />
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">{s.title}</span>
                  <span className="shrink-0 font-mono text-[11px] text-zinc-400">NS-{s.ref}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Drawer>
  )
}

function CheckinSection({ kr }: { kr: KeyResult }) {
  const { user } = useAuth()
  const { data: checkins = [] } = useKrCheckins(kr.id)
  const add = useAddCheckin(kr.id)
  const [value, setValue] = useState(String(kr.current_value))
  const [confidence, setConfidence] = useState<CheckinConfidence>('on_track')
  const [note, setNote] = useState('')
  const trend = useMemo(() => [...checkins].reverse().map((c) => c.value), [checkins])

  async function submit() {
    if (!user || value === '') return
    await add.mutateAsync({ value: Number(value), confidence, note: note.trim() || null, author_id: user.id })
    setNote('')
  }

  return (
    <div className="mt-5">
      <div className="mb-1 flex items-center justify-between">
        <p className="label mb-0">Check in</p>
        {trend.length >= 2 && <Sparkline values={trend} width={96} height={24} />}
      </div>
      <div className="card space-y-3 p-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">New value</label>
            <input
              aria-label="Check-in value"
              className="input"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Confidence</label>
            <select aria-label="Confidence" className="input" value={confidence} onChange={(e) => setConfidence(e.target.value as CheckinConfidence)}>
              {Object.entries(CHECKIN_CONFIDENCE).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>
        <textarea
          aria-label="Check-in note"
          className="input min-h-[52px] resize-y"
          placeholder="What changed? What's the plan?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex justify-end">
          <button className="btn btn-primary" onClick={() => void submit()} disabled={add.isPending || value === ''}>
            Post check-in
          </button>
        </div>
      </div>

      {checkins.length > 0 && (
        <ul className="mt-4 space-y-3" data-testid="checkin-history">
          {checkins.map((c, i) => {
            const prev = checkins[i + 1]
            const delta = prev ? c.value - prev.value : null
            const conf = CHECKIN_CONFIDENCE[c.confidence]
            return (
              <li key={c.id} className="flex gap-2.5">
                <Avatar profile={c.author ?? null} size={26} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-medium text-zinc-800">{formatMetric(c.value, kr.metric, kr.unit)}</span>
                    {delta != null && delta !== 0 && (
                      <span className={`text-xs font-medium ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {delta > 0 ? '+' : ''}{Number.isInteger(delta) ? delta : delta.toFixed(1)}
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${conf.bg} ${conf.text}`}>{conf.label}</span>
                    <span className="text-xs text-zinc-400">· {displayName(c.author)} · {timeAgo(c.created_at)}</span>
                  </div>
                  {c.note && <p className="mt-0.5 text-sm text-zinc-600">{c.note}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
