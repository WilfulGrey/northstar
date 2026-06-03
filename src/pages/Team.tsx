import { useState } from 'react'
import { PageHeader } from '@/components/Layout'
import { Avatar } from '@/components/Avatar'
import { Spinner, ErrorState } from '@/components/States'
import { useInviteMember, useProfiles, type InviteResult } from '@/lib/api'
import { displayName } from '@/lib/format'

export function Team() {
  const { data: members, isLoading, error } = useProfiles()
  const invite = useInviteMember()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [result, setResult] = useState<InviteResult | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  async function submit() {
    const clean = email.trim()
    if (!clean) return
    setErrMsg(null)
    setResult(null)
    try {
      const res = await invite.mutateAsync({ email: clean, full_name: name.trim() || undefined })
      setResult(res)
      setEmail('')
      setName('')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Could not invite member')
    }
  }

  return (
    <>
      <PageHeader title="Team" subtitle="The people in this workspace. Invite a teammate to collaborate." />
      <div className="flex-1 overflow-y-auto px-7 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-zinc-700">Invite a teammate</h2>
            <form
              className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
            >
              <div className="flex-1">
                <label className="label">Email</label>
                <input
                  aria-label="Invite email"
                  type="email"
                  className="input"
                  placeholder="teammate@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex-1">
                <label className="label">Name (optional)</label>
                <input
                  aria-label="Invite name"
                  className="input"
                  placeholder="Alex Rivera"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={invite.isPending || !email.trim()}>
                {invite.isPending ? 'Inviting…' : 'Invite'}
              </button>
            </form>

            {errMsg && (
              <p role="alert" className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {errMsg}
              </p>
            )}
            {result && (
              <div data-testid="invite-result" className="mt-3 rounded-md bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                {result.created ? (
                  <>
                    <p className="font-medium">Account created for {result.member.email}.</p>
                    {result.temp_password && (
                      <p className="mt-0.5">
                        Temporary password:{' '}
                        <code className="rounded bg-white px-1.5 py-0.5 font-mono text-emerald-900">{result.temp_password}</code>{' '}
                        — share it so they can sign in and change it.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="font-medium">{result.member.email} is already a member.</p>
                )}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-zinc-700">
              Members {members ? `(${members.length})` : ''}
            </h2>
            {isLoading ? (
              <Spinner />
            ) : error ? (
              <ErrorState error={error} />
            ) : (
              <div className="card divide-y divide-zinc-100" data-testid="member-list">
                {members!.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-4">
                    <Avatar profile={m} size={32} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-800">{displayName(m)}</p>
                      <p className="truncate text-xs text-zinc-400">{m.email}</p>
                    </div>
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
