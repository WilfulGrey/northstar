import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from './supabase'
import type {
  Cycle,
  Epic,
  EpicFull,
  KeyResult,
  ObjectiveFull,
  Profile,
  Story,
  StoryFull,
} from './types'

export const keys = {
  profiles: ['profiles'] as const,
  cycles: ['cycles'] as const,
  objectives: ['objectives'] as const,
  epics: ['epics'] as const,
  stories: ['stories'] as const,
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
          .select('*, objective:objectives(id,title,status), owner:profiles(*)')
          .order('created_at', { ascending: true }),
      ),
  })
}

export function useStories() {
  return useQuery({
    queryKey: keys.stories,
    queryFn: async () =>
      throwOnError<StoryFull[]>(
        await supabase
          .from('stories')
          .select(
            '*, epic:epics(id,title,color,objective_id), assignee:profiles(*), key_result:key_results(id,title)',
          )
          .order('position', { ascending: true }),
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
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])
}

function invalidate(qc: QueryClient, key: readonly string[]) {
  qc.invalidateQueries({ queryKey: key })
}
