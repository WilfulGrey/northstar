// Domain types — mirror the Postgres schema in supabase/migrations.

// Statuses are now free text (synced 1:1 from Airtable). These aliases name the
// values the demo seed uses and the modal option lists; any string is valid.
export type ObjectiveStatus = 'on_track' | 'at_risk' | 'off_track' | 'achieved' | 'missed'
export type KrMetric = 'number' | 'percent' | 'currency' | 'boolean'
export type EpicStatus = 'backlog' | 'planned' | 'in_progress' | 'completed' | 'canceled'
export type StoryPriority = 'none' | 'urgent' | 'high' | 'medium' | 'low'

// Semantic bucket a task status maps to (drives alignment / progress).
export type StatusCategory = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'canceled'

export interface TaskStatus {
  name: string
  position: number
  color: string | null
  category: StatusCategory
  created_at?: string
}

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
  status: string | null
  airtable_id?: string | null
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
  status: string | null
  airtable_id?: string | null
  created_at: string
  updated_at: string
}

export interface Epic {
  id: string
  title: string
  description: string | null
  status: string | null
  objective_id: string | null
  key_result_id: string | null
  owner_id: string | null
  color: string
  airtable_id?: string | null
  created_at: string
  updated_at: string
}

export type CheckinConfidence = 'on_track' | 'at_risk' | 'off_track'

export interface KrCheckin {
  id: string
  key_result_id: string
  author_id: string | null
  value: number
  confidence: CheckinConfidence
  note: string | null
  created_at: string
  author?: Profile | null
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
  status: string | null
  priority: StoryPriority
  estimate: number | null
  epic_id: string | null
  key_result_id: string | null
  assignee_id: string | null
  position: number
  airtable_id?: string | null
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
  status_info: Pick<TaskStatus, 'name' | 'category' | 'color' | 'position'> | null
}

// --- Display metadata ---

// Styling per semantic category — used to color status dots/badges when a status
// has no explicit color (e.g. synced epic/objective statuses).
export const CATEGORY_STYLE: Record<StatusCategory, { dot: string; text: string; bg: string }> = {
  backlog: { dot: 'bg-zinc-300', text: 'text-zinc-600', bg: 'bg-zinc-100' },
  todo: { dot: 'bg-zinc-400', text: 'text-zinc-700', bg: 'bg-zinc-100' },
  in_progress: { dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' },
  in_review: { dot: 'bg-blue-400', text: 'text-blue-700', bg: 'bg-blue-50' },
  done: { dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  canceled: { dot: 'bg-zinc-300', text: 'text-zinc-500', bg: 'bg-zinc-100' },
}

// Known styling for the demo's curated objective/epic status values. Synced
// values fall back to category inference (see format.ts).
export const OBJECTIVE_STATUS: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  on_track: { label: 'On track', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  at_risk: { label: 'At risk', dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
  off_track: { label: 'Off track', dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' },
  achieved: { label: 'Achieved', dot: 'bg-indigo-500', text: 'text-indigo-700', bg: 'bg-indigo-50' },
  missed: { label: 'Missed', dot: 'bg-zinc-400', text: 'text-zinc-600', bg: 'bg-zinc-100' },
}

export const EPIC_STATUS: Record<string, { label: string; text: string; bg: string }> = {
  backlog: { label: 'Backlog', text: 'text-zinc-600', bg: 'bg-zinc-100' },
  planned: { label: 'Planned', text: 'text-blue-700', bg: 'bg-blue-50' },
  in_progress: { label: 'In progress', text: 'text-amber-700', bg: 'bg-amber-50' },
  completed: { label: 'Completed', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  canceled: { label: 'Canceled', text: 'text-zinc-500', bg: 'bg-zinc-100' },
}

// Status values offered in the create/edit modals (the demo's curated set).
export const OBJECTIVE_STATUS_OPTIONS = ['on_track', 'at_risk', 'off_track', 'achieved', 'missed']
export const EPIC_STATUS_OPTIONS = ['backlog', 'planned', 'in_progress', 'completed', 'canceled']

export const STORY_PRIORITY: Record<StoryPriority, { label: string; rank: number; text: string; icon: string }> = {
  urgent: { label: 'Urgent', rank: 0, text: 'text-red-600', icon: '!!' },
  high: { label: 'High', rank: 1, text: 'text-orange-500', icon: '⬆' },
  medium: { label: 'Medium', rank: 2, text: 'text-amber-500', icon: '=' },
  low: { label: 'Low', rank: 3, text: 'text-zinc-400', icon: '⬇' },
  none: { label: 'No priority', rank: 4, text: 'text-zinc-300', icon: '–' },
}

export const CHECKIN_CONFIDENCE: Record<CheckinConfidence, { label: string; dot: string; text: string; bg: string }> = {
  on_track: { label: 'On track', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
  at_risk: { label: 'At risk', dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50' },
  off_track: { label: 'Off track', dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' },
}

export const KR_METRIC: Record<KrMetric, { label: string }> = {
  number: { label: 'Number' },
  percent: { label: 'Percent' },
  currency: { label: 'Currency' },
  boolean: { label: 'Done / not done' },
}
