'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import type { User, UserRole } from '@/lib/types'

// Demo users — one per role for quick switching
const DEMO_USERS: Record<UserRole, User> = {
  resident: {
    id: 'usr-001',
    name: 'Dr. Ananya Krishnan',
    email: 'ananya@lvpei.org',
    role: 'resident',
    specialization: 'Ophthalmology',
    designation: 'Senior Resident',
    department: 'Vitreoretinal Surgery',
    yearOfTraining: 'PGY-3',
  },
  faculty: {
    id: 'usr-011',
    name: 'Dr. Avinash Pathengay',
    email: 'avinash@lvpei.org',
    role: 'faculty',
    specialization: 'Vitreoretinal Surgery',
    designation: 'Senior Consultant',
    department: 'Vitreoretinal Surgery',
  },
  program_director: {
    id: 'usr-014',
    name: 'Dr. Gullapalli N. Rao',
    email: 'gnrao@lvpei.org',
    role: 'program_director',
    specialization: 'Cornea',
    designation: 'Director of Education',
    department: 'Administration',
  },
  admin: {
    id: 'usr-015',
    name: 'Rajesh Kumar',
    email: 'rajesh@lvpei.org',
    role: 'admin',
    designation: 'System Administrator',
    department: 'IT',
  },
}

interface RoleContextType {
  currentUser: User
  currentRole: UserRole
  switchRole: (role: UserRole) => void
  allRoles: UserRole[]
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentRole, setCurrentRole] = useState<UserRole>('resident')

  const switchRole = (role: UserRole) => setCurrentRole(role)

  return (
    <RoleContext.Provider
      value={{
        currentUser: DEMO_USERS[currentRole],
        currentRole,
        switchRole,
        allRoles: ['resident', 'faculty', 'program_director', 'admin'],
      }}
    >
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  const context = useContext(RoleContext)
  if (!context) throw new Error('useRole must be used within RoleProvider')
  return context
}
