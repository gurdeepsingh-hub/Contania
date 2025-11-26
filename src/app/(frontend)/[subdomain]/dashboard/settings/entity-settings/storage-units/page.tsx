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
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Warehouse,
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

type StorageUnit = {
  id: number
  abbreviation?: string
  name: string
  palletSpaces?: number
  lengthPerSU_mm?: number
  widthPerSU_mm?: number
  whstoChargeBy?: string
}

type TenantUser = {
  id?: number | string
  role?: number | string | { id: number; permissions?: Record<string, boolean> }
  [key: string]: unknown
}

export default function StorageUnitsPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)
  const [currentUser, setCurrentUser] = useState<TenantUser | null>(null)
  const [storageUnits, setStorageUnits] = useState<StorageUnit[]>([])
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingUnit, setEditingUnit] = useState<StorageUnit | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Pagination state
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [totalDocs, setTotalDocs] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [hasPrevPage, setHasPrevPage] = useState(false)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const storageUnitSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    abbreviation: z.string().optional(),
    palletSpaces: z.string().optional(),
    lengthPerSU_mm: z.string().optional(),
    widthPerSU_mm: z.string().optional(),
    whstoChargeBy: z.string().optional(),
  })

  type StorageUnitFormData = z.infer<typeof storageUnitSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<StorageUnitFormData>({
    resolver: zodResolver(storageUnitSchema),
    defaultValues: {
      name: '',
      abbreviation: '',
      palletSpaces: '',
      lengthPerSU_mm: '',
      widthPerSU_mm: '',
      whstoChargeBy: '',
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
      } catch (error) {
        router.push('/dashboard')
      }
    }

    if (!loading && tenant) {
      checkAuth()
    }
  }, [loading, tenant, router])

  useEffect(() => {
    if (authChecked) {
      loadStorageUnits()
    }
  }, [authChecked, page, limit, searchQuery])

  const loadStorageUnits = async () => {
    try {
      setLoadingUnits(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(searchQuery && { search: searchQuery }),
      })
      const res = await fetch(`/api/storage-units?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.storageUnits) {
          setStorageUnits(data.storageUnits)
          setTotalDocs(data.totalDocs || 0)
          setTotalPages(data.totalPages || 0)
          setHasPrevPage(data.hasPrevPage || false)
          setHasNextPage(data.hasNextPage || false)
        }
      }
    } catch (error) {
      console.error('Error loading storage units:', error)
    } finally {
      setLoadingUnits(false)
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
      abbreviation: '',
      palletSpaces: '',
      lengthPerSU_mm: '',
      widthPerSU_mm: '',
      whstoChargeBy: '',
    })
    setError(null)
    setSuccess(null)
  }

  const handleAddUnit = () => {
    resetForm()
    setShowAddForm(true)
    setEditingUnit(null)
  }

  const handleEditUnit = (unit: StorageUnit) => {
    reset({
      name: unit.name || '',
      abbreviation: unit.abbreviation || '',
      palletSpaces: unit.palletSpaces?.toString() || '',
      lengthPerSU_mm: unit.lengthPerSU_mm?.toString() || '',
      widthPerSU_mm: unit.widthPerSU_mm?.toString() || '',
      whstoChargeBy: unit.whstoChargeBy || '',
    })
    setEditingUnit(unit)
    setShowAddForm(true)
    setError(null)
    setSuccess(null)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingUnit(null)
    resetForm()
  }

  const onSubmit = async (data: StorageUnitFormData) => {
    setError(null)
    setSuccess(null)

    try {
      const submitData: Record<string, unknown> = {
        name: data.name,
        abbreviation: data.abbreviation || undefined,
        palletSpaces: data.palletSpaces ? Number(data.palletSpaces) : undefined,
        lengthPerSU_mm: data.lengthPerSU_mm ? Number(data.lengthPerSU_mm) : undefined,
        widthPerSU_mm: data.widthPerSU_mm ? Number(data.widthPerSU_mm) : undefined,
        whstoChargeBy: data.whstoChargeBy || undefined,
      }

      if (editingUnit) {
        const res = await fetch(`/api/storage-units/${editingUnit.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitData),
        })

        if (res.ok) {
          setSuccess('Storage unit updated successfully')
          await loadStorageUnits()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const responseData = await res.json()
          setError(responseData.message || 'Failed to update storage unit')
        }
      } else {
        const res = await fetch('/api/storage-units', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitData),
        })

        if (res.ok) {
          setSuccess('Storage unit created successfully')
          await loadStorageUnits()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const responseData = await res.json()
          setError(responseData.message || 'Failed to create storage unit')
        }
      }
    } catch (error) {
      console.error('Error saving storage unit:', error)
      setError('An error occurred while saving the storage unit')
    }
  }

  const handleDeleteUnit = async (unit: StorageUnit) => {
    if (!confirm(`Are you sure you want to delete ${unit.name}? This action cannot be undone.`)) {
      return
    }

    try {
      const res = await fetch(`/api/storage-units/${unit.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setSuccess('Storage unit deleted successfully')
        await loadStorageUnits()
        setTimeout(() => setSuccess(null), 2000)
      } else {
        const data = await res.json()
        setError(data.message || 'Failed to delete storage unit')
      }
    } catch (error) {
      console.error('Error deleting storage unit:', error)
      setError('An error occurred while deleting the storage unit')
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
          <h1 className="text-3xl font-bold">Storage Units</h1>
          <p className="text-muted-foreground">Configure storage unit types</p>
        </div>
        <Button
          onClick={handleAddUnit}
          className="min-h-[44px]"
          size="icon"
          title="Add Storage Unit"
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
            <DialogTitle>{editingUnit ? 'Edit Storage Unit' : 'Add New Storage Unit'}</DialogTitle>
            <DialogDescription>
              {editingUnit ? 'Update storage unit information' : 'Create a new storage unit'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Name"
                required
                error={errors.name?.message}
                placeholder="e.g. Pallet, Rack"
                {...register('name')}
              />
              <FormInput
                label="Abbreviation"
                error={errors.abbreviation?.message}
                placeholder="e.g. PAL"
                {...register('abbreviation')}
              />
              <FormInput
                label="Pallet Spaces"
                type="number"
                step="0.01"
                min="0"
                error={errors.palletSpaces?.message}
                placeholder="Number of pallet spaces"
                {...register('palletSpaces')}
              />
              <FormSelect
                label="Charge By"
                placeholder="Select option"
                options={[
                  { value: 'LPN', label: 'LPN' },
                  { value: 'weight', label: 'Weight' },
                  { value: 'cubic', label: 'Cubic' },
                  { value: 'sqm', label: 'SQM' },
                ]}
                error={errors.whstoChargeBy?.message}
                {...register('whstoChargeBy')}
              />
              <FormInput
                label="Length (mm)"
                type="number"
                step="0.01"
                min="0"
                error={errors.lengthPerSU_mm?.message}
                placeholder="Length in millimeters"
                {...register('lengthPerSU_mm')}
              />
              <FormInput
                label="Width (mm)"
                type="number"
                step="0.01"
                min="0"
                error={errors.widthPerSU_mm?.message}
                placeholder="Width in millimeters"
                {...register('widthPerSU_mm')}
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
                {editingUnit ? 'Update Unit' : 'Create Unit'}
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
                <Warehouse className="h-5 w-5" />
                Storage Units ({totalDocs})
              </CardTitle>
              <CardDescription>Manage storage unit types</CardDescription>
            </div>
            <div className="relative max-w-sm w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search storage units..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingUnits ? (
            <div className="text-center py-8 text-muted-foreground">Loading storage units...</div>
          ) : storageUnits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery
                ? 'No storage units found matching your search'
                : 'No storage units found'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {storageUnits.map((unit) => (
                  <Card key={unit.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg font-semibold line-clamp-1 pr-2">
                          {unit.name}
                        </CardTitle>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditUnit(unit)}
                            className="h-8 w-8"
                            title="Edit Storage Unit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteUnit(unit)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete Storage Unit"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {unit.abbreviation && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[80px]">Abbreviation:</span>
                            <span>{unit.abbreviation}</span>
                          </div>
                        )}
                        {unit.palletSpaces !== undefined && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[80px]">Pallet Spaces:</span>
                            <span>{unit.palletSpaces}</span>
                          </div>
                        )}
                        {unit.whstoChargeBy && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[80px]">Charge By:</span>
                            <span>{unit.whstoChargeBy}</span>
                          </div>
                        )}
                        {(unit.lengthPerSU_mm || unit.widthPerSU_mm) && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[80px]">Dimensions:</span>
                            <span>
                              {unit.lengthPerSU_mm || 'N/A'}mm × {unit.widthPerSU_mm || 'N/A'}mm
                            </span>
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
                    Showing {storageUnits.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
                    {Math.min(page * limit, totalDocs)} of {totalDocs} storage units
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={!hasPrevPage || loadingUnits}
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
                            disabled={loadingUnits}
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
                      disabled={!hasNextPage || loadingUnits}
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
