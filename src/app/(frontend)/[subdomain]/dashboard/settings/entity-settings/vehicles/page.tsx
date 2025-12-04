'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FormInput, FormSelect } from '@/components/ui/form-field'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Truck,
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  ArrowLeft,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { hasPermission } from '@/lib/permissions'
import { Input } from '@/components/ui/input'

type VehicleItem = {
  id: number
  fleetNumber: string
  rego: string
  regoExpiryDate?: string
  gpsId?: string
  description?: string
  defaultDepotId?: number | { id: number; name?: string }
  aTrailerId?: number | { id: number; name?: string }
  bTrailerId?: number | { id: number; name?: string }
  cTrailerId?: number | { id: number; name?: string }
  sideloader?: boolean
}

type TrailerType = {
  id: number
  name: string
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
  const [trailerTypes, setTrailerTypes] = useState<TrailerType[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loadingVehicles, setLoadingVehicles] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<VehicleItem | null>(null)
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

  const vehicleSchema = z.object({
    fleetNumber: z.string().min(1, 'Fleet number is required'),
    rego: z.string().min(1, 'Registration is required'),
    regoExpiryDate: z.string().optional(),
    gpsId: z.string().optional(),
    description: z.string().optional(),
    defaultDepotId: z.number().optional(),
    aTrailerId: z.number().optional(),
    bTrailerId: z.number().optional(),
    cTrailerId: z.number().optional(),
    sideloader: z.boolean().optional(),
  })

  type VehicleFormData = z.infer<typeof vehicleSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      fleetNumber: '',
      rego: '',
      regoExpiryDate: '',
      gpsId: '',
      description: '',
      defaultDepotId: undefined,
      aTrailerId: undefined,
      bTrailerId: undefined,
      cTrailerId: undefined,
      sideloader: false,
    },
  })

  const watchedSideloader = watch('sideloader')

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
      loadTrailerTypes()
      loadWarehouses()
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

  const loadTrailerTypes = async () => {
    try {
      const res = await fetch('/api/trailer-types?limit=1000')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.trailerTypes) {
          setTrailerTypes(data.trailerTypes)
        }
      }
    } catch (error) {
      console.error('Error loading trailer types:', error)
    }
  }

  const loadWarehouses = async () => {
    try {
      const res = await fetch('/api/warehouses?limit=1000')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.warehouses) {
          setWarehouses(data.warehouses)
        }
      }
    } catch (error) {
      console.error('Error loading warehouses:', error)
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

  const resetForm = () => {
    reset({
      fleetNumber: '',
      rego: '',
      regoExpiryDate: '',
      gpsId: '',
      description: '',
      defaultDepotId: undefined,
      aTrailerId: undefined,
      bTrailerId: undefined,
      cTrailerId: undefined,
      sideloader: false,
    })
    setError(null)
    setSuccess(null)
  }

  const handleAddVehicle = () => {
    resetForm()
    setShowAddForm(true)
    setEditingVehicle(null)
  }

  const handleEditVehicle = (vehicle: VehicleItem) => {
    const depotId =
      typeof vehicle.defaultDepotId === 'object' ? vehicle.defaultDepotId.id : vehicle.defaultDepotId
    const aTrailerId =
      typeof vehicle.aTrailerId === 'object' ? vehicle.aTrailerId.id : vehicle.aTrailerId
    const bTrailerId =
      typeof vehicle.bTrailerId === 'object' ? vehicle.bTrailerId.id : vehicle.bTrailerId
    const cTrailerId =
      typeof vehicle.cTrailerId === 'object' ? vehicle.cTrailerId.id : vehicle.cTrailerId

    reset({
      fleetNumber: vehicle.fleetNumber || '',
      rego: vehicle.rego || '',
      regoExpiryDate: vehicle.regoExpiryDate || '',
      gpsId: vehicle.gpsId || '',
      description: vehicle.description || '',
      defaultDepotId: depotId || undefined,
      aTrailerId: aTrailerId || undefined,
      bTrailerId: bTrailerId || undefined,
      cTrailerId: cTrailerId || undefined,
      sideloader: vehicle.sideloader || false,
    })
    setEditingVehicle(vehicle)
    setShowAddForm(true)
    setError(null)
    setSuccess(null)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingVehicle(null)
    resetForm()
  }

  const onSubmit = async (data: VehicleFormData) => {
    setError(null)
    setSuccess(null)

    try {
      if (editingVehicle) {
        const res = await fetch(`/api/vehicles/${editingVehicle.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (res.ok) {
          setSuccess('Vehicle updated successfully')
          await loadVehicles()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const responseData = await res.json()
          setError(responseData.message || 'Failed to update vehicle')
        }
      } else {
        const res = await fetch('/api/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (res.ok) {
          setSuccess('Vehicle created successfully')
          await loadVehicles()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const responseData = await res.json()
          setError(responseData.message || 'Failed to create vehicle')
        }
      }
    } catch (error) {
      console.error('Error saving vehicle:', error)
      setError('An error occurred while saving the vehicle')
    }
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
        setSuccess('Vehicle deleted successfully')
        await loadVehicles()
        setTimeout(() => setSuccess(null), 2000)
      } else {
        const data = await res.json()
        setError(data.message || 'Failed to delete vehicle')
      }
    } catch (error) {
      console.error('Error deleting vehicle:', error)
      setError('An error occurred while deleting the vehicle')
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

  const getTrailerTypeName = (trailerTypeId?: number | { id: number; name?: string }) => {
    if (!trailerTypeId) return 'N/A'
    const id = typeof trailerTypeId === 'object' ? trailerTypeId.id : trailerTypeId
    const type = trailerTypes.find((t) => t.id === id)
    return type?.name || 'N/A'
  }

  const getWarehouseName = (warehouseId?: number | { id: number; name?: string }) => {
    if (!warehouseId) return 'N/A'
    const id = typeof warehouseId === 'object' ? warehouseId.id : warehouseId
    const warehouse = warehouses.find((w) => w.id === id)
    return warehouse?.name || 'N/A'
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

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          {success}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{error}</div>
      )}

      <Dialog open={showAddForm} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}</DialogTitle>
            <DialogDescription>
              {editingVehicle ? 'Update vehicle information' : 'Create a new vehicle'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Fleet Number"
                required
                error={errors.fleetNumber?.message}
                placeholder="Fleet identification number"
                {...register('fleetNumber')}
              />
              <FormInput
                label="Registration"
                required
                error={errors.rego?.message}
                placeholder="Registration number"
                {...register('rego')}
              />
              <FormInput
                label="Registration Expiry"
                type="date"
                error={errors.regoExpiryDate?.message}
                {...register('regoExpiryDate')}
              />
              <FormInput
                label="GPS ID"
                error={errors.gpsId?.message}
                placeholder="GPS device ID"
                {...register('gpsId')}
              />
              <FormSelect
                label="Default Depot"
                placeholder="Select depot"
                options={[
                  { value: '', label: 'None' },
                  ...warehouses.map((warehouse) => ({
                    value: warehouse.id.toString(),
                    label: warehouse.name,
                  })),
                ]}
                error={errors.defaultDepotId?.message}
                {...register('defaultDepotId', { valueAsNumber: true })}
              />
              <FormInput
                label="Description"
                error={errors.description?.message}
                placeholder="Vehicle description"
                {...register('description')}
              />
              <FormSelect
                label="A Trailer Type"
                placeholder="Select trailer type"
                options={[
                  { value: '', label: 'None' },
                  ...trailerTypes.map((type) => ({
                    value: type.id.toString(),
                    label: type.name,
                  })),
                ]}
                error={errors.aTrailerId?.message}
                {...register('aTrailerId', { valueAsNumber: true })}
              />
              <FormSelect
                label="B Trailer Type"
                placeholder="Select trailer type"
                options={[
                  { value: '', label: 'None' },
                  ...trailerTypes.map((type) => ({
                    value: type.id.toString(),
                    label: type.name,
                  })),
                ]}
                error={errors.bTrailerId?.message}
                {...register('bTrailerId', { valueAsNumber: true })}
              />
              <FormSelect
                label="C Trailer Type"
                placeholder="Select trailer type"
                options={[
                  { value: '', label: 'None' },
                  ...trailerTypes.map((type) => ({
                    value: type.id.toString(),
                    label: type.name,
                  })),
                ]}
                error={errors.cTrailerId?.message}
                {...register('cTrailerId', { valueAsNumber: true })}
              />
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sideloader"
                  checked={watchedSideloader}
                  onCheckedChange={(checked) => setValue('sideloader', checked === true)}
                />
                <Label htmlFor="sideloader" className="cursor-pointer">
                  Equipped with sideloader
                </Label>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="w-full sm:w-auto"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:w-auto">
                <Save className="h-4 w-4 mr-2" />
                {editingVehicle ? 'Update Vehicle' : 'Create Vehicle'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                            <span>{getWarehouseName(vehicle.defaultDepotId)}</span>
                          </div>
                        )}
                        {(vehicle.aTrailerId || vehicle.bTrailerId || vehicle.cTrailerId) && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[100px]">Trailers:</span>
                            <span>
                              {[
                                vehicle.aTrailerId && `A: ${getTrailerTypeName(vehicle.aTrailerId)}`,
                                vehicle.bTrailerId && `B: ${getTrailerTypeName(vehicle.bTrailerId)}`,
                                vehicle.cTrailerId && `C: ${getTrailerTypeName(vehicle.cTrailerId)}`,
                              ]
                                .filter(Boolean)
                                .join(', ')}
                            </span>
                          </div>
                        )}
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

