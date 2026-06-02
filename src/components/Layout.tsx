import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Avatar } from './Avatar'
import { CommandPalette, CMDK_EVENT } from './CommandPalette'
import { useRealtimeSync } from '@/lib/api'
import { displayName } from '@/lib/format'

const NAV = [
  { to: '/', label: 'Dashboard', end: true, icon: HomeIcon },
  { to: '/okrs', label: 'OKRs', icon: TargetIcon },
  { to: '/epics', label: 'Epics', icon: LayersIcon },
  { to: '/board', label: 'Board', icon: BoardIcon },
]

export function Layout() {
  const { profile, user, signOut } = useAuth()
  useRealtimeSync()

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-4">
          <img src="/star.svg" alt="" className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight text-zinc-900">Northstar</span>
        </div>

        <div className="px-3 pb-1">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent(CMDK_EVENT))}
            className="flex w-full items-center gap-2 rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-600"
          >
            <SearchIcon />
            Search
            <span className="ml-auto rounded border border-zinc-200 px-1 text-[11px] text-zinc-400">⌘K</span>
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {NAV.map(({ to, label, end, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-zinc-100 p-3">
          <div className="flex items-center gap-2.5">
            <Avatar profile={profile} size={30} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-800">{displayName(profile ?? { full_name: null, email: user?.email ?? null })}</p>
              <p className="truncate text-xs text-zinc-400">{user?.email}</p>
            </div>
            <button onClick={signOut} title="Sign out" className="btn btn-ghost px-2" aria-label="Sign out">
              <LogoutIcon />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>

      <CommandPalette />
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-7 py-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-zinc-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

// --- Inline icons (no extra dependency) ---
function base(path: ReactNode) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {path}
    </svg>
  )
}
function HomeIcon() {
  return base(<><path d="M3 9.5 12 3l9 6.5" /><path d="M5 10v10h14V10" /></>)
}
function TargetIcon() {
  return base(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>)
}
function LayersIcon() {
  return base(<><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>)
}
function BoardIcon() {
  return base(<><rect x="3" y="4" width="6" height="16" rx="1" /><rect x="11" y="4" width="6" height="11" rx="1" /><rect x="19" y="4" width="2" height="16" rx="1" /></>)
}
function LogoutIcon() {
  return base(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>)
}
function SearchIcon() {
  return base(<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>)
}
