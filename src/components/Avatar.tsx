import { initials } from '@/lib/format'
import type { Profile } from '@/lib/types'

export function Avatar({
  profile,
  size = 24,
  title,
}: {
  profile: Pick<Profile, 'full_name' | 'email' | 'avatar_color'> | null
  size?: number
  title?: string
}) {
  if (!profile) {
    return (
      <span
        title={title ?? 'Unassigned'}
        className="inline-flex items-center justify-center rounded-full border border-dashed border-zinc-300 text-zinc-400"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
      >
        ?
      </span>
    )
  }
  return (
    <span
      title={title ?? profile.full_name ?? profile.email ?? ''}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, backgroundColor: profile.avatar_color, fontSize: size * 0.4 }}
    >
      {initials(profile.full_name, profile.email)}
    </span>
  )
}
