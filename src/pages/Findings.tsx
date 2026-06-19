import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/Layout'
import { Avatar } from '@/components/Avatar'
import { PriorityIcon } from '@/components/Badges'
import { ErrorState, Spinner } from '@/components/States'
import { StoryDetail } from '@/components/StoryDetail'
import { useFindings } from '@/lib/api'
import { humanizeStatus, isStoryArchived, taskRef } from '@/lib/format'

export function Findings() {
  const { data: findings = [], isLoading, error } = useFindings()
  const [openId, setOpenId] = useState<string | null>(null)

  // Newest first by Mamamia id.
  const sorted = useMemo(
    () =>
      [...findings]
        .filter((f) => !isStoryArchived(f))
        .sort((a, b) => (b.mamamia_no ?? b.ref) - (a.mamamia_no ?? a.ref)),
    [findings],
  )
  const navIds = useMemo(() => sorted.map((f) => f.id), [sorted])

  return (
    <>
      <PageHeader
        title="Findings"
        subtitle="Bugs & observations from the AI chatbot."
        action={<span className="text-sm text-zinc-400">{sorted.length} open</span>}
      />
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <Spinner />
        ) : error ? (
          <ErrorState error={error} />
        ) : (
          <div className="h-full overflow-y-auto px-7 py-5">
            <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-zinc-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-xs font-medium text-zinc-500">
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-2 py-2.5 font-medium">Finding</th>
                    <th className="px-2 py-2.5 text-center font-medium">Pri</th>
                    <th className="px-4 py-2.5 font-medium">Assignee</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((f) => (
                    <tr
                      key={f.id}
                      data-testid="finding-row"
                      data-finding-title={f.title}
                      onClick={() => setOpenId(f.id)}
                      className="cursor-pointer border-b border-zinc-50 last:border-0 hover:bg-zinc-50"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-600">
                          <span className="h-2 w-2 rounded-full bg-zinc-300" />
                          {humanizeStatus(f.finding_status)}
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className="font-mono text-[11px] text-zinc-400">{taskRef(f)}</span>{' '}
                        <span className="text-zinc-800">{f.title}</span>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <PriorityIcon priority={f.priority} />
                      </td>
                      <td className="px-4 py-2.5">
                        <Avatar profile={f.assignee} size={22} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sorted.length === 0 && <p className="px-4 py-8 text-center text-sm text-zinc-400">No findings yet.</p>}
            </div>
          </div>
        )}
      </div>

      {openId && (
        <StoryDetail storyId={openId} onClose={() => setOpenId(null)} orderedIds={navIds} onNavigate={setOpenId} />
      )}
    </>
  )
}
