'use client'

import { useState } from 'react'
import { UsersRound, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

interface CohortRow {
  id: string
  name: string
  description: string | null
  academicYear: string | null
  memberCount: number
  createdAt: string
}

export function CohortsClient({ initial }: { initial: CohortRow[] }) {
  const [cohorts, setCohorts] = useState(initial)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [academicYear, setAcademicYear] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/cohorts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          academicYear: academicYear || undefined,
        }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error?.message ?? 'Create failed')
      const c = json.data.cohort
      setCohorts((prev) => [
        {
          id: c.id,
          name: c.name,
          description: c.description,
          academicYear: c.academicYear,
          memberCount: 0,
          createdAt: c.createdAt,
        },
        ...prev,
      ])
      setName(''); setDescription(''); setAcademicYear(''); setCreating(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}

      <div className="flex justify-end">
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4 mr-1.5" /> New cohort
          </Button>
        )}
      </div>

      {creating && (
        <form onSubmit={create} className="space-y-4 rounded-lg border bg-card p-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Academic year</label>
              <Input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2026–27" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={500} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setCreating(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create'}</Button>
          </div>
        </form>
      )}

      {cohorts.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center">
          <p className="text-muted-foreground">No cohorts yet. Create one to start scoping session visibility.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {cohorts.map((c) => (
            <div key={c.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <UsersRound className="size-5 text-primary" />
                  <h3 className="font-semibold">{c.name}</h3>
                </div>
                {c.academicYear && <Badge variant="outline">{c.academicYear}</Badge>}
              </div>
              {c.description && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{c.description}</p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                {c.memberCount} member{c.memberCount === 1 ? '' : 's'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
