import {
  EPIC_STATUS,
  OBJECTIVE_STATUS,
  STORY_PRIORITY,
  STORY_STATUS,
  type EpicStatus,
  type ObjectiveStatus,
  type StoryPriority,
  type StoryStatus,
} from '@/lib/types'

export function ObjectiveStatusBadge({ status }: { status: ObjectiveStatus }) {
  const s = OBJECTIVE_STATUS[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

export function EpicStatusBadge({ status }: { status: EpicStatus }) {
  const s = EPIC_STATUS[status]
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>
}

export function StoryStatusDot({ status }: { status: StoryStatus }) {
  const s = STORY_STATUS[status]
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

export function PriorityIcon({ priority }: { priority: StoryPriority }) {
  const p = STORY_PRIORITY[priority]
  if (priority === 'none') return null
  return (
    <span title={p.label} className={`text-xs font-bold ${p.text}`}>
      {p.icon}
    </span>
  )
}
