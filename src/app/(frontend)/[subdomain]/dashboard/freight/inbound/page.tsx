'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Package, Plus, Search, Eye, Trash2, Truck } from 'lucide-react'
import { toast } from 'sonner'
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
  transportMode?: string
  productLineCount?: number
  createdAt: string
}

export default function InboundFreightPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [jobs, setJobs] = useState<InboundJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(5)
  const [totalPages, setTotalPages] = useState(1)
  const [hasPrevPage, setHasPrevPage] = useState(false)
  const [hasNextPage, setHasNextPage] = useState(false)
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
  }, [tenant, authChecked, searchTerm, statusFilter, page, limit])

  const loadJobs = async () => {
    try {
      setLoadingJobs(true)
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', limit.toString())
      if (searchTerm) {
        params.set('search', searchTerm)
      }
      
      const res = await fetch(`/api/inbound-inventory?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        let loadedJobs = data.jobs || []
        
        // Apply status filter client-side since API doesn't support it
        if (statusFilter) {
          loadedJobs = loadedJobs.filter((job: InboundJob) => {
            const status = getStatusValue(job)
            return status === statusFilter
          })
        }
        
        setJobs(loadedJobs)
        setTotalPages(data.totalPages || 1)
        setHasPrevPage(data.hasPrevPage || false)
        setHasNextPage(data.hasNextPage || false)
      }
    } catch (error) {
      console.error('Error loading jobs:', error)
    } finally {
      setLoadingJobs(false)
    }
  }

  const getStatusValue = (job: InboundJob): string => {
    // If no product lines, always return draft
    if (!job.productLineCount || job.productLineCount === 0) {
      return 'draft'
    }
    if (job.completedDate) return 'received'
    if (job.expectedDate) return 'expected'
    return 'draft'
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit)
    setPage(1) // Reset to first page when changing limit
  }

  const handleDelete = async (jobId: number) => {
    if (!confirm('Are you sure you want to delete this job?')) {
      return
    }

    try {
      const res = await fetch(`/api/inbound-inventory/${jobId}`, {
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

  const getStatus = (job: InboundJob) => {
    // If no product lines, always return draft
    if (!job.productLineCount || job.productLineCount === 0) {
      return { label: 'Draft', color: 'text-gray-600' }
    }
    if (job.completedDate) return { label: 'Received', color: 'text-green-600' }
    if (job.expectedDate) return { label: 'Expected', color: 'text-blue-600' }
    return { label: 'Draft', color: 'text-gray-600' }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inbound Freight</h1>
          <p className="text-muted-foreground">Manage inbound inventory jobs</p>
        </div>
        <Link href="/dashboard/freight/inbound/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button className="px-4 py-2 font-medium border-b-2 border-primary text-primary">
          <Package className="h-4 w-4 inline mr-2" />
          Inbound Freight
        </button>
        <Link
          href="/dashboard/freight/outbound"
          className="px-4 py-2 font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
        >
          <Truck className="h-4 w-4 inline mr-2" />
          Outbound Freight
        </Link>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by job code, customer, supplier, or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 border rounded-md"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="expected">Expected</option>
              <option value="received">Received</option>
            </select>
            <select
              value={limit}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              className="px-3 py-2 border rounded-md"
            >
              <option value="5">5 per page</option>
              <option value="10">10 per page</option>
              <option value="15">15 per page</option>
              <option value="20">20 per page</option>
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
                  : 'Create your first inbound freight job to get started.'}
              </p>
              {!searchTerm && !statusFilter && (
                <Link href="/dashboard/freight/inbound/new">
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
            const status = getStatus(job)
            return (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle>
                          {job.jobCode ? `Job ${job.jobCode}` : `Job #${job.id}`}
                        </CardTitle>
                        <span className={`text-sm font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <CardDescription className="space-y-1">
                        {job.expectedDate && (
                          <div>Expected: {new Date(job.expectedDate).toLocaleDateString()}</div>
                        )}
                        {job.completedDate && (
                          <div>Completed: {new Date(job.completedDate).toLocaleDateString()}</div>
                        )}
                        {job.customerName && <div>Customer: {job.customerName}</div>}
                        {job.supplierName && <div>Supplier: {job.supplierName}</div>}
                        {job.transportMode && (
                          <div>
                            Transport: {job.transportMode === 'our' ? 'Our' : 'Third Party'}
                          </div>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/dashboard/freight/inbound/${job.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </Link>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(job.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {jobs.length} job{jobs.length !== 1 ? 's' : ''} on page {page} of {totalPages}
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => handlePageChange(Math.max(1, page - 1))}
                  className={!hasPrevPage ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => handlePageChange(pageNum)}
                      isActive={pageNum === page}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}
              {totalPages > 5 && page < totalPages - 2 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}
              <PaginationItem>
                <PaginationNext
                  onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                  className={!hasNextPage ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}
