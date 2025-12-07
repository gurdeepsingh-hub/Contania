'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DriverFormDialog } from '@/components/entity-forms/driver-form-dialog'
import {
  User,
  Plus,
  Edit,
  Trash2,
  ArrowLeft,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { hasPermission } from '@/lib/permissions'
import { Input } from '@/components/ui/input'

type DriverItem = {
  id: number
  name: string
  phoneNumber: string
  vehicleId?: number | { id: number; fleetNumber?: string }
  defaultDepotId?: number | { id: number; name?: string }
  abn?: string
  addressStreet?: string
  city?: string
  state?: string
  postcode?: string
  employeeType: string
  drivingLicenceNumber: string
  licenceExpiry?: string
  licencePhotoUrl?: number | { id: number; url?: string }
  dangerousGoodsCertNumber?: string
  dangerousGoodsCertExpiry?: string
  msicNumber?: string
  msicExpiry?: string
  msicPhotoUrl?: number | { id: number; url?: string }
}

type Vehicle = {
  id: number
  fleetNumber: string
}

type Warehouse = {
  id: number
  name: string
}

type TenantUser = {
  id?: number | string
  role?: number | string | { id: number; permissions?: Record<string, boolean> }
  [key: string]: unknown
}

export default function DriversPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)
  const [_currentUser, setCurrentUser] = useState<TenantUser | null>(null)
  const [drivers, setDrivers] = useState<DriverItem[]>([])
  const [loadingDrivers, setLoadingDrivers] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingDriver, setEditingDriver] = useState<DriverItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Pagination state
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [totalDocs, setTotalDocs] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [hasPrevPage, setHasPrevPage] = useState(false)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/tenant-users/me')
        if (!res.ok) {
          router.push('/dashboard')
          return
        }
        const data = await res.json()
        if (data.success && data.user) {
          const fullUserRes = await fetch(`/api/tenant-users/${data.user.id}?depth=1`)
          if (fullUserRes.ok) {
            const fullUserData = await fullUserRes.json()
            if (fullUserData.success && fullUserData.user) {
              setCurrentUser(fullUserData.user)
              if (!hasPermission(fullUserData.user, 'settings_entity_settings')) {
                router.push('/dashboard/settings/entity-settings')
                return
              }
              setAuthChecked(true)
              return
            }
          }
          setCurrentUser(data.user)
          setAuthChecked(true)
        }
      } catch (_error) {
        router.push('/dashboard')
      }
    }

    if (!loading && tenant) {
      checkAuth()
    }
  }, [loading, tenant, router])

  useEffect(() => {
    if (authChecked) {
      loadDrivers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, page, limit, searchQuery])

  const loadDrivers = async () => {
    try {
      setLoadingDrivers(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        depth: '1',
        ...(searchQuery && { search: searchQuery }),
      })
      const res = await fetch(`/api/drivers?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.drivers) {
          setDrivers(data.drivers)
          setTotalDocs(data.totalDocs || 0)
          setTotalPages(data.totalPages || 0)
          setHasPrevPage(data.hasPrevPage || false)
          setHasNextPage(data.hasNextPage || false)
        }
      }
    } catch (error) {
      console.error('Error loading drivers:', error)
    } finally {
      setLoadingDrivers(false)
    }
  }


  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setPage(1)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleAddDriver = () => {
    setEditingDriver(null)
    setShowAddForm(true)
    setError(null)
    setSuccess(null)
  }

  const handleEditDriver = (driver: DriverItem) => {
    setEditingDriver(driver)
    setShowAddForm(true)
    setError(null)
    setSuccess(null)
  }

  const handleDriverSuccess = async () => {
    await loadDrivers()
    setShowAddForm(false)
    setEditingDriver(null)
  }

  const handleDeleteDriver = async (driver: DriverItem) => {
    if (!confirm(`Are you sure you want to delete ${driver.name}? This action cannot be undone.`)) {
      return
    }

    try {
      const res = await fetch(`/api/drivers/${driver.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setSuccess('Driver deleted successfully')
        await loadDrivers()
        setTimeout(() => setSuccess(null), 2000)
      } else {
        const data = await res.json()
        setError(data.message || 'Failed to delete driver')
      }
    } catch (error) {
      console.error('Error deleting driver:', error)
      setError('An error occurred while deleting the driver')
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
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/dashboard/settings/entity-settings')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Drivers</h1>
          <p className="text-muted-foreground">Manage driver information</p>
        </div>
        <Button
          onClick={handleAddDriver}
          className="min-h-[44px]"
          size="icon"
          title="Add Driver"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          {success}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{error}</div>
      )}

      <DriverFormDialog
        open={showAddForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddForm(false)
            setEditingDriver(null)
          }
        }}
        initialData={editingDriver}
        mode={editingDriver ? 'edit' : 'create'}
        onSuccess={handleDriverSuccess}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Drivers ({totalDocs})
              </CardTitle>
              <CardDescription>Manage driver information</CardDescription>
            </div>
            <div className="relative max-w-sm w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search drivers..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingDrivers ? (
            <div className="text-center py-8 text-muted-foreground">Loading drivers...</div>
          ) : drivers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No drivers found matching your search' : 'No drivers found'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {drivers.map((driver) => (
                  <Card key={driver.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg font-semibold line-clamp-1 pr-2">
                          {driver.name}
                        </CardTitle>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditDriver(driver)}
                            className="h-8 w-8"
                            title="Edit Driver"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteDriver(driver)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete Driver"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-start gap-2">
                          <span className="font-medium min-w-[100px]">Phone:</span>
                          <span>{driver.phoneNumber}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-medium min-w-[100px]">Employee:</span>
                          <span>{driver.employeeType}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-medium min-w-[100px]">Licence:</span>
                          <span>{driver.drivingLicenceNumber}</span>
                        </div>
                        {driver.vehicleId && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[100px]">Vehicle:</span>
                            <span>
                              {typeof driver.vehicleId === 'object'
                                ? driver.vehicleId.fleetNumber
                                : 'N/A'}
                            </span>
                          </div>
                        )}
                        {driver.defaultDepotId && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[100px]">Depot:</span>
                            <span>
                              {typeof driver.defaultDepotId === 'object'
                                ? driver.defaultDepotId.name
                                : 'N/A'}
                            </span>
                          </div>
                        )}
                        {(driver.city || driver.state) && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[100px]">Location:</span>
                            <span>{[driver.city, driver.state].filter(Boolean).join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {drivers.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
                    {Math.min(page * limit, totalDocs)} of {totalDocs} drivers
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={!hasPrevPage || loadingDrivers}
                      className="min-h-[44px] min-w-[44px]"
                      title="Previous Page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1">
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
                          <Button
                            key={pageNum}
                            variant={pageNum === page ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                            disabled={loadingDrivers}
                            className="min-w-[44px] min-h-[44px]"
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={!hasNextPage || loadingDrivers}
                      className="min-h-[44px] min-w-[44px]"
                      title="Next Page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

