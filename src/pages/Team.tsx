import { useState } from 'react'
import { PageHeader } from '@/components/Layout'
import { Avatar } from '@/components/Avatar'
import { Spinner, ErrorState } from '@/components/States'
import { useInviteMember, useProfiles, type InviteResult } from '@/lib/api'
import { displayName } from '@/lib/format'
import type { Profile } from '@/lib/types'

const linkFor = (token: string) => `${window.location.origin}/accept-invite?token=${token}`

export function Team() {
  const { data: members, isLoading, error } = useProfiles()
  const invite = useInviteMember()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [result, setResult] = useState<InviteResult | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function runInvite(targetEmail: string, targetName?: string) {
    const clean = targetEmail.trim()
    if (!clean) return
    setErrMsg(null)
    setResult(null)
    setCopied(false)
    try {
      const res = await invite.mutateAsync({ email: clean, full_name: targetName?.trim() || undefined })
      setResult(res)
      setEmail('')
      setName('')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Could not create invite')
    }
  }

  return (
    <>
      <PageHeader title="Team" subtitle="The people in this workspace. Invite a teammate by sharing a link." />
      <div className="flex-1 overflow-y-auto px-7 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-zinc-700">Invite a teammate</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Generates a one-time link (valid 7 days). Copy it and send however you like — they set a password and
              they're in.
            </p>
            <form
              className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault()
                void runInvite(email, name)
              }}
            >
              <div className="flex-1">
                <label className="label">Email</label>
                <input aria-label="Invite email" type="email" className="input" placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="flex-1">
                <label className="label">Name (optional)</label>
                <input aria-label="Invite name" className="input" placeholder="Alex Rivera" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={invite.isPending || !email.trim()}>
                {invite.isPending ? 'Creating…' : 'Create invite link'}
              </button>
            </form>

            {errMsg && <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errMsg}</p>}

            {result && (
              <div data-testid="invite-result" className="mt-3 rounded-lg bg-emerald-50 p-3">
                <p className="text-sm font-medium text-emerald-800">
                  Invite link for {result.email}
                  {result.already_member ? ' (already a member — link refreshes their access)' : ''}:
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    aria-label="Invite link"
                    data-testid="invite-link"
                    readOnly
                    className="input flex-1 bg-white font-mono text-xs"
                    value={linkFor(result.token)}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    className="btn btn-secondary shrink-0"
                    onClick={() => {
                      navigator.clipboard?.writeText(linkFor(result.token))
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1500)
                    }}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-zinc-700">Members {members ? `(${members.length})` : ''}</h2>
            {isLoading ? (
              <Spinner />
            ) : error ? (
              <ErrorState error={error} />
            ) : (
              <div className="card divide-y divide-zinc-100" data-testid="member-list">
                {members!.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-4">
                    <Avatar profile={m} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-800">{displayName(m)}</p>
                      <p className="truncate text-xs text-zinc-400">{m.email ?? '—'}</p>
                    </div>
                    <MemberAction member={m} onInvite={() => void runInvite(m.email ?? '', m.full_name ?? undefined)} pending={invite.isPending} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

function MemberAction({ member, onInvite, pending }: { member: Profile; onInvite: () => void; pending: boolean }) {
  if (member.auth_user_id) {
    return <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">Can sign in</span>
  }
  if (!member.email) {
    return <span className="shrink-0 text-xs text-zinc-300">No email</span>
  }
  return (
    <button className="btn btn-secondary shrink-0 text-xs" onClick={onInvite} disabled={pending}>
      Invite
    </button>
  )
}
