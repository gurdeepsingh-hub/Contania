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
import { valueAsNumberOrUndefined } from '@/lib/utils'
import { toast } from 'sonner'

type TrailerItem = {
  id: number
  fleetNumber: string
  rego: string
  regoExpiryDate?: string
  trailerTypeId?: number | { id: number; name?: string }
  maxWeightKg?: number
  maxCubeM3?: number
  maxPallet?: number
  defaultWarehouseId?: number | { id: number; name?: string }
  dangerousCertNumber?: string
  dangerousCertExpiry?: string
  description?: string
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

export default function TrailersPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)
  const [_currentUser, setCurrentUser] = useState<TenantUser | null>(null)
  const [trailers, setTrailers] = useState<TrailerItem[]>([])
  const [trailerTypes, setTrailerTypes] = useState<TrailerType[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loadingTrailers, setLoadingTrailers] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTrailer, setEditingTrailer] = useState<TrailerItem | null>(null)

  // Pagination state
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [totalDocs, setTotalDocs] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [hasPrevPage, setHasPrevPage] = useState(false)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const trailerSchema = z.object({
    fleetNumber: z.string().min(1, 'Fleet number is required'),
    rego: z.string().min(1, 'Registration is required'),
    regoExpiryDate: z.string().optional(),
    trailerTypeId: z.number().optional(),
    maxWeightKg: z.any().optional(),
    maxCubeM3: z.any().optional(),
    maxPallet: z.number().optional(),
    defaultWarehouseId: z.number().optional(),
    dangerousCertNumber: z.string().optional(),
    dangerousCertExpiry: z.string().optional(),
    description: z.string().optional(),
  })

  type TrailerFormData = z.infer<typeof trailerSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TrailerFormData>({
    resolver: zodResolver(trailerSchema) as any,
    defaultValues: {
      fleetNumber: '',
      rego: '',
      regoExpiryDate: '',
      trailerTypeId: undefined,
      maxWeightKg: undefined,
      maxCubeM3: undefined,
      maxPallet: undefined,
      defaultWarehouseId: undefined,
      dangerousCertNumber: '',
      dangerousCertExpiry: '',
      description: '',
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
      loadTrailers()
      loadTrailerTypes()
      loadWarehouses()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, page, limit, searchQuery])

  const loadTrailers = async () => {
    try {
      setLoadingTrailers(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        depth: '1',
        ...(searchQuery && { search: searchQuery }),
      })
      const res = await fetch(`/api/trailers?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.trailers) {
          setTrailers(data.trailers)
          setTotalDocs(data.totalDocs || 0)
          setTotalPages(data.totalPages || 0)
          setHasPrevPage(data.hasPrevPage || false)
          setHasNextPage(data.hasNextPage || false)
        }
      }
    } catch (error) {
      console.error('Error loading trailers:', error)
    } finally {
      setLoadingTrailers(false)
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

  // Auto-select warehouse if only one option and not editing
  useEffect(() => {
    if (warehouses.length === 1 && !editingTrailer && !showAddForm) {
      const currentValues = {
        fleetNumber: '',
        rego: '',
        regoExpiryDate: '',
        trailerTypeId: undefined,
        maxWeightKg: undefined,
        maxCubeM3: undefined,
        maxPallet: undefined,
        defaultWarehouseId: undefined,
        dangerousCertNumber: '',
        dangerousCertExpiry: '',
        description: '',
      }
      // Only reset if defaultWarehouseId is not already set
      reset({
        ...currentValues,
        defaultWarehouseId: warehouses[0].id,
      })
    }
  }, [warehouses, editingTrailer, showAddForm, reset])

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
      trailerTypeId: undefined,
      maxWeightKg: undefined,
      maxCubeM3: undefined,
      maxPallet: undefined,
      defaultWarehouseId: undefined,
      dangerousCertNumber: '',
      dangerousCertExpiry: '',
      description: '',
    })
  }

  const handleAddTrailer = () => {
    resetForm()
    setShowAddForm(true)
    setEditingTrailer(null)
  }

  const handleEditTrailer = (trailer: TrailerItem) => {
    const trailerTypeId =
      typeof trailer.trailerTypeId === 'object' ? trailer.trailerTypeId.id : trailer.trailerTypeId
    const warehouseId =
      typeof trailer.defaultWarehouseId === 'object'
        ? trailer.defaultWarehouseId.id
        : trailer.defaultWarehouseId

    reset({
      fleetNumber: trailer.fleetNumber || '',
      rego: trailer.rego || '',
      regoExpiryDate: trailer.regoExpiryDate || '',
      trailerTypeId: trailerTypeId || undefined,
      maxWeightKg: trailer.maxWeightKg || undefined,
      maxCubeM3: trailer.maxCubeM3 || undefined,
      maxPallet: trailer.maxPallet || undefined,
      defaultWarehouseId: warehouseId || undefined,
      dangerousCertNumber: trailer.dangerousCertNumber || '',
      dangerousCertExpiry: trailer.dangerousCertExpiry || '',
      description: trailer.description || '',
    })
    setEditingTrailer(trailer)
    setShowAddForm(true)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingTrailer(null)
    resetForm()
  }

  const onSubmit = async (data: TrailerFormData) => {
    try {
      if (editingTrailer) {
        const res = await fetch(`/api/trailers/${editingTrailer.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (res.ok) {
          toast.success('Trailer updated successfully')
          await loadTrailers()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const responseData = await res.json()
          toast.error(responseData.message || 'Failed to update trailer')
        }
      } else {
        const res = await fetch('/api/trailers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (res.ok) {
          toast.success('Trailer created successfully')
          await loadTrailers()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const responseData = await res.json()
          toast.error(responseData.message || 'Failed to create trailer')
        }
      }
    } catch (error) {
      console.error('Error saving trailer:', error)
      toast.error('An error occurred while saving the trailer')
    }
  }

  const handleDeleteTrailer = async (trailer: TrailerItem) => {
    if (
      !confirm(
        `Are you sure you want to delete ${trailer.fleetNumber}? This action cannot be undone.`,
      )
    ) {
      return
    }

    try {
      const res = await fetch(`/api/trailers/${trailer.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Trailer deleted successfully')
        await loadTrailers()
      } else {
        const data = await res.json()
        toast.error(data.message || 'Failed to delete trailer')
      }
    } catch (error) {
      console.error('Error deleting trailer:', error)
      toast.error('An error occurred while deleting the trailer')
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
          <h1 className="text-3xl font-bold">Trailers</h1>
          <p className="text-muted-foreground">Manage trailer information</p>
        </div>
        <Button onClick={handleAddTrailer} className="min-h-[44px]" size="icon" title="Add Trailer">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={showAddForm} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTrailer ? 'Edit Trailer' : 'Add New Trailer'}</DialogTitle>
            <DialogDescription>
              {editingTrailer ? 'Update trailer information' : 'Create a new trailer'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Fleet Number"
                required
                error={errors.fleetNumber?.message}
                placeholder="Trailer fleet ID"
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
              <FormSelect
                label="Trailer Type"
                placeholder="Select trailer type"
                options={[
                  { value: '', label: 'None' },
                  ...trailerTypes.map((type) => ({
                    value: type.id.toString(),
                    label: type.name,
                  })),
                ]}
                error={errors.trailerTypeId?.message}
                {...register('trailerTypeId', { setValueAs: valueAsNumberOrUndefined })}
              />
              <FormInput
                label="Max Weight (kg) (optional)"
                type="number"
                step="0.01"
                error={errors.maxWeightKg?.message as string | undefined}
                placeholder="Maximum weight"
                {...register('maxWeightKg', {
                  setValueAs: (v) => {
                    // Handle empty string, null, undefined, or NaN
                    if (v === '' || v === null || v === undefined) {
                      return undefined
                    }
                    // Convert to number
                    const num = typeof v === 'string' ? parseFloat(v) : Number(v)
                    // Return undefined if NaN or invalid, otherwise return the number
                    return Number.isNaN(num) || !Number.isFinite(num) ? undefined : num
                  },
                })}
              />
              <FormInput
                label="Max Cubic Volume (m³) (optional)"
                type="number"
                step="0.01"
                error={errors.maxCubeM3?.message as string | undefined}
                placeholder="Maximum volume"
                {...register('maxCubeM3', {
                  setValueAs: (v) => {
                    // Handle empty string, null, undefined, or NaN
                    if (v === '' || v === null || v === undefined) {
                      return undefined
                    }
                    // Convert to number
                    const num = typeof v === 'string' ? parseFloat(v) : Number(v)
                    // Return undefined if NaN or invalid, otherwise return the number
                    return Number.isNaN(num) || !Number.isFinite(num) ? undefined : num
                  },
                })}
              />
              <FormInput
                label="Max Pallet Capacity"
                type="number"
                error={errors.maxPallet?.message}
                placeholder="Maximum pallets"
                {...register('maxPallet', { valueAsNumber: true })}
              />
              <FormSelect
                label="Default Warehouse"
                placeholder="Select warehouse"
                options={[
                  { value: '', label: 'None' },
                  ...warehouses.map((warehouse) => ({
                    value: warehouse.id.toString(),
                    label: warehouse.name,
                  })),
                ]}
                error={errors.defaultWarehouseId?.message}
                {...register('defaultWarehouseId', { setValueAs: valueAsNumberOrUndefined })}
              />
              <FormInput
                label="Dangerous Goods Cert Number"
                error={errors.dangerousCertNumber?.message}
                placeholder="Certificate number"
                {...register('dangerousCertNumber')}
              />
              <FormInput
                label="Dangerous Goods Cert Expiry"
                type="date"
                error={errors.dangerousCertExpiry?.message}
                {...register('dangerousCertExpiry')}
              />
              <FormInput
                label="Description"
                error={errors.description?.message}
                placeholder="Notes or description"
                {...register('description')}
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
                {editingTrailer ? 'Update Trailer' : 'Create Trailer'}
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
                Trailers ({totalDocs})
              </CardTitle>
              <CardDescription>Manage trailer information</CardDescription>
            </div>
            <div className="relative max-w-sm w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search trailers..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTrailers ? (
            <div className="text-center py-8 text-muted-foreground">Loading trailers...</div>
          ) : trailers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No trailers found matching your search' : 'No trailers found'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {trailers.map((trailer) => (
                  <Card key={trailer.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg font-semibold line-clamp-1 pr-2">
                          {trailer.fleetNumber}
                        </CardTitle>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditTrailer(trailer)}
                            className="h-8 w-8"
                            title="Edit Trailer"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteTrailer(trailer)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete Trailer"
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
                          <span>{trailer.rego}</span>
                        </div>
                        {trailer.trailerTypeId && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[100px]">Type:</span>
                            <span>{getTrailerTypeName(trailer.trailerTypeId)}</span>
                          </div>
                        )}
                        {trailer.defaultWarehouseId && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[100px]">Warehouse:</span>
                            <span>{getWarehouseName(trailer.defaultWarehouseId)}</span>
                          </div>
                        )}
                        {trailer.regoExpiryDate && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[100px]">Rego Expiry:</span>
                            <span>{new Date(trailer.regoExpiryDate).toLocaleDateString()}</span>
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
                    Showing {trailers.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
                    {Math.min(page * limit, totalDocs)} of {totalDocs} trailers
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={!hasPrevPage || loadingTrailers}
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
                            disabled={loadingTrailers}
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
                      disabled={!hasNextPage || loadingTrailers}
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
