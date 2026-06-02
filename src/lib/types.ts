// Domain types — mirror the Postgres schema in supabase/migrations.

export type ObjectiveStatus = 'on_track' | 'at_risk' | 'off_track' | 'achieved' | 'missed'
export type KrMetric = 'number' | 'percent' | 'currency' | 'boolean'
export type EpicStatus = 'backlog' | 'planned' | 'in_progress' | 'completed' | 'canceled'
export type StoryStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'canceled'
export type StoryPriority = 'none' | 'urgent' | 'high' | 'medium' | 'low'

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  avatar_color: string
  created_at: string
}

export interface Cycle {
  id: string
  name: string
  starts_on: string
  ends_on: string
  created_at: string
}

export interface Objective {
  id: string
  title: string
  description: string | null
  cycle_id: string | null
  owner_id: string | null
  status: ObjectiveStatus
  created_at: string
  updated_at: string
}

export interface KeyResult {
  id: string
  objective_id: string
  title: string
  metric: KrMetric
  start_value: number
  target_value: number
  current_value: number
  unit: string | null
  created_at: string
  updated_at: string
}

export interface Epic {
  id: string
  title: string
  description: string | null
  status: EpicStatus
  objective_id: string | null
  key_result_id: string | null
  owner_id: string | null
  color: string
  created_at: string
  updated_at: string
}

export type ActivityType = 'created' | 'status_changed' | 'assignee_changed' | 'priority_changed' | 'epic_changed'

export interface Comment {
  id: string
  story_id: string
  author_id: string | null
  body: string
  created_at: string
  author?: Profile | null
}

export interface Activity {
  id: string
  story_id: string
  actor_id: string | null
  type: ActivityType
  from_value: string | null
  to_value: string | null
  created_at: string
  actor?: Profile | null
}

export interface Story {
  id: string
  ref: number
  title: string
  description: string | null
  status: StoryStatus
  priority: StoryPriority
  estimate: number | null
  epic_id: string | null
  key_result_id: string | null
  assignee_id: string | null
  position: number
  created_at: string
  updated_at: string
  completed_at: string | null
}

// --- Hydrated shapes returned by embedded selects ---

export interface ObjectiveFull extends Objective {
  key_results: KeyResult[]
  owner: Profile | null
  cycle: Cycle | null
}

export interface EpicFull extends Epic {
  objective: Pick<Objective, 'id' | 'title' | 'status'> | null
  key_result: Pick<KeyResult, 'id' | 'title' | 'objective_id'> | null
  owner: Profile | null
}

export interface StoryFull extends Story {
  epic: Pick<Epic, 'id' | 'title' | 'color' | 'objective_id'> | null
  assignee: Profile | null
  key_result: Pick<KeyResult, 'id' | 'title'> | null
}

// --- Display metadata ---

export const OBJECTIVE_STATUS: Record<ObjectiveStatus, { label: string; dot: string; text: string; bg: string }> = {
  on_track: { label: 'On track', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  at_risk: { label: 'At risk', dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
  off_track: { label: 'Off track', dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' },
  achieved: { label: 'Achieved', dot: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50' },
  missed: { label: 'Missed', dot: 'bg-zinc-400', text: 'text-zinc-600', bg: 'bg-zinc-100' },
}

export const EPIC_STATUS: Record<EpicStatus, { label: string; text: string; bg: string }> = {
  backlog: { label: 'Backlog', text: 'text-zinc-600', bg: 'bg-zinc-100' },
  planned: { label: 'Planned', text: 'text-blue-700', bg: 'bg-blue-50' },
  in_progress: { label: 'In progress', text: 'text-amber-700', bg: 'bg-amber-50' },
  completed: { label: 'Completed', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  canceled: { label: 'Canceled', text: 'text-zinc-500', bg: 'bg-zinc-100' },
}

export const STORY_STATUS: Record<StoryStatus, { label: string; dot: string }> = {
  backlog: { label: 'Backlog', dot: 'bg-zinc-300' },
  todo: { label: 'Todo', dot: 'bg-zinc-400' },
  in_progress: { label: 'In progress', dot: 'bg-amber-400' },
  in_review: { label: 'In review', dot: 'bg-blue-400' },
  done: { label: 'Done', dot: 'bg-emerald-500' },
  canceled: { label: 'Canceled', dot: 'bg-zinc-300' },
}

// Order of columns on the board.
export const BOARD_COLUMNS: StoryStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done']

// "Active" work = in flight right now. Used by the alignment metric.
export const ACTIVE_STORY_STATUSES: StoryStatus[] = ['todo', 'in_progress', 'in_review']

export const STORY_PRIORITY: Record<StoryPriority, { label: string; rank: number; text: string; icon: string }> = {
  urgent: { label: 'Urgent', rank: 0, text: 'text-red-600', icon: '!!' },
  high: { label: 'High', rank: 1, text: 'text-orange-500', icon: '⬆' },
  medium: { label: 'Medium', rank: 2, text: 'text-amber-500', icon: '=' },
  low: { label: 'Low', rank: 3, text: 'text-zinc-400', icon: '⬇' },
  none: { label: 'No priority', rank: 4, text: 'text-zinc-300', icon: '–' },
}

export const KR_METRIC: Record<KrMetric, { label: string }> = {
  number: { label: 'Number' },
  percent: { label: 'Percent' },
  currency: { label: 'Currency' },
  boolean: { label: 'Done / not done' },
}
