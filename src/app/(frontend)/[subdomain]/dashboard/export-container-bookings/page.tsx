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
import { Search, Plus, Package, Truck } from 'lucide-react'
import { hasViewPermission } from '@/lib/permissions'
import Link from 'next/link'
import { StatusBadge } from '@/components/container-bookings/status-badge'
import { BookingActionsMenu } from '@/components/container-bookings/booking-actions-menu'

type BookingStatus = 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'

type ExportBooking = {
  id: number
  bookingCode?: string
  customerReference?: string
  bookingReference?: string
  status: BookingStatus
  etd?: string
  receivalStart?: string
  cutoff?: boolean
  createdAt: string
  consignorId?: number | { id: number; name?: string }
  productLineCount?: number
}

export default function ExportContainerBookingsPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [bookings, setBookings] = useState<ExportBooking[]>([])
  const [loadingBookings, setLoadingBookings] = useState(false)
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
              if (!hasViewPermission(fullUserData.user, 'containers')) {
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
      loadBookings()
    }
  }, [tenant, authChecked, page, searchTerm, statusFilter])

  const loadBookings = async () => {
    try {
      setLoadingBookings(true)
      
      const params = new URLSearchParams()
      params.set('limit', limit.toString())
      params.set('page', page.toString())
      params.set('sort', '-createdAt')
      if (searchTerm) {
        params.set('search', searchTerm)
      }
      if (statusFilter) {
        params.set('status', statusFilter)
      }

      const res = await fetch(`/api/export-container-bookings?${params.toString()}`)
      const data = await res.json()

      if (data.success) {
        setBookings(data.exportContainerBookings || [])
        setTotalPages(data.totalPages || 1)
        setHasPrevPage(data.hasPrevPage || false)
        setHasNextPage(data.hasNextPage || false)
      }
    } catch (error) {
      console.error('Error loading bookings:', error)
    } finally {
      setLoadingBookings(false)
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

  const getConsignorName = (consignorId?: number | { id: number; name?: string }): string => {
    if (!consignorId) return '-'
    if (typeof consignorId === 'object') {
      return consignorId.name || '-'
    }
    return '-'
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit)
    setPage(1) // Reset to first page when changing limit
  }

  const handleTabSwitch = (targetPath: string) => {
    router.prefetch(targetPath)
    router.push(targetPath)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Export Container Bookings</h1>
          <p className="text-muted-foreground">Manage export container bookings</p>
        </div>
        <Link href="/dashboard/export-container-bookings/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Export Booking
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => handleTabSwitch('/dashboard/import-container-bookings')}
          className="px-4 py-2 font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
        >
          <Package className="h-4 w-4 inline mr-2" />
          Import Container
        </button>
        <button className="px-4 py-2 font-medium border-b-2 border-primary text-primary">
          <Truck className="h-4 w-4 inline mr-2" />
          Export Container
        </button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by booking code, customer ref, booking ref, consignor..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setPage(1)
                }}
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
              <option value="confirmed">Confirmed</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
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

      {/* Bookings List */}
      {loadingBookings ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">Loading bookings...</div>
          </CardContent>
        </Card>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No export bookings found</p>
              <p className="mb-4">
                {searchTerm || statusFilter
                  ? 'Try adjusting your search terms or filters.'
                  : 'Create your first export container booking to get started.'}
              </p>
              {!searchTerm && !statusFilter && (
                <Link href="/dashboard/export-container-bookings/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Export Booking
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {bookings.map((booking) => {
              // If no product lines, always show draft status
              const displayStatus = (!booking.productLineCount || booking.productLineCount === 0) ? 'draft' : booking.status
              return (
              <Card key={booking.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle>
                          {booking.bookingCode || `EXP-${booking.id}`}
                        </CardTitle>
                        <StatusBadge status={displayStatus} type="export" />
                      </div>
                      <CardDescription className="space-y-1">
                        {booking.customerReference && (
                          <div>Customer Ref: {booking.customerReference}</div>
                        )}
                        {booking.bookingReference && (
                          <div>Booking Ref: {booking.bookingReference}</div>
                        )}
                        {booking.consignorId && (
                          <div>Consignor: {getConsignorName(booking.consignorId)}</div>
                        )}
                        {booking.etd && (
                          <div>ETD: {new Date(booking.etd).toLocaleDateString()}</div>
                        )}
                        {booking.receivalStart && (
                          <div>Receival Start: {new Date(booking.receivalStart).toLocaleDateString()}</div>
                        )}
                        {booking.cutoff && (
                          <div>Cutoff: Yes</div>
                        )}
                      </CardDescription>
                    </div>
                    <BookingActionsMenu booking={booking} bookingType="export" />
                  </div>
                </CardHeader>
              </Card>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {bookings.length} booking{bookings.length !== 1 ? 's' : ''} on page {page} of {totalPages}
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
        </>
      )}
    </div>
  )
}

