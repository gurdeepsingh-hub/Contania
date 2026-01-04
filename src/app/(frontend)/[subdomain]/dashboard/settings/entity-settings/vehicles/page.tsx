'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { VehicleFormDialog } from '@/components/entity-forms/vehicle-form-dialog'
import {
  Truck,
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
import { toast } from 'sonner'

type VehicleItem = {
  id: number
  fleetNumber: string
  rego: string
  regoExpiryDate?: string
  gpsId?: string
  description?: string
  defaultDepotId?: number | { id: number; name?: string }
  aTrailerId?: number | { id: number; fleetNumber?: string; rego?: string }
  bTrailerId?: number | { id: number; fleetNumber?: string; rego?: string }
  cTrailerId?: number | { id: number; fleetNumber?: string; rego?: string }
  sideloader?: boolean
}

type Trailer = {
  id: number
  fleetNumber: string
  rego: string
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

export default function VehiclesPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)
  const [_currentUser, setCurrentUser] = useState<TenantUser | null>(null)
  const [vehicles, setVehicles] = useState<VehicleItem[]>([])
  const [loadingVehicles, setLoadingVehicles] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<VehicleItem | null>(null)

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
      loadVehicles()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, page, limit, searchQuery])

  const loadVehicles = async () => {
    try {
      setLoadingVehicles(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        depth: '1',
        ...(searchQuery && { search: searchQuery }),
      })
      const res = await fetch(`/api/vehicles?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.vehicles) {
          setVehicles(data.vehicles)
          setTotalDocs(data.totalDocs || 0)
          setTotalPages(data.totalPages || 0)
          setHasPrevPage(data.hasPrevPage || false)
          setHasNextPage(data.hasNextPage || false)
        }
      }
    } catch (error) {
      console.error('Error loading vehicles:', error)
    } finally {
      setLoadingVehicles(false)
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

  const handleAddVehicle = () => {
    setEditingVehicle(null)
    setShowAddForm(true)
  }

  const handleEditVehicle = (vehicle: VehicleItem) => {
    setEditingVehicle(vehicle)
    setShowAddForm(true)
  }

  const handleVehicleSuccess = async () => {
    await loadVehicles()
    setShowAddForm(false)
    setEditingVehicle(null)
  }

  const handleDeleteVehicle = async (vehicle: VehicleItem) => {
    if (
      !confirm(`Are you sure you want to delete ${vehicle.fleetNumber}? This action cannot be undone.`)
    ) {
      return
    }

    try {
      const res = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Vehicle deleted successfully')
        await loadVehicles()
      } else {
        const data = await res.json()
        toast.error(data.message || 'Failed to delete vehicle')
      }
    } catch (error) {
      console.error('Error deleting vehicle:', error)
      toast.error('An error occurred while deleting the vehicle')
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
          <h1 className="text-3xl font-bold">Vehicles</h1>
          <p className="text-muted-foreground">Manage vehicle information</p>
        </div>
        <Button
          onClick={handleAddVehicle}
          className="min-h-[44px]"
          size="icon"
          title="Add Vehicle"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <VehicleFormDialog
        open={showAddForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddForm(false)
            setEditingVehicle(null)
          }
        }}
        initialData={editingVehicle}
        mode={editingVehicle ? 'edit' : 'create'}
        onSuccess={handleVehicleSuccess}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Vehicles ({totalDocs})
              </CardTitle>
              <CardDescription>Manage vehicle information</CardDescription>
            </div>
            <div className="relative max-w-sm w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vehicles..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingVehicles ? (
            <div className="text-center py-8 text-muted-foreground">Loading vehicles...</div>
          ) : vehicles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No vehicles found matching your search' : 'No vehicles found'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {vehicles.map((vehicle) => (
                  <Card key={vehicle.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg font-semibold line-clamp-1 pr-2">
                          {vehicle.fleetNumber}
                        </CardTitle>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditVehicle(vehicle)}
                            className="h-8 w-8"
                            title="Edit Vehicle"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteVehicle(vehicle)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete Vehicle"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-start gap-2">
                          <span className="font-medium min-w-[100px]">Registration:</span>
                          <span>{vehicle.rego}</span>
                        </div>
                        {vehicle.gpsId && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[100px]">GPS ID:</span>
                            <span>{vehicle.gpsId}</span>
                          </div>
                        )}
                        {vehicle.defaultDepotId && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[100px]">Depot:</span>
                            <span>
                              {typeof vehicle.defaultDepotId === 'object'
                                ? vehicle.defaultDepotId.name
                                : 'N/A'}
                            </span>
                          </div>
                        )}
                        {(() => {
                          const trailerParts = [
                            vehicle.aTrailerId &&
                              typeof vehicle.aTrailerId === 'object' &&
                              vehicle.aTrailerId.fleetNumber &&
                              vehicle.aTrailerId.rego
                              ? `A: ${vehicle.aTrailerId.fleetNumber} (${vehicle.aTrailerId.rego})`
                              : vehicle.aTrailerId
                                ? 'A: N/A'
                                : null,
                            vehicle.bTrailerId &&
                              typeof vehicle.bTrailerId === 'object' &&
                              vehicle.bTrailerId.fleetNumber &&
                              vehicle.bTrailerId.rego
                              ? `B: ${vehicle.bTrailerId.fleetNumber} (${vehicle.bTrailerId.rego})`
                              : vehicle.bTrailerId
                                ? 'B: N/A'
                                : null,
                            vehicle.cTrailerId &&
                              typeof vehicle.cTrailerId === 'object' &&
                              vehicle.cTrailerId.fleetNumber &&
                              vehicle.cTrailerId.rego
                              ? `C: ${vehicle.cTrailerId.fleetNumber} (${vehicle.cTrailerId.rego})`
                              : vehicle.cTrailerId
                                ? 'C: N/A'
                                : null,
                          ].filter(Boolean)
                          
                          return trailerParts.length > 0 ? (
                            <div className="flex items-start gap-2">
                              <span className="font-medium min-w-[100px]">Trailers:</span>
                              <span>{trailerParts.join(', ')}</span>
                            </div>
                          ) : null
                        })()}
                        {vehicle.sideloader && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[100px]">Sideloader:</span>
                            <span>Yes</span>
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
                    Showing {vehicles.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
                    {Math.min(page * limit, totalDocs)} of {totalDocs} vehicles
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={!hasPrevPage || loadingVehicles}
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
                            disabled={loadingVehicles}
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
                      disabled={!hasNextPage || loadingVehicles}
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

