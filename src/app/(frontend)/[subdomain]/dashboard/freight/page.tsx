'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Truck, Package, Plus } from 'lucide-react'
import { hasViewPermission } from '@/lib/permissions'
import Link from 'next/link'

type InboundJob = {
  id: number
  jobCode?: string
  expectedDate?: string
  completedDate?: string
  customerName?: string
  supplierName?: string
  warehouseId?: number | { id: number; name?: string }
  createdAt: string
}

type OutboundJob = {
  id: number
  jobCode?: string
  status?: string
  requiredDateTime?: string
  customerName?: string
  customerToName?: string
  customerFromName?: string
  createdAt: string
}

export default function FreightPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [inboundJobs, setInboundJobs] = useState<InboundJob[]>([])
  const [outboundJobs, setOutboundJobs] = useState<OutboundJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ id?: number; role?: number | string | { id: number; permissions?: Record<string, boolean> } } | null>(null)
  const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>('inbound')

  // Check tenant-user authentication and permissions
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
      if (activeTab === 'inbound') {
        loadInboundJobs()
      } else {
        loadOutboundJobs()
      }
    }
  }, [tenant, authChecked, activeTab])

  const loadInboundJobs = async () => {
    try {
      setLoadingJobs(true)
      const res = await fetch('/api/inbound-inventory?limit=5')
      if (res.ok) {
        const data = await res.json()
        setInboundJobs(data.jobs || [])
      }
    } catch (error) {
      console.error('Error loading inbound jobs:', error)
    } finally {
      setLoadingJobs(false)
    }
  }

  const loadOutboundJobs = async () => {
    try {
      setLoadingJobs(true)
      const res = await fetch('/api/outbound-inventory?limit=5')
      if (res.ok) {
        const data = await res.json()
        setOutboundJobs(data.jobs || [])
      }
    } catch (error) {
      console.error('Error loading outbound jobs:', error)
    } finally {
      setLoadingJobs(false)
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Freight</h1>
          <p className="text-muted-foreground">Manage inbound and outbound freight</p>
        </div>
        {activeTab === 'inbound' && (
          <Link href="/dashboard/freight/inbound/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Inbound Job
            </Button>
          </Link>
        )}
        {activeTab === 'outbound' && (
          <Link href="/dashboard/freight/outbound/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Outbound Job
            </Button>
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => setActiveTab('inbound')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'inbound'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Package className="h-4 w-4 inline mr-2" />
          Inbound Freight
        </button>
        <button
          onClick={() => setActiveTab('outbound')}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'outbound'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Truck className="h-4 w-4 inline mr-2" />
          Outbound Freight
        </button>
      </div>

      {/* Content */}
      {activeTab === 'inbound' ? (
        <div className="space-y-4">
          {loadingJobs ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">Loading jobs...</div>
              </CardContent>
            </Card>
          ) : inboundJobs.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No inbound jobs yet</p>
                  <p className="mb-4">Create your first inbound freight job to get started.</p>
                  <Link href="/dashboard/freight/inbound/new">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Inbound Job
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {inboundJobs.map((job) => {
                const getStatus = (job: InboundJob) => {
                  if (job.completedDate) return { label: 'Received', color: 'text-green-600' }
                  if (job.expectedDate) return { label: 'Expected', color: 'text-blue-600' }
                  return { label: 'Draft', color: 'text-gray-600' }
                }
                const status = getStatus(job)
                return (
                  <Card key={job.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <CardTitle>
                              {job.jobCode ? `Job ${job.jobCode}` : `Job #${job.id}`}
                            </CardTitle>
                            <Badge variant="outline" className={status.color}>
                              {status.label}
                            </Badge>
                          </div>
                          <CardDescription>
                            {job.expectedDate && `Expected: ${new Date(job.expectedDate).toLocaleDateString()}`}
                            {job.completedDate && ` • Completed: ${new Date(job.completedDate).toLocaleDateString()}`}
                            {job.customerName && ` • Customer: ${job.customerName}`}
                            {job.supplierName && ` • Supplier: ${job.supplierName}`}
                          </CardDescription>
                        </div>
                        <Link href={`/dashboard/freight/inbound/${job.id}`}>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </Link>
                      </div>
                    </CardHeader>
                  </Card>
                )
              })}
              <div className="text-center">
                <Link href="/dashboard/freight/inbound">
                  <Button variant="outline">View All Inbound Jobs</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {loadingJobs ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">Loading jobs...</div>
              </CardContent>
            </Card>
          ) : outboundJobs.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">
                  <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">No outbound jobs yet</p>
                  <p className="mb-4">Create your first outbound freight job to get started.</p>
                  <Link href="/dashboard/freight/outbound/new">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Outbound Job
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {outboundJobs.map((job) => {
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
                    case 'dispatched':
                      return 'text-purple-600'
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
                    case 'dispatched':
                      return 'Dispatched'
                    default:
                      return 'Draft'
                  }
                }

                const statusColor = getStatusColor(job.status)
                const statusLabel = getStatusLabel(job.status)

                return (
                  <Card key={job.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <CardTitle>
                              {job.jobCode ? `Job ${job.jobCode}` : `Job #${job.id}`}
                            </CardTitle>
                            <Badge variant="outline" className={statusColor}>
                              {statusLabel}
                            </Badge>
                          </div>
                          <CardDescription>
                            {job.requiredDateTime &&
                              `Required: ${new Date(job.requiredDateTime).toLocaleDateString()}`}
                            {job.customerName && ` • Customer: ${job.customerName}`}
                            {job.customerToName && ` • To: ${job.customerToName}`}
                            {job.customerFromName && ` • From: ${job.customerFromName}`}
                          </CardDescription>
                        </div>
                        <Link href={`/dashboard/freight/outbound/${job.id}`}>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </Link>
                      </div>
                    </CardHeader>
                  </Card>
                )
              })}
              <div className="text-center">
                <Link href="/dashboard/freight/outbound">
                  <Button variant="outline">View All Outbound Jobs</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}








