'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Plus, ChevronLeft, ChevronRight, Package, Truck } from 'lucide-react'
import { hasViewPermission } from '@/lib/permissions'
import Link from 'next/link'
import { StatusBadge } from '@/components/container-bookings/status-badge'
import { BookingActionsMenu } from '@/components/container-bookings/booking-actions-menu'
import { Badge } from '@/components/ui/badge'

type BookingStatus = 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'

type ImportBooking = {
  id: number
  bookingCode?: string
  customerReference?: string
  bookingReference?: string
  status: BookingStatus
  eta?: string
  createdAt: string
  consigneeId?: number | { id: number; name?: string }
}

type ExportBooking = {
  id: number
  bookingCode?: string
  customerReference?: string
  bookingReference?: string
  status: BookingStatus
  etd?: string
  createdAt: string
  consignorId?: number | { id: number; name?: string }
}

type UnifiedBooking = (ImportBooking | ExportBooking) & {
  type: 'import' | 'export'
  displayDate?: string
}

export default function ContainerBookingsPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [bookings, setBookings] = useState<UnifiedBooking[]>([])
  const [loadingBookings, setLoadingBookings] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'import' | 'export'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [hasPrevPage, setHasPrevPage] = useState(false)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [currentUser, setCurrentUser] = useState<{
    id?: number
    role?: number | string | { id: number; permissions?: Record<string, boolean> }
  } | null>(null)

  const limit = 20

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
  }, [tenant, authChecked, page, searchTerm, typeFilter, statusFilter])

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

      const promises: Promise<Response>[] = []
      
      if (typeFilter === 'all' || typeFilter === 'import') {
        promises.push(fetch(`/api/import-container-bookings?${params.toString()}`))
      }
      if (typeFilter === 'all' || typeFilter === 'export') {
        promises.push(fetch(`/api/export-container-bookings?${params.toString()}`))
      }

      const responses = await Promise.all(promises)
      const results = await Promise.all(responses.map((r) => r.json()))

      const unifiedBookings: UnifiedBooking[] = []

      if (results[0]?.success && results[0]?.importContainerBookings) {
        results[0].importContainerBookings.forEach((booking: ImportBooking) => {
          unifiedBookings.push({
            ...booking,
            type: 'import',
            displayDate: booking.eta || booking.createdAt,
          })
        })
      }

      if (results[1]?.success && results[1]?.exportContainerBookings) {
        results[1].exportContainerBookings.forEach((booking: ExportBooking) => {
          unifiedBookings.push({
            ...booking,
            type: 'export',
            displayDate: booking.etd || booking.createdAt,
          })
        })
      }

      // Sort by date (newest first)
      unifiedBookings.sort((a, b) => {
        const dateA = new Date(a.displayDate || a.createdAt).getTime()
        const dateB = new Date(b.displayDate || b.createdAt).getTime()
        return dateB - dateA
      })

      setBookings(unifiedBookings)
      
      // Use pagination info from first result if available
      if (results[0]?.totalPages) {
        setTotalPages(Math.max(results[0].totalPages, results[1]?.totalPages || 1))
        setHasPrevPage(page > 1)
        setHasNextPage(page < Math.max(results[0].totalPages, results[1]?.totalPages || 1))
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Container Bookings</h1>
          <p className="text-muted-foreground">Manage import and export container bookings</p>
        </div>
        <Link href="/dashboard/container-bookings/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Booking
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by booking code, customer ref, booking ref..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setPage(1)
                }}
                className="pl-10"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as 'all' | 'import' | 'export')
                setPage(1)
              }}
              className="px-3 py-2 border rounded-md"
            >
              <option value="all">All Types</option>
              <option value="import">Import</option>
              <option value="export">Export</option>
            </select>
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
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No bookings found</p>
              <p className="mb-4">
                {searchTerm || statusFilter || typeFilter !== 'all'
                  ? 'Try adjusting your search terms or filters.'
                  : 'Create your first container booking to get started.'}
              </p>
              {!searchTerm && !statusFilter && typeFilter === 'all' && (
                <Link href="/dashboard/container-bookings/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Booking
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {bookings.map((booking) => (
              <Card key={`${booking.type}-${booking.id}`} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle>
                          {booking.bookingCode || `${booking.type.toUpperCase()}-${booking.id}`}
                        </CardTitle>
                        <StatusBadge status={booking.status} type={booking.type} />
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                          {booking.type === 'import' ? (
                            <>
                              <Package className="h-3 w-3 mr-1" />
                              Import
                            </>
                          ) : (
                            <>
                              <Truck className="h-3 w-3 mr-1" />
                              Export
                            </>
                          )}
                        </Badge>
                      </div>
                      <CardDescription className="space-y-1">
                        {booking.customerReference && (
                          <div>Customer Ref: {booking.customerReference}</div>
                        )}
                        {booking.bookingReference && (
                          <div>Booking Ref: {booking.bookingReference}</div>
                        )}
                        {booking.displayDate && (
                          <div>
                            {booking.type === 'import' ? 'ETA' : 'ETD'}:{' '}
                            {new Date(booking.displayDate).toLocaleDateString()}
                          </div>
                        )}
                      </CardDescription>
                    </div>
                    <BookingActionsMenu booking={booking} bookingType={booking.type} />
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {(hasPrevPage || hasNextPage) && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!hasPrevPage}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasNextPage}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

