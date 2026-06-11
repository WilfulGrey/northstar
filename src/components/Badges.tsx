import { CATEGORY_STYLE, EPIC_STATUS, OBJECTIVE_STATUS, STORY_PRIORITY, type StoryPriority } from '@/lib/types'
import { humanizeStatus, inferStatusCategory } from '@/lib/format'

/** Style for an arbitrary status string: use the known map, else infer by category. */
function styleFor(status: string | null | undefined, known: Record<string, { text: string; bg: string }>) {
  if (status && known[status]) return known[status]
  return CATEGORY_STYLE[inferStatusCategory(status)]
}

export function ObjectiveStatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  const s = styleFor(status, OBJECTIVE_STATUS)
  const dot = OBJECTIVE_STATUS[status]?.dot ?? CATEGORY_STYLE[inferStatusCategory(status)].dot
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {OBJECTIVE_STATUS[status]?.label ?? humanizeStatus(status)}
    </span>
  )
}

export function EpicStatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  const s = styleFor(status, EPIC_STATUS)
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
      {EPIC_STATUS[status]?.label ?? humanizeStatus(status)}
    </span>
  )
}

export function KrStatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  const s = CATEGORY_STYLE[inferStatusCategory(status)]
  return <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[11px] font-medium ${s.bg} ${s.text}`}>{humanizeStatus(status)}</span>
}

export function StoryStatusDot({ status, color }: { status: string | null; color?: string | null }) {
  const dotColor = color ?? undefined
  const fallback = CATEGORY_STYLE[inferStatusCategory(status)].dot
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
      {dotColor ? (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} />
      ) : (
        <span className={`h-2 w-2 rounded-full ${fallback}`} />
      )}
      {humanizeStatus(status)}
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
