import type { Epic, KeyResult, KrMetric, ObjectiveFull, StatusCategory, Story } from './types'

// --- Status semantics ---
// A story's category comes from its embedded task_status; for anything without
// an embed (or for epic/objective statuses) we infer it from the label.
type StatusBearing = { status: string | null; status_info?: { category: string } | null }
const ACTIVE_CATEGORIES = ['todo', 'in_progress', 'in_review']

export function inferStatusCategory(name: string | null | undefined): StatusCategory {
  const n = (name ?? '').trim().toLowerCase()
  if (!n) return 'backlog'
  if (/(done|live|complete|shipped|merged|achieved)/.test(n)) return 'done'
  if (/(reject|cancel|dropped|missed)/.test(n)) return 'canceled'
  if (/(review|test|verif|qa|beta)/.test(n)) return 'in_review'
  if (/(progress|doing|rollback|started)/.test(n)) return 'in_progress'
  if (/(todo|to ?do|sprint|ready|next|planned)/.test(n)) return 'todo'
  return 'backlog'
}

export function categoryOf(s: StatusBearing): StatusCategory {
  return (s.status_info?.category as StatusCategory) ?? inferStatusCategory(s.status)
}
export const isActiveStory = (s: StatusBearing) => ACTIVE_CATEGORIES.includes(categoryOf(s))
export const isDoneStory = (s: StatusBearing) => categoryOf(s) === 'done'
export const isCanceledStory = (s: StatusBearing) => categoryOf(s) === 'canceled'

/**
 * Canonical task ref shown to users: Mamamia's "Task ID" format, t-<n>.
 * For synced tasks n is the Airtable "Record ID"; tasks created natively in
 * Northstar (sandbox seed / quick-create) reuse their local id, still as t-<n>.
 */
export function taskRef(s: { mamamia_no?: number | null; ref: number }): string {
  return `t-${s.mamamia_no ?? s.ref}`
}

/** Parse a task ref back to a story. Resolves 't-<n>' (Mamamia id, then local
 *  id) and still understands legacy 'NS-<n>' links. */
export function findByRef<T extends { mamamia_no?: number | null; ref: number }>(
  list: T[],
  ref: string,
): T | undefined {
  const m = /^t-(\d+)$/i.exec(ref)
  if (m) {
    const n = Number(m[1])
    return list.find((s) => s.mamamia_no === n) ?? list.find((s) => s.ref === n)
  }
  if (/^ns-\d+$/i.test(ref)) return list.find((s) => s.ref === Number(ref.slice(3)))
  return undefined
}

/** Human label for a status value: 'in_progress' → 'In progress', raw otherwise. */
export function humanizeStatus(name: string | null | undefined): string {
  if (!name) return 'No status'
  const s = name.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// --- Archiving ---
export function isArchived(x: { archived_at?: string | null } | null | undefined): boolean {
  return x?.archived_at != null
}
/** A story is archived if it is, or if its epic is (tasks inherit epic archival). */
export function isStoryArchived(s: { archived_at?: string | null; epic?: { archived_at?: string | null } | null }): boolean {
  return s.archived_at != null || s.epic?.archived_at != null
}

/**
 * Progress of a single key result, 0..1.
 * Works for "up" metrics (0 → 100) and "down" metrics (12 bugs → 0) alike,
 * because both numerator and denominator flip sign together.
 */
export function krProgress(kr: Pick<KeyResult, 'start_value' | 'target_value' | 'current_value' | 'metric'>): number {
  if (kr.metric === 'boolean') {
    return kr.current_value >= kr.target_value ? 1 : 0
  }
  const denom = kr.target_value - kr.start_value
  if (denom === 0) return kr.current_value >= kr.target_value ? 1 : 0
  return clamp01((kr.current_value - kr.start_value) / denom)
}

/** Objective progress = mean of its key results' progress. */
export function objectiveProgress(o: Pick<ObjectiveFull, 'key_results'>): number {
  if (!o.key_results || o.key_results.length === 0) return 0
  const sum = o.key_results.reduce((acc, kr) => acc + krProgress(kr), 0)
  return sum / o.key_results.length
}

/** Epic progress = fraction of its (non-canceled) stories that are done. */
export function epicProgress(
  epicId: string,
  stories: (Pick<Story, 'epic_id'> & StatusBearing)[],
): { done: number; total: number; ratio: number } {
  const own = stories.filter((s) => s.epic_id === epicId && !isCanceledStory(s))
  const done = own.filter(isDoneStory).length
  const total = own.length
  return { done, total, ratio: total === 0 ? 0 : done / total }
}

/**
 * Is this story connected to a goal? Either directly (story.key_result_id) or
 * through an epic that points at an objective or a key result.
 */
export function isStoryAligned(
  story: Pick<Story, 'epic_id' | 'key_result_id'>,
  epicAligned: Map<string, boolean>,
): boolean {
  return story.key_result_id != null || (story.epic_id != null && !!epicAligned.get(story.epic_id))
}

export function epicAlignmentMap(epics: Pick<Epic, 'id' | 'objective_id' | 'key_result_id'>[]): Map<string, boolean> {
  return new Map(epics.map((e) => [e.id, e.objective_id != null || e.key_result_id != null]))
}

/**
 * Alignment: of the work that is in flight right now, how much is connected
 * to an objective (via its epic or a key result). Northstar's headline metric.
 */
export function alignment(
  stories: (Pick<Story, 'epic_id' | 'key_result_id'> & StatusBearing)[],
  epics: Pick<Epic, 'id' | 'objective_id' | 'key_result_id'>[],
): { aligned: number; total: number; ratio: number } {
  const epicAligned = epicAlignmentMap(epics)
  const active = stories.filter(isActiveStory)
  const aligned = active.filter((s) => isStoryAligned(s, epicAligned)).length
  return { aligned, total: active.length, ratio: active.length === 0 ? 0 : aligned / active.length }
}

/**
 * Leading indicator for a key result: how much of the work meant to move it
 * is actually done. Counts stories linked straight to the KR plus stories in
 * epics that point at the KR.
 */
export function keyResultWork(
  keyResultId: string,
  stories: (Pick<Story, 'epic_id' | 'key_result_id'> & StatusBearing)[],
  epics: Pick<Epic, 'id' | 'key_result_id'>[],
): { done: number; total: number; ratio: number } {
  const epicIds = new Set(epics.filter((e) => e.key_result_id === keyResultId).map((e) => e.id))
  const own = stories.filter(
    (s) =>
      !isCanceledStory(s) &&
      (s.key_result_id === keyResultId || (s.epic_id != null && epicIds.has(s.epic_id))),
  )
  const done = own.filter(isDoneStory).length
  return { done, total: own.length, ratio: own.length === 0 ? 0 : done / own.length }
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

/** Render a metric value with its unit, e.g. "41%", "$12k", "5 bugs". */
export function formatMetric(value: number, metric: KrMetric, unit?: string | null): string {
  if (metric === 'boolean') return value >= 1 ? 'Done' : 'Not done'
  if (metric === 'percent') return `${trimNum(value)}%`
  if (metric === 'currency') return `$${trimNum(value)}`
  const n = trimNum(value)
  return unit ? `${n} ${unit}` : `${n}`
}

function trimNum(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function initials(name: string | null | undefined, email?: string | null): string {
  const source = (name && name.trim()) || (email ? email.split('@')[0] : '') || '?'
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function displayName(p: { full_name: string | null; email: string | null } | null | undefined): string {
  if (!p) return 'Unassigned'
  return p.full_name || (p.email ? p.email.split('@')[0] : 'Unknown')
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
