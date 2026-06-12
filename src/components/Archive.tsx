// Shared archiving UI: a per-tab "show archived" toggle and the "Archived" tag.

export function ArchiveToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      data-testid="toggle-archived"
      aria-pressed={on}
      aria-label={on ? 'Hide archived' : 'Show archived'}
      title={on ? 'Hide archived' : 'Show archived'}
      onClick={() => onChange(!on)}
      className={`btn h-8 ${on ? 'bg-indigo-50 text-indigo-700' : 'btn-secondary'}`}
    >
      <ArchiveIcon />
      <span className="hidden lg:inline">Archived</span>
    </button>
  )
}

export function ArchivedTag({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 ${className}`}>
      <ArchiveIcon />
      Archived
    </span>
  )
}

export function ArchiveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </svg>
  )
}
