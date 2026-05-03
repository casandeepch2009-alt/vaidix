import { redirect } from 'next/navigation'
import { cache } from 'react'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { mapUserToIdentity } from '@/lib/identity'
import { PlatformShell } from '@/components/layout/platform-shell'

// Single DB lookup per render. React's `cache` dedupes within one server
// render pass; if the same layout is re-entered (it isn't, but cheap insurance)
// we don't re-query.
const loadUserWithProfile = cache(async (userId: string) => {
  return db.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  })
})

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Defense-in-depth: middleware already redirects unauthenticated requests,
  // but we re-check here so a misconfigured middleware can never leak the
  // platform shell.
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const user = await loadUserWithProfile(session.user.id)

  // Session was valid but the user row is gone (deleted/deactivated mid-session).
  // Force re-auth rather than rendering a half-broken shell.
  if (!user || user.deletedAt) redirect('/login')

  const identity = mapUserToIdentity(user)

  return <PlatformShell initialIdentity={identity}>{children}</PlatformShell>
}
