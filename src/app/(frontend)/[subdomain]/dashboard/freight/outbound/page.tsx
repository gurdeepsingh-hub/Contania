'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Package, Plus, Search, Eye, Edit, Trash2, PackageX } from 'lucide-react'
import { toast } from 'sonner'
import { hasViewPermission } from '@/lib/permissions'
import Link from 'next/link'

type OutboundJob = {
  id: number
  jobCode?: string
  status?: string
  requiredDateTime?: string
  customerName?: string
  customerToName?: string
  customerFromName?: string
  warehouseId?: number | { id: number; name?: string }
  createdAt: string
}

export default function OutboundFreightPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [jobs, setJobs] = useState<OutboundJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [authChecked, setAuthChecked] = useState(false)
  const [currentUser, setCurrentUser] = useState<{
    id?: number
    role?: number | string | { id: number; permissions?: Record<string, boolean> }
  } | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/tenant-users/me')
        if (!res.ok) {
          router.push('/')
          return
        }
        const data = await res.json()
        if (data.success && data.user) {
          const fullUserRes = await fetch(`/api/tenant-users/${data.user.id}?depth=1`)
          if (fullUserRes.ok) {
            const fullUserData = await fullUserRes.json()
            if (fullUserData.success && fullUserData.user) {
              setCurrentUser(fullUserData.user)
              if (!hasViewPermission(fullUserData.user, 'freight')) {
                router.push('/dashboard')
                return
              }
            }
          } else {
            setCurrentUser(data.user)
          }
          setAuthChecked(true)
        }
      } catch (error) {
        router.push('/')
      }
    }

    if (!loading && tenant) {
      checkAuth()
    }
  }, [loading, tenant, router])

  useEffect(() => {
    if (tenant && authChecked) {
      loadJobs()
    }
  }, [tenant, authChecked, searchTerm, statusFilter])

  const loadJobs = async () => {
    try {
      setLoadingJobs(true)
      let url = '/api/outbound-inventory?limit=50'
      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`
      }
      if (statusFilter) {
        url += `&status=${encodeURIComponent(statusFilter)}`
      }
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setJobs(data.jobs || [])
      }
    } catch (error) {
      console.error('Error loading jobs:', error)
    } finally {
      setLoadingJobs(false)
    }
  }

  const handleDelete = async (jobId: number) => {
    if (!confirm('Are you sure you want to delete this job?')) {
      return
    }

    try {
      const res = await fetch(`/api/outbound-inventory/${jobId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Job deleted successfully')
        loadJobs()
      } else {
        toast.error('Failed to delete job')
      }
    } catch (error) {
      console.error('Error deleting job:', error)
      toast.error('Failed to delete job')
    }
  }

  if (loading || !authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Tenant not found</div>
      </div>
    )
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'partially_allocated':
        return 'text-blue-400'
      case 'allocated':
        return 'text-blue-600'
      case 'ready_to_pick':
        return 'text-yellow-600'
      case 'partially_picked':
        return 'text-orange-400'
      case 'picked':
        return 'text-orange-600'
      case 'ready_to_dispatch':
        return 'text-green-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'draft':
        return 'Draft'
      case 'partially_allocated':
        return 'Partially Allocated'
      case 'allocated':
        return 'Allocated'
      case 'ready_to_pick':
        return 'Ready to Pick'
      case 'partially_picked':
        return 'Partially Picked'
      case 'picked':
        return 'Picked'
      case 'ready_to_dispatch':
        return 'Ready to Dispatch'
      default:
        return 'Draft'
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Outbound Freight</h1>
          <p className="text-muted-foreground">Manage outbound inventory jobs</p>
        </div>
        <Link href="/dashboard/freight/outbound/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Button>
        </Link>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by job code, customer, or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="partially_allocated">Partially Allocated</option>
              <option value="allocated">Allocated</option>
              <option value="ready_to_pick">Ready to Pick</option>
              <option value="partially_picked">Partially Picked</option>
              <option value="picked">Picked</option>
              <option value="ready_to_dispatch">Ready to Dispatch</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Jobs List */}
      {loadingJobs ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">Loading jobs...</div>
          </CardContent>
        </Card>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No jobs found</p>
              <p className="mb-4">
                {searchTerm || statusFilter
                  ? 'Try adjusting your search terms or filters.'
                  : 'Create your first outbound freight job to get started.'}
              </p>
              {!searchTerm && !statusFilter && (
                <Link href="/dashboard/freight/outbound/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Job
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const statusColor = getStatusColor(job.status)
            const statusLabel = getStatusLabel(job.status)
            return (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle>
                          {job.jobCode ? `Job ${job.jobCode}` : `Job #${job.id}`}
                        </CardTitle>
                        <span className={`text-sm font-medium ${statusColor}`}>{statusLabel}</span>
                      </div>
                      <CardDescription className="space-y-1">
                        {job.requiredDateTime && (
                          <div>Required: {new Date(job.requiredDateTime).toLocaleDateString()}</div>
                        )}
                        {job.customerName && <div>Customer: {job.customerName}</div>}
                        {job.customerToName && <div>To: {job.customerToName}</div>}
                        {job.customerFromName && <div>From: {job.customerFromName}</div>}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {job.status !== 'ready_to_dispatch' && (
                        <Link href={`/dashboard/freight/outbound/${job.id}/edit`}>
                          <Button variant="outline" size="sm" title="Edit Job">
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </Link>
                      )}
                      <Link href={`/dashboard/freight/outbound/${job.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </Link>
                      {job.status === 'draft' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(job.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}






