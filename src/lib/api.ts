import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from './supabase'
import type {
  Activity,
  CheckinConfidence,
  Comment,
  Cycle,
  Epic,
  EpicFull,
  KeyResult,
  KrCheckin,
  ObjectiveFull,
  Profile,
  Story,
  StoryFull,
  TaskStatus,
} from './types'

export const keys = {
  profiles: ['profiles'] as const,
  cycles: ['cycles'] as const,
  objectives: ['objectives'] as const,
  epics: ['epics'] as const,
  stories: ['stories'] as const,
  taskStatuses: ['task_statuses'] as const,
  workspace: ['workspace'] as const,
  comments: (storyId: string) => ['comments', storyId] as const,
  activity: (storyId: string) => ['activity', storyId] as const,
  checkins: (krId: string) => ['checkins', krId] as const,
}

function throwOnError<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

// ---------------- Queries ----------------

export function useProfiles() {
  return useQuery({
    queryKey: keys.profiles,
    queryFn: async () =>
      throwOnError<Profile[]>(
        await supabase.from('profiles').select('*').order('full_name', { nullsFirst: false }),
      ),
  })
}

export function useCycles() {
  return useQuery({
    queryKey: keys.cycles,
    queryFn: async () =>
      throwOnError<Cycle[]>(await supabase.from('cycles').select('*').order('starts_on', { ascending: false })),
  })
}

export function useObjectives() {
  return useQuery({
    queryKey: keys.objectives,
    queryFn: async () =>
      throwOnError<ObjectiveFull[]>(
        await supabase
          .from('objectives')
          .select('*, key_results(*), owner:profiles(*), cycle:cycles(*)')
          .order('created_at', { ascending: true })
          .order('created_at', { ascending: true, foreignTable: 'key_results' }),
      ),
  })
}

export function useEpics() {
  return useQuery({
    queryKey: keys.epics,
    queryFn: async () =>
      throwOnError<EpicFull[]>(
        await supabase
          .from('epics')
          .select('*, objective:objectives(id,title,status), key_result:key_results(id,title,objective_id), owner:profiles(*)')
          .order('created_at', { ascending: true }),
      ),
  })
}

// Slim list select — no description (richText, the payload bomb) and only the
// profile fields we render. The story-detail drawer fetches the full row.
const STORY_LIST_SELECT =
  'id,ref,title,status,priority,estimate,epic_id,key_result_id,assignee_id,position,archived_at,created_at,updated_at,' +
  ' epic:epics(id,title,color,objective_id,archived_at), assignee:profiles(id,full_name,email,avatar_color),' +
  ' key_result:key_results(id,title), status_info:task_statuses(name,category,color,position)'

export function useStories() {
  return useQuery({
    queryKey: keys.stories,
    queryFn: async () => {
      // Page past the server's 1000-row cap so large workspaces load fully.
      const pageSize = 1000
      const all: StoryFull[] = []
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from('stories')
          .select(STORY_LIST_SELECT)
          .order('position', { ascending: true })
          .range(from, from + pageSize - 1)
        if (error) throw new Error(error.message)
        all.push(...((data ?? []) as unknown as StoryFull[]))
        if (!data || data.length < pageSize) break
      }
      return all
    },
  })
}

// Full single story (incl. description) for the detail drawer.
export function useStory(id: string) {
  return useQuery({
    queryKey: ['story', id],
    queryFn: async () =>
      throwOnError<{ id: string; description: string | null }>(
        await supabase.from('stories').select('id,description').eq('id', id).single(),
      ),
  })
}

export function useTaskStatuses() {
  return useQuery({
    queryKey: keys.taskStatuses,
    queryFn: async () =>
      throwOnError<TaskStatus[]>(
        await supabase.from('task_statuses').select('*').order('position', { ascending: true }),
      ),
  })
}

export function useComments(storyId: string) {
  return useQuery({
    queryKey: keys.comments(storyId),
    queryFn: async () =>
      throwOnError<Comment[]>(
        await supabase
          .from('comments')
          .select('*, author:profiles(*)')
          .eq('story_id', storyId)
          .order('created_at', { ascending: true }),
      ),
  })
}

export function useActivity(storyId: string) {
  return useQuery({
    queryKey: keys.activity(storyId),
    queryFn: async () =>
      throwOnError<Activity[]>(
        await supabase
          .from('activity')
          .select('*, actor:profiles(*)')
          .eq('story_id', storyId)
          .order('created_at', { ascending: true }),
      ),
  })
}

// All check-ins (the table is small) — used to draw trend sparklines on the OKR list.
export function useAllCheckins() {
  return useQuery({
    queryKey: ['checkins', '_all'],
    queryFn: async () =>
      throwOnError<KrCheckin[]>(
        await supabase.from('kr_checkins').select('*').order('created_at', { ascending: true }),
      ),
  })
}

export function useKrCheckins(keyResultId: string) {
  return useQuery({
    queryKey: keys.checkins(keyResultId),
    queryFn: async () =>
      throwOnError<KrCheckin[]>(
        await supabase
          .from('kr_checkins')
          .select('*, author:profiles(*)')
          .eq('key_result_id', keyResultId)
          .order('created_at', { ascending: false }),
      ),
  })
}

// ---------------- Mutations ----------------

function useEntityMutation<TInput>(
  fn: (input: TInput) => Promise<unknown>,
  invalidate: readonly (readonly string[])[],
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: k })),
  })
}

// Objectives
export function useCreateObjective() {
  return useEntityMutation(
    async (input: Partial<ObjectiveFull>) => throwOnError(await supabase.from('objectives').insert(strip(input)).select().single()),
    [keys.objectives],
  )
}
export function useUpdateObjective() {
  return useEntityMutation(
    async ({ id, ...rest }: { id: string } & Partial<ObjectiveFull>) =>
      throwOnError(await supabase.from('objectives').update(strip(rest)).eq('id', id).select().single()),
    [keys.objectives],
  )
}
export function useDeleteObjective() {
  return useEntityMutation(
    async (id: string) => throwOnError(await supabase.from('objectives').delete().eq('id', id)),
    [keys.objectives, keys.epics, keys.stories],
  )
}

// Key results
export function useCreateKeyResult() {
  return useEntityMutation(
    async (input: Partial<KeyResult>) => throwOnError(await supabase.from('key_results').insert(input).select().single()),
    [keys.objectives],
  )
}
export function useUpdateKeyResult() {
  return useEntityMutation(
    async ({ id, ...rest }: { id: string } & Partial<KeyResult>) =>
      throwOnError(await supabase.from('key_results').update(rest).eq('id', id).select().single()),
    [keys.objectives],
  )
}
export function useDeleteKeyResult() {
  return useEntityMutation(
    async (id: string) => throwOnError(await supabase.from('key_results').delete().eq('id', id)),
    [keys.objectives, keys.stories],
  )
}

// Epics
export function useCreateEpic() {
  return useEntityMutation(
    async (input: Partial<Epic>) => throwOnError(await supabase.from('epics').insert(strip(input)).select().single()),
    [keys.epics],
  )
}
export function useUpdateEpic() {
  return useEntityMutation(
    async ({ id, ...rest }: { id: string } & Partial<Epic>) =>
      throwOnError(await supabase.from('epics').update(strip(rest)).eq('id', id).select().single()),
    [keys.epics, keys.stories],
  )
}
export function useDeleteEpic() {
  return useEntityMutation(
    async (id: string) => throwOnError(await supabase.from('epics').delete().eq('id', id)),
    [keys.epics, keys.stories],
  )
}

// Stories
export function useCreateStory() {
  return useEntityMutation(
    async (input: Partial<Story>) => throwOnError(await supabase.from('stories').insert(strip(input)).select().single()),
    [keys.stories],
  )
}
export function useUpdateStory() {
  return useEntityMutation(
    async ({ id, ...rest }: { id: string } & Partial<Story>) =>
      throwOnError(await supabase.from('stories').update(strip(rest)).eq('id', id).select().single()),
    [keys.stories],
  )
}
export function useDeleteStory() {
  return useEntityMutation(
    async (id: string) => throwOnError(await supabase.from('stories').delete().eq('id', id)),
    [keys.stories],
  )
}

// Team — invite a member through the Edge Function (service-role stays server-side).
export interface InviteResult {
  ok: boolean
  token: string
  email: string
  full_name: string
  already_member: boolean
}
export function useInviteMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { email: string; full_name?: string }): Promise<InviteResult> => {
      const { data, error } = await supabase.functions.invoke('invite-member', { body: input })
      if (error) {
        let message = error.message
        try {
          const body = await (error as { context?: Response }).context?.json()
          if (body?.error) message = body.error
        } catch {
          // keep the default message
        }
        throw new Error(message)
      }
      return data as InviteResult
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.profiles }),
  })
}

// Airtable sync — runs server-side; refreshes everything it can touch.
export interface SyncResult {
  ok: boolean
  ms: number
  statuses: number
  people: number
  objectives: { created: number; updated: number; total: number }
  key_results: { created: number; updated: number; total: number; skipped: number }
  epics: { created: number; updated: number; total: number }
  stories: { created: number; updated: number; total: number }
}
// Pass { token, baseId } to connect; pass nothing to sync with the stored token.
export function useSyncAirtable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input?: { token?: string; baseId?: string }): Promise<SyncResult> => {
      const { data, error } = await supabase.functions.invoke('sync-airtable', { body: input ?? {} })
      if (error) {
        let message = error.message
        try {
          const body = await (error as { context?: Response }).context?.json()
          if (body?.error) message = body.error
        } catch {
          // keep default
        }
        throw new Error(message)
      }
      return data as SyncResult
    },
    onSuccess: () => {
      for (const k of [keys.objectives, keys.epics, keys.stories, keys.taskStatuses, keys.workspace]) {
        qc.invalidateQueries({ queryKey: k })
      }
    },
  })
}

export function useDisconnectAirtable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('disconnect-airtable', { body: {} })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workspace }),
  })
}

export interface WorkspaceStatus {
  id: string
  name: string
  airtable_connected: boolean
  airtable_base_id: string | null
  last_sync_at: string | null
}
export function useWorkspace() {
  return useQuery({
    queryKey: keys.workspace,
    queryFn: async () =>
      throwOnError<WorkspaceStatus | null>(
        await supabase.from('workspaces').select('id,name,airtable_connected,airtable_base_id,last_sync_at').maybeSingle(),
      ),
  })
}

// KR check-ins — records history AND advances the key result's current value.
export function useAddCheckin(keyResultId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { value: number; confidence: CheckinConfidence; note: string | null; author_id: string }) => {
      throwOnError(await supabase.from('kr_checkins').insert({ key_result_id: keyResultId, ...input }).select().single())
      throwOnError(await supabase.from('key_results').update({ current_value: input.value }).eq('id', keyResultId).select().single())
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.checkins(keyResultId) })
      qc.invalidateQueries({ queryKey: keys.objectives })
    },
  })
}

// Comments
export function useAddComment(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { body: string; author_id: string }) =>
      throwOnError(await supabase.from('comments').insert({ story_id: storyId, ...input }).select().single()),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.comments(storyId) }),
  })
}
export function useDeleteComment(storyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => throwOnError(await supabase.from('comments').delete().eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.comments(storyId) }),
  })
}

/**
 * Drop embedded relations and undefined values before writing — the select
 * helpers return nested objects (owner, epic, ...) that aren't real columns.
 */
function strip<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
  const relations = new Set(['owner', 'cycle', 'epic', 'assignee', 'key_result', 'key_results', 'objective'])
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    if (relations.has(k) || v === undefined) continue
    out[k] = v
  }
  return out
}

// ---------------- Realtime ----------------

/**
 * Subscribe to changes across the planning tables and refresh the relevant
 * caches, so the board and dashboards stay live for the whole team.
 */
export function useRealtimeSync() {
  const qc = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('northstar-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => invalidate(qc, keys.stories))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'epics' }, () => {
        invalidate(qc, keys.epics)
        invalidate(qc, keys.stories)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'objectives' }, () => invalidate(qc, keys.objectives))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'key_results' }, () => invalidate(qc, keys.objectives))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => invalidate(qc, ['comments']))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity' }, () => invalidate(qc, ['activity']))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kr_checkins' }, () => {
        invalidate(qc, ['checkins'])
        invalidate(qc, keys.objectives)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_statuses' }, () => invalidate(qc, keys.taskStatuses))
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])
}

function invalidate(qc: QueryClient, key: readonly string[]) {
  qc.invalidateQueries({ queryKey: key })
}
