'use client'

import { useState, useMemo } from 'react'
import { Users, Search, UserPlus, Pencil, UserX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import usersData from '@/mock-data/users.json'
import { PageTransition, StaggerItem, motion, staggerContainer, staggerItem } from '@/lib/motion'

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

interface User {
  id: string
  name: string
  email: string
  role: string
  specialization: string
  designation: string
  department: string
  yearOfTraining?: string
}

const roleBadgeClass: Record<string, string> = {
  resident: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  faculty: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  program_director: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  admin: 'bg-slate-500/10 text-slate-700 dark:text-slate-400',
}

function formatRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UserManagementPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const users = usersData as User[]

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users
    const q = searchQuery.toLowerCase()
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q)
    )
  }, [users, searchQuery])

  return (
    <PageTransition className="space-y-6">
      {/* Page header */}
      <StaggerItem>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="size-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
            </div>
          </div>
          <Button>
            <UserPlus className="size-4 mr-1.5" />
            Add User
          </Button>
        </div>
      </StaggerItem>

      {/* Search */}
      <StaggerItem>
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </StaggerItem>

      {/* Table */}
      <StaggerItem>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Department</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <motion.tbody
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              {filteredUsers.map((user, index) => (
                <motion.tr
                  key={user.id}
                  variants={staggerItem}
                  className={`border-b last:border-0 ${index % 2 === 1 ? 'bg-muted/20' : ''}`}
                >
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadgeClass[user.role] ?? 'bg-muted text-muted-foreground'}`}
                    >
                      {formatRole(user.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.department}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                      Active
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" className="size-8 p-0">
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="size-8 p-0 text-destructive hover:text-destructive">
                        <UserX className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </div>
      </StaggerItem>

      <StaggerItem>
        <p className="text-xs text-muted-foreground">
          Showing {filteredUsers.length} of {users.length} users
        </p>
      </StaggerItem>
    </PageTransition>
  )
}
