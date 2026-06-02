import type { Epic, KeyResult, KrMetric, Objective, ObjectiveFull, Story } from './types'
import { ACTIVE_STORY_STATUSES } from './types'

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
export function epicProgress(epicId: string, stories: Pick<Story, 'epic_id' | 'status'>[]): {
  done: number
  total: number
  ratio: number
} {
  const own = stories.filter((s) => s.epic_id === epicId && s.status !== 'canceled')
  const done = own.filter((s) => s.status === 'done').length
  const total = own.length
  return { done, total, ratio: total === 0 ? 0 : done / total }
}

/**
 * Alignment: of the work that is in flight right now, how much is connected
 * to an objective (via its epic). This is Northstar's headline metric.
 */
export function alignment(
  stories: Pick<Story, 'status' | 'epic_id' | 'key_result_id'>[],
  epics: Pick<Epic, 'id' | 'objective_id'>[],
): { aligned: number; total: number; ratio: number } {
  const epicToObjective = new Map(epics.map((e) => [e.id, e.objective_id]))
  const active = stories.filter((s) => ACTIVE_STORY_STATUSES.includes(s.status))
  const aligned = active.filter(
    (s) =>
      s.key_result_id != null ||
      (s.epic_id != null && epicToObjective.get(s.epic_id) != null),
  ).length
  return { aligned, total: active.length, ratio: active.length === 0 ? 0 : aligned / active.length }
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

export function objectiveHealthLabel(o: Pick<Objective, 'status'>): string {
  return o.status
}
