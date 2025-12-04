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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  User,
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
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
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

  const driverSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    phoneNumber: z.string().min(1, 'Phone number is required'),
    vehicleId: z.number().optional(),
    defaultDepotId: z.number().optional(),
    abn: z.string().optional(),
    addressStreet: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postcode: z.string().optional(),
    employeeType: z.enum(['Casual', 'Permanent'], {
      required_error: 'Employee type is required',
    }),
    drivingLicenceNumber: z.string().min(1, 'Driving licence number is required'),
    licenceExpiry: z.string().optional(),
    licencePhotoUrl: z.number().optional(),
    dangerousGoodsCertNumber: z.string().optional(),
    dangerousGoodsCertExpiry: z.string().optional(),
    msicNumber: z.string().optional(),
    msicExpiry: z.string().optional(),
    msicPhotoUrl: z.number().optional(),
  })

  type DriverFormData = z.infer<typeof driverSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      name: '',
      phoneNumber: '',
      vehicleId: undefined,
      defaultDepotId: undefined,
      abn: '',
      addressStreet: '',
      city: '',
      state: '',
      postcode: '',
      employeeType: 'Casual',
      drivingLicenceNumber: '',
      licenceExpiry: '',
      licencePhotoUrl: undefined,
      dangerousGoodsCertNumber: '',
      dangerousGoodsCertExpiry: '',
      msicNumber: '',
      msicExpiry: '',
      msicPhotoUrl: undefined,
    },
  })

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
      loadVehicles()
      loadWarehouses()
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

  const loadVehicles = async () => {
    try {
      const res = await fetch('/api/vehicles?limit=1000')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.vehicles) {
          setVehicles(data.vehicles)
        }
      }
    } catch (error) {
      console.error('Error loading vehicles:', error)
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
      name: '',
      phoneNumber: '',
      vehicleId: undefined,
      defaultDepotId: undefined,
      abn: '',
      addressStreet: '',
      city: '',
      state: '',
      postcode: '',
      employeeType: 'Casual',
      drivingLicenceNumber: '',
      licenceExpiry: '',
      licencePhotoUrl: undefined,
      dangerousGoodsCertNumber: '',
      dangerousGoodsCertExpiry: '',
      msicNumber: '',
      msicExpiry: '',
      msicPhotoUrl: undefined,
    })
    setError(null)
    setSuccess(null)
  }

  const handleAddDriver = () => {
    resetForm()
    setShowAddForm(true)
    setEditingDriver(null)
  }

  const handleEditDriver = (driver: DriverItem) => {
    const vehicleId = typeof driver.vehicleId === 'object' ? driver.vehicleId.id : driver.vehicleId
    const depotId =
      typeof driver.defaultDepotId === 'object' ? driver.defaultDepotId.id : driver.defaultDepotId
    const licencePhotoId =
      typeof driver.licencePhotoUrl === 'object' ? driver.licencePhotoUrl.id : driver.licencePhotoUrl
    const msicPhotoId =
      typeof driver.msicPhotoUrl === 'object' ? driver.msicPhotoUrl.id : driver.msicPhotoUrl

    reset({
      name: driver.name || '',
      phoneNumber: driver.phoneNumber || '',
      vehicleId: vehicleId || undefined,
      defaultDepotId: depotId || undefined,
      abn: driver.abn || '',
      addressStreet: driver.addressStreet || '',
      city: driver.city || '',
      state: driver.state || '',
      postcode: driver.postcode || '',
      employeeType: (driver.employeeType as 'Casual' | 'Permanent') || 'Casual',
      drivingLicenceNumber: driver.drivingLicenceNumber || '',
      licenceExpiry: driver.licenceExpiry || '',
      licencePhotoUrl: licencePhotoId || undefined,
      dangerousGoodsCertNumber: driver.dangerousGoodsCertNumber || '',
      dangerousGoodsCertExpiry: driver.dangerousGoodsCertExpiry || '',
      msicNumber: driver.msicNumber || '',
      msicExpiry: driver.msicExpiry || '',
      msicPhotoUrl: msicPhotoId || undefined,
    })
    setEditingDriver(driver)
    setShowAddForm(true)
    setError(null)
    setSuccess(null)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingDriver(null)
    resetForm()
  }

  const onSubmit = async (data: DriverFormData) => {
    setError(null)
    setSuccess(null)

    try {
      if (editingDriver) {
        const res = await fetch(`/api/drivers/${editingDriver.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (res.ok) {
          setSuccess('Driver updated successfully')
          await loadDrivers()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const responseData = await res.json()
          setError(responseData.message || 'Failed to update driver')
        }
      } else {
        const res = await fetch('/api/drivers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (res.ok) {
          setSuccess('Driver created successfully')
          await loadDrivers()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const responseData = await res.json()
          setError(responseData.message || 'Failed to create driver')
        }
      }
    } catch (error) {
      console.error('Error saving driver:', error)
      setError('An error occurred while saving the driver')
    }
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

  const getVehicleName = (vehicleId?: number | { id: number; fleetNumber?: string }) => {
    if (!vehicleId) return 'N/A'
    const id = typeof vehicleId === 'object' ? vehicleId.id : vehicleId
    const vehicle = vehicles.find((v) => v.id === id)
    return vehicle?.fleetNumber || 'N/A'
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

      <Dialog open={showAddForm} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDriver ? 'Edit Driver' : 'Add New Driver'}</DialogTitle>
            <DialogDescription>
              {editingDriver ? 'Update driver information' : 'Create a new driver'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Name"
                required
                error={errors.name?.message}
                placeholder="Full name"
                {...register('name')}
              />
              <FormInput
                label="Phone Number"
                required
                error={errors.phoneNumber?.message}
                placeholder="Contact number"
                {...register('phoneNumber')}
              />
              <FormSelect
                label="Employee Type"
                required
                placeholder="Select type"
                options={[
                  { value: 'Casual', label: 'Casual' },
                  { value: 'Permanent', label: 'Permanent' },
                ]}
                error={errors.employeeType?.message}
                {...register('employeeType')}
              />
              <FormInput
                label="Driving Licence Number"
                required
                error={errors.drivingLicenceNumber?.message}
                placeholder="Licence number"
                {...register('drivingLicenceNumber')}
              />
              <FormInput
                label="Licence Expiry"
                type="date"
                error={errors.licenceExpiry?.message}
                {...register('licenceExpiry')}
              />
              <FormSelect
                label="Assigned Vehicle"
                placeholder="Select vehicle"
                options={[
                  { value: '', label: 'None' },
                  ...vehicles.map((vehicle) => ({
                    value: vehicle.id.toString(),
                    label: vehicle.fleetNumber,
                  })),
                ]}
                error={errors.vehicleId?.message}
                {...register('vehicleId', { valueAsNumber: true })}
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
                label="ABN"
                error={errors.abn?.message}
                placeholder="Australian Business Number"
                {...register('abn')}
              />
              <FormInput
                label="Street Address"
                error={errors.addressStreet?.message}
                placeholder="Street address"
                {...register('addressStreet')}
              />
              <FormInput
                label="City"
                error={errors.city?.message}
                placeholder="City"
                {...register('city')}
              />
              <FormInput
                label="State"
                error={errors.state?.message}
                placeholder="State/Province"
                {...register('state')}
              />
              <FormInput
                label="Postcode"
                error={errors.postcode?.message}
                placeholder="Postcode"
                {...register('postcode')}
              />
              <FormInput
                label="Dangerous Goods Cert Number"
                error={errors.dangerousGoodsCertNumber?.message}
                placeholder="Certificate number"
                {...register('dangerousGoodsCertNumber')}
              />
              <FormInput
                label="DG Cert Expiry"
                type="date"
                error={errors.dangerousGoodsCertExpiry?.message}
                {...register('dangerousGoodsCertExpiry')}
              />
              <FormInput
                label="MSIC Number"
                error={errors.msicNumber?.message}
                placeholder="MSIC number"
                {...register('msicNumber')}
              />
              <FormInput
                label="MSIC Expiry"
                type="date"
                error={errors.msicExpiry?.message}
                {...register('msicExpiry')}
              />
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
                {editingDriver ? 'Update Driver' : 'Create Driver'}
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
                            <span>{getVehicleName(driver.vehicleId)}</span>
                          </div>
                        )}
                        {driver.defaultDepotId && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[100px]">Depot:</span>
                            <span>{getWarehouseName(driver.defaultDepotId)}</span>
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

