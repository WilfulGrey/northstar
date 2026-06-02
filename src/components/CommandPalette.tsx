import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEpics, useObjectives, useStories } from '@/lib/api'

interface Cmd {
  id: string
  label: string
  hint: string
  run: () => void
}

export const CMDK_EVENT = 'northstar:cmdk'

export function CommandPalette() {
  const navigate = useNavigate()
  const { data: objectives = [] } = useObjectives()
  const { data: epics = [] } = useEpics()
  const { data: stories = [] } = useStories()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Open with ⌘K / Ctrl-K, or a dispatched event (sidebar button).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onEvent = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(CMDK_EVENT, onEvent)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(CMDK_EVENT, onEvent)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSel(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  function go(path: string, state?: unknown) {
    setOpen(false)
    navigate(path, state ? { state } : undefined)
  }

  const commands: Cmd[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    const actions: Cmd[] = [
      { id: 'new-story', label: 'New story', hint: 'Create', run: () => go('/board', { quickCreate: 'story' }) },
      { id: 'new-objective', label: 'New objective', hint: 'Create', run: () => go('/okrs', { quickCreate: 'objective' }) },
      { id: 'new-epic', label: 'New epic', hint: 'Create', run: () => go('/epics', { quickCreate: 'epic' }) },
      { id: 'go-dashboard', label: 'Go to Dashboard', hint: 'Navigate', run: () => go('/') },
      { id: 'go-okrs', label: 'Go to OKRs', hint: 'Navigate', run: () => go('/okrs') },
      { id: 'go-epics', label: 'Go to Epics', hint: 'Navigate', run: () => go('/epics') },
      { id: 'go-board', label: 'Go to Board', hint: 'Navigate', run: () => go('/board') },
    ]
    const match = (s: string) => !q || s.toLowerCase().includes(q)

    const found: Cmd[] = []
    if (q) {
      objectives.filter((o) => match(o.title)).slice(0, 5).forEach((o) =>
        found.push({ id: `o-${o.id}`, label: o.title, hint: 'Objective', run: () => go('/okrs', { openObjective: o.id }) }),
      )
      epics.filter((e) => match(e.title)).slice(0, 5).forEach((e) =>
        found.push({ id: `e-${e.id}`, label: e.title, hint: 'Epic', run: () => go('/epics') }),
      )
      stories.filter((s) => match(s.title)).slice(0, 6).forEach((s) =>
        found.push({ id: `s-${s.id}`, label: s.title, hint: `Story · NS-${s.ref}`, run: () => go('/board') }),
      )
    }
    return [...actions.filter((a) => match(a.label)), ...found]
  }, [query, objectives, epics, stories]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sel >= commands.length) setSel(0)
  }, [commands.length, sel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-zinc-900/40 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
      <div className="card w-full max-w-xl overflow-hidden shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          aria-label="Command menu"
          className="w-full border-b border-zinc-100 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
          placeholder="Search or run a command…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setSel((s) => Math.min(s + 1, commands.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setSel((s) => Math.max(s - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              commands[sel]?.run()
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
        <ul className="max-h-80 overflow-y-auto py-1" role="listbox">
          {commands.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-zinc-400">No matches</li>
          ) : (
            commands.map((c, i) => (
              <li key={c.id} role="option" aria-selected={i === sel}>
                <button
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm ${
                    i === sel ? 'bg-indigo-50 text-indigo-900' : 'text-zinc-700 hover:bg-zinc-50'
                  }`}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => c.run()}
                >
                  <span className="truncate">{c.label}</span>
                  <span className="shrink-0 text-xs text-zinc-400">{c.hint}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
