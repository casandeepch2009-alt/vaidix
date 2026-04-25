'use client'

import { useState, useEffect } from 'react'
import { Building2, X, Plus, Upload } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import institutionData from '@/mock-data/institution.json'
import { PageTransition, StaggerItem, motion } from '@/lib/motion'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InstitutionSetupPage() {
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [departments, setDepartments] = useState<string[]>([])
  const [newDept, setNewDept] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  // Load mock data on mount
  useEffect(() => {
    setName(institutionData.name)
    setCity(institutionData.city)
    setState(institutionData.state)
    setDepartments([...institutionData.departments])
    setEmail('admin@lvpei.org')
    setPhone('+91 40 3061 2345')
    setAddress('Kallam Anji Reddy Campus, L V Prasad Marg, Banjara Hills, Hyderabad, Telangana 500034')
  }, [])

  const removeDepartment = (index: number) => {
    setDepartments((prev) => prev.filter((_, i) => i !== index))
  }

  const addDepartment = () => {
    const trimmed = newDept.trim()
    if (trimmed && !departments.includes(trimmed)) {
      setDepartments((prev) => [...prev, trimmed])
      setNewDept('')
    }
  }

  return (
    <PageTransition className="space-y-6">
      {/* Page header */}
      <StaggerItem>
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="size-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Institution Setup</h1>
          </div>
        </div>
      </StaggerItem>

      {/* Form card */}
      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle>Institution Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Institution name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Institution Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {/* City & State */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">City</label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">State</label>
                <Input value={state} onChange={(e) => setState(e.target.value)} />
              </div>
            </div>

            <Separator />

            {/* Departments */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Departments</label>
              <div className="flex flex-wrap gap-2">
                {departments.map((dept, idx) => (
                  <motion.span
                    key={dept}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25 }}
                    className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-3 py-1 text-sm"
                  >
                    {dept}
                    <button
                      type="button"
                      onClick={() => removeDepartment(idx)}
                      className="rounded-full p-0.5 hover:bg-muted"
                    >
                      <X className="size-3 text-muted-foreground" />
                    </button>
                  </motion.span>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  placeholder="Add department..."
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addDepartment()}
                  className="max-w-xs"
                />
                <Button variant="outline" size="sm" onClick={addDepartment}>
                  <Plus className="size-3.5 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            <Separator />

            {/* Contact info */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Contact Email</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Phone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Address</label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} />
            </div>

            {/* Logo upload */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Logo</label>
              <div className="flex items-center justify-center rounded-lg border-2 border-dashed bg-muted/30 p-8">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="size-8" />
                  <p className="text-sm">Click or drag to upload logo</p>
                  <p className="text-xs">PNG, SVG up to 2MB</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button>Save Changes</Button>
            </div>
          </CardContent>
        </Card>
      </StaggerItem>
    </PageTransition>
  )
}
