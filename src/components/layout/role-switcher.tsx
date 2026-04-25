'use client'

import { useRole } from '@/contexts/role-context'
import { ROLE_LABELS } from '@/lib/constants'
import type { UserRole } from '@/lib/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  resident: 'Case-based learning & self-assessment',
  faculty: 'Supervise learners & conduct assessments',
  program_director: 'Competency mapping & accreditation',
  admin: 'System configuration & user management',
}

export function RoleSwitcher() {
  const { currentRole, switchRole, allRoles } = useRole()

  return (
    <Select
      value={currentRole}
      onValueChange={(val) => switchRole(val as UserRole)}
    >
      <SelectTrigger
        size="sm"
        className="h-8 gap-1.5 border-dashed text-xs font-medium"
        aria-label="Switch role"
      >
        <SelectValue placeholder="Select role">{ROLE_LABELS[currentRole]}</SelectValue>
      </SelectTrigger>
      <SelectContent
        side="bottom"
        sideOffset={6}
        align="end"
        alignItemWithTrigger={false}
      >
        {allRoles.map((role) => (
          <SelectItem key={role} value={role} className="py-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                {ROLE_LABELS[role]}
              </span>
              <span className="text-xs text-muted-foreground">
                {ROLE_DESCRIPTIONS[role]}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
