import { useEpics } from '@/lib/api'
import { Board } from './Board'
import { PageHeader } from '@/components/Layout'
import { Spinner } from '@/components/States'

// Tasks in this Airtable epic are the team's bug backlog.
const BUG_EPIC_TITLE = 'BUGii!!'

export function Bugs() {
  const { data: epics = [], isLoading } = useEpics()
  const bug = epics.find((e) => e.title === BUG_EPIC_TITLE)

  if (isLoading) return <Spinner />
  if (!bug) {
    return (
      <>
        <PageHeader title="Bugs" subtitle="Tasks from the BUGii!! epic." />
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-zinc-400">
          No “{BUG_EPIC_TITLE}” epic yet — it appears here once Airtable has synced.
        </div>
      </>
    )
  }

  return <Board fixedEpicId={bug.id} heading={{ title: 'Bugs', subtitle: 'Tasks from the BUGii!! epic.' }} />
}
