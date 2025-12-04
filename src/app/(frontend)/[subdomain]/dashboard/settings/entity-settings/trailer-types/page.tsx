'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FormInput } from '@/components/ui/form-field'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Label } from '@/components/ui/label'

type TrailerTypeItem = {
  id: number
  name: string
  maxWeightKg?: number
  maxCubicM3?: number
  maxPallet?: number
  trailerA?: boolean
  trailerB?: boolean
  trailerC?: boolean
}

type TenantUser = {
  id?: number | string
  role?: number | string | { id: number; permissions?: Record<string, boolean> }
  [key: string]: unknown
}

export default function TrailerTypesPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)
  const [_currentUser, setCurrentUser] = useState<TenantUser | null>(null)
  const [trailerTypes, setTrailerTypes] = useState<TrailerTypeItem[]>([])
  const [loadingTrailerTypes, setLoadingTrailerTypes] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTrailerType, setEditingTrailerType] = useState<TrailerTypeItem | null>(null)
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

  const trailerTypeSchema = z.object({
    name: z.string().min(1, 'Trailer type name is required'),
    maxWeightKg: z.number().optional(),
    maxCubicM3: z.number().optional(),
    maxPallet: z.number().optional(),
    trailerA: z.boolean().optional(),
    trailerB: z.boolean().optional(),
    trailerC: z.boolean().optional(),
  })

  type TrailerTypeFormData = z.infer<typeof trailerTypeSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<TrailerTypeFormData>({
    resolver: zodResolver(trailerTypeSchema),
    defaultValues: {
      name: '',
      maxWeightKg: undefined,
      maxCubicM3: undefined,
      maxPallet: undefined,
      trailerA: false,
      trailerB: false,
      trailerC: false,
    },
  })

  const watchedTrailerA = watch('trailerA')
  const watchedTrailerB = watch('trailerB')
  const watchedTrailerC = watch('trailerC')

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
      loadTrailerTypes()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, page, limit, searchQuery])

  const loadTrailerTypes = async () => {
    try {
      setLoadingTrailerTypes(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(searchQuery && { search: searchQuery }),
      })
      const res = await fetch(`/api/trailer-types?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.trailerTypes) {
          setTrailerTypes(data.trailerTypes)
          setTotalDocs(data.totalDocs || 0)
          setTotalPages(data.totalPages || 0)
          setHasPrevPage(data.hasPrevPage || false)
          setHasNextPage(data.hasNextPage || false)
        }
      }
    } catch (error) {
      console.error('Error loading trailer types:', error)
    } finally {
      setLoadingTrailerTypes(false)
    }
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setPage(1) // Reset to first page when searching
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetForm = () => {
    reset({
      name: '',
      maxWeightKg: undefined,
      maxCubicM3: undefined,
      maxPallet: undefined,
      trailerA: false,
      trailerB: false,
      trailerC: false,
    })
    setError(null)
    setSuccess(null)
  }

  const handleAddTrailerType = () => {
    resetForm()
    setShowAddForm(true)
    setEditingTrailerType(null)
  }

  const handleEditTrailerType = (trailerType: TrailerTypeItem) => {
    reset({
      name: trailerType.name || '',
      maxWeightKg: trailerType.maxWeightKg || undefined,
      maxCubicM3: trailerType.maxCubicM3 || undefined,
      maxPallet: trailerType.maxPallet || undefined,
      trailerA: trailerType.trailerA || false,
      trailerB: trailerType.trailerB || false,
      trailerC: trailerType.trailerC || false,
    })
    setEditingTrailerType(trailerType)
    setShowAddForm(true)
    setError(null)
    setSuccess(null)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingTrailerType(null)
    resetForm()
  }

  const onSubmit = async (data: TrailerTypeFormData) => {
    setError(null)
    setSuccess(null)

    try {
      if (editingTrailerType) {
        const res = await fetch(`/api/trailer-types/${editingTrailerType.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (res.ok) {
          setSuccess('Trailer type updated successfully')
          await loadTrailerTypes()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const responseData = await res.json()
          setError(responseData.message || 'Failed to update trailer type')
        }
      } else {
        const res = await fetch('/api/trailer-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (res.ok) {
          setSuccess('Trailer type created successfully')
          await loadTrailerTypes()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const responseData = await res.json()
          setError(responseData.message || 'Failed to create trailer type')
        }
      }
    } catch (error) {
      console.error('Error saving trailer type:', error)
      setError('An error occurred while saving the trailer type')
    }
  }

  const handleDeleteTrailerType = async (trailerType: TrailerTypeItem) => {
    if (
      !confirm(`Are you sure you want to delete ${trailerType.name}? This action cannot be undone.`)
    ) {
      return
    }

    try {
      const res = await fetch(`/api/trailer-types/${trailerType.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setSuccess('Trailer type deleted successfully')
        await loadTrailerTypes()
        setTimeout(() => setSuccess(null), 2000)
      } else {
        const data = await res.json()
        setError(data.message || 'Failed to delete trailer type')
      }
    } catch (error) {
      console.error('Error deleting trailer type:', error)
      setError('An error occurred while deleting the trailer type')
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
          <h1 className="text-3xl font-bold">Trailer Types</h1>
          <p className="text-muted-foreground">Manage trailer type configurations</p>
        </div>
        <Button
          onClick={handleAddTrailerType}
          className="min-h-[44px]"
          size="icon"
          title="Add Trailer Type"
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
            <DialogTitle>
              {editingTrailerType ? 'Edit Trailer Type' : 'Add New Trailer Type'}
            </DialogTitle>
            <DialogDescription>
              {editingTrailerType
                ? 'Update trailer type information'
                : 'Create a new trailer type configuration'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Trailer Type Name"
                required
                error={errors.name?.message}
                placeholder="Trailer type name"
                {...register('name')}
              />
              <FormInput
                label="Max Weight (kg)"
                type="number"
                error={errors.maxWeightKg?.message}
                placeholder="Maximum weight capacity"
                {...register('maxWeightKg', { valueAsNumber: true })}
              />
              <FormInput
                label="Max Cubic Volume (m³)"
                type="number"
                error={errors.maxCubicM3?.message}
                placeholder="Maximum cubic volume"
                {...register('maxCubicM3', { valueAsNumber: true })}
              />
              <FormInput
                label="Max Pallet Capacity"
                type="number"
                error={errors.maxPallet?.message}
                placeholder="Maximum pallet capacity"
                {...register('maxPallet', { valueAsNumber: true })}
              />
            </div>

            <div className="border-t pt-4 space-y-3">
              <Label>Trailer Support</Label>
              <div className="flex flex-col gap-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="trailerA"
                    checked={watchedTrailerA}
                    onCheckedChange={(checked) => setValue('trailerA', checked === true)}
                  />
                  <Label htmlFor="trailerA" className="cursor-pointer">
                    Supports Trailer A
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="trailerB"
                    checked={watchedTrailerB}
                    onCheckedChange={(checked) => setValue('trailerB', checked === true)}
                  />
                  <Label htmlFor="trailerB" className="cursor-pointer">
                    Supports Trailer B
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="trailerC"
                    checked={watchedTrailerC}
                    onCheckedChange={(checked) => setValue('trailerC', checked === true)}
                  />
                  <Label htmlFor="trailerC" className="cursor-pointer">
                    Supports Trailer C
                  </Label>
                </div>
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
                {editingTrailerType ? 'Update Trailer Type' : 'Create Trailer Type'}
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
                Trailer Types ({totalDocs})
              </CardTitle>
              <CardDescription>Manage trailer type configurations</CardDescription>
            </div>
            <div className="relative max-w-sm w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search trailer types..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTrailerTypes ? (
            <div className="text-center py-8 text-muted-foreground">Loading trailer types...</div>
          ) : trailerTypes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery
                ? 'No trailer types found matching your search'
                : 'No trailer types found'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {trailerTypes.map((trailerType) => (
                  <Card key={trailerType.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg font-semibold line-clamp-1 pr-2">
                          {trailerType.name}
                        </CardTitle>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditTrailerType(trailerType)}
                            className="h-8 w-8"
                            title="Edit Trailer Type"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteTrailerType(trailerType)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete Trailer Type"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {trailerType.maxWeightKg && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[100px]">Max Weight:</span>
                            <span>{trailerType.maxWeightKg} kg</span>
                          </div>
                        )}
                        {trailerType.maxCubicM3 && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[100px]">Max Volume:</span>
                            <span>{trailerType.maxCubicM3} m³</span>
                          </div>
                        )}
                        {trailerType.maxPallet && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[100px]">Max Pallets:</span>
                            <span>{trailerType.maxPallet}</span>
                          </div>
                        )}
                        <div className="flex items-start gap-2">
                          <span className="font-medium min-w-[100px]">Supports:</span>
                          <span>
                            {[
                              trailerType.trailerA && 'A',
                              trailerType.trailerB && 'B',
                              trailerType.trailerC && 'C',
                            ]
                              .filter(Boolean)
                              .join(', ') || 'None'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {trailerTypes.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
                    {Math.min(page * limit, totalDocs)} of {totalDocs} trailer types
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={!hasPrevPage || loadingTrailerTypes}
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
                            disabled={loadingTrailerTypes}
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
                      disabled={!hasNextPage || loadingTrailerTypes}
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

