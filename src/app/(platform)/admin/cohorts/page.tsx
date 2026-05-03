import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { listCohorts } from '@/server/services/cohort-service'
import { Role } from '@prisma/client'
import { CohortsClient } from './cohorts-client'

export default async function CohortsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== Role.PROGRAM_DIRECTOR && session.user.role !== Role.ADMIN) {
    redirect('/dashboard')
  }

  const cohorts = await listCohorts()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cohorts</h1>
        <p className="text-sm text-muted-foreground">
          Named groups of residents. Use cohorts to scope session visibility.
        </p>
      </div>
      <CohortsClient
        initial={cohorts.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          academicYear: c.academicYear,
          faculty: c.faculty
            ? { id: c.faculty.id, name: c.faculty.name, email: c.faculty.email, avatarUrl: c.faculty.avatarUrl }
            : null,
          memberCount: c._count.members,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
