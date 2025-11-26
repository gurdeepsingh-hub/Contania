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
import { Input } from '@/components/ui/input'

type WarehouseItem = {
  id: number
  name: string
  email?: string
  contact_name?: string
  contact_phone?: string
  street?: string
  city?: string
  state?: string
  postcode?: string
  store?: Array<{ store_name: string; id?: string }>
  type?: string
}

type TenantUser = {
  id?: number | string
  role?: number | string | { id: number; permissions?: Record<string, boolean> }
  [key: string]: unknown
}

export default function WarehousesPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)
  const [_currentUser, setCurrentUser] = useState<TenantUser | null>(null)
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([])
  const [loadingWarehouses, setLoadingWarehouses] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseItem | null>(null)
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

  const warehouseSchema = z.object({
    name: z.string().min(1, 'Warehouse name is required'),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    contact_name: z.string().optional(),
    contact_phone: z.string().optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postcode: z.string().optional(),
    type: z.string().optional(),
    store: z.array(z.object({ store_name: z.string() })),
  })

  type WarehouseFormData = z.infer<typeof warehouseSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<WarehouseFormData>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      name: '',
      email: '',
      contact_name: '',
      contact_phone: '',
      street: '',
      city: '',
      state: '',
      postcode: '',
      type: '',
      store: [],
    },
  })

  const [storeInput, setStoreInput] = useState('')
  const watchedStores = watch('store')

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
      loadWarehouses()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, page, limit, searchQuery])

  const loadWarehouses = async () => {
    try {
      setLoadingWarehouses(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(searchQuery && { search: searchQuery }),
      })
      const res = await fetch(`/api/warehouses?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.warehouses) {
          setWarehouses(data.warehouses)
          setTotalDocs(data.totalDocs || 0)
          setTotalPages(data.totalPages || 0)
          setHasPrevPage(data.hasPrevPage || false)
          setHasNextPage(data.hasNextPage || false)
        }
      }
    } catch (error) {
      console.error('Error loading warehouses:', error)
    } finally {
      setLoadingWarehouses(false)
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
      email: '',
      contact_name: '',
      contact_phone: '',
      street: '',
      city: '',
      state: '',
      postcode: '',
      type: '',
      store: [],
    })
    setStoreInput('')
    setError(null)
    setSuccess(null)
  }

  const handleAddWarehouse = () => {
    resetForm()
    setShowAddForm(true)
    setEditingWarehouse(null)
  }

  const handleEditWarehouse = (warehouse: WarehouseItem) => {
    reset({
      name: warehouse.name || '',
      email: warehouse.email || '',
      contact_name: warehouse.contact_name || '',
      contact_phone: warehouse.contact_phone || '',
      street: warehouse.street || '',
      city: warehouse.city || '',
      state: warehouse.state || '',
      postcode: warehouse.postcode || '',
      type: warehouse.type || '',
      store: warehouse.store?.map((s) => ({ store_name: s.store_name })) || [],
    })
    setEditingWarehouse(warehouse)
    setShowAddForm(true)
    setError(null)
    setSuccess(null)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingWarehouse(null)
    resetForm()
  }

  const addStore = () => {
    if (storeInput.trim()) {
      const currentStores = watchedStores || []
      setValue('store', [...currentStores, { store_name: storeInput.trim() }], {
        shouldValidate: true,
      })
      setStoreInput('')
    }
  }

  const removeStore = (index: number) => {
    const currentStores = watchedStores || []
    setValue(
      'store',
      currentStores.filter((_, i) => i !== index),
      { shouldValidate: true },
    )
  }

  const onSubmit = async (data: WarehouseFormData) => {
    setError(null)
    setSuccess(null)

    try {
      if (editingWarehouse) {
        const res = await fetch(`/api/warehouses/${editingWarehouse.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (res.ok) {
          setSuccess('Warehouse updated successfully')
          await loadWarehouses()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const responseData = await res.json()
          setError(responseData.message || 'Failed to update warehouse')
        }
      } else {
        const res = await fetch('/api/warehouses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (res.ok) {
          setSuccess('Warehouse created successfully')
          await loadWarehouses()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const responseData = await res.json()
          setError(responseData.message || 'Failed to create warehouse')
        }
      }
    } catch (error) {
      console.error('Error saving warehouse:', error)
      setError('An error occurred while saving the warehouse')
    }
  }

  const handleDeleteWarehouse = async (warehouse: WarehouseItem) => {
    if (
      !confirm(`Are you sure you want to delete ${warehouse.name}? This action cannot be undone.`)
    ) {
      return
    }

    try {
      const res = await fetch(`/api/warehouses/${warehouse.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setSuccess('Warehouse deleted successfully')
        await loadWarehouses()
        setTimeout(() => setSuccess(null), 2000)
      } else {
        const data = await res.json()
        setError(data.message || 'Failed to delete warehouse')
      }
    } catch (error) {
      console.error('Error deleting warehouse:', error)
      setError('An error occurred while deleting the warehouse')
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
          <h1 className="text-3xl font-bold">Warehouses</h1>
          <p className="text-muted-foreground">Manage warehouse and depot information</p>
        </div>
        <Button
          onClick={handleAddWarehouse}
          className="min-h-[44px]"
          size="icon"
          title="Add Warehouse"
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
            <DialogTitle>{editingWarehouse ? 'Edit Warehouse' : 'Add New Warehouse'}</DialogTitle>
            <DialogDescription>
              {editingWarehouse
                ? 'Update warehouse information'
                : 'Create a new warehouse or depot'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Warehouse Name"
                required
                error={errors.name?.message}
                placeholder="Warehouse or depot name"
                {...register('name')}
              />
              <FormSelect
                label="Type"
                placeholder="Select type"
                options={[
                  { value: 'Depot', label: 'Depot' },
                  { value: 'Warehouse', label: 'Warehouse' },
                ]}
                error={errors.type?.message}
                {...register('type')}
              />
              <FormInput
                label="Email"
                type="email"
                error={errors.email?.message}
                placeholder="warehouse@example.com"
                {...register('email')}
              />
              <FormInput
                label="Contact Name"
                error={errors.contact_name?.message}
                placeholder="Contact person"
                {...register('contact_name')}
              />
              <FormInput
                label="Contact Phone"
                type="tel"
                error={errors.contact_phone?.message}
                placeholder="+61 2 XXXX XXXX"
                {...register('contact_phone')}
              />
              <FormInput
                label="Street"
                error={errors.street?.message}
                placeholder="Street address"
                {...register('street')}
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
                placeholder="Postal code"
                {...register('postcode')}
              />
            </div>

            <div className="border-t pt-4">
              <Label htmlFor="store">Stores</Label>
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <FormInput
                  id="store"
                  value={storeInput}
                  onChange={(e) => setStoreInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addStore()
                    }
                  }}
                  placeholder="Store name"
                  containerClassName="flex-1"
                  label=""
                />
                <Button type="button" onClick={addStore} variant="outline" className="min-h-[44px]">
                  Add Store
                </Button>
              </div>
              {watchedStores && watchedStores.length > 0 && (
                <div className="mt-2 space-y-2">
                  {watchedStores.map((store, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted rounded"
                    >
                      <span>{store.store_name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeStore(index)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
                {editingWarehouse ? 'Update Warehouse' : 'Create Warehouse'}
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
                Warehouses ({totalDocs})
              </CardTitle>
              <CardDescription>Manage warehouse and depot information</CardDescription>
            </div>
            <div className="relative max-w-sm w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search warehouses..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingWarehouses ? (
            <div className="text-center py-8 text-muted-foreground">Loading warehouses...</div>
          ) : warehouses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No warehouses found matching your search' : 'No warehouses found'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {warehouses.map((warehouse) => (
                  <Card key={warehouse.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg font-semibold line-clamp-1 pr-2">
                          {warehouse.name}
                        </CardTitle>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditWarehouse(warehouse)}
                            className="h-8 w-8"
                            title="Edit Warehouse"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteWarehouse(warehouse)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete Warehouse"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {warehouse.type && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[60px]">Type:</span>
                            <span>{warehouse.type}</span>
                          </div>
                        )}
                        {warehouse.email && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[60px]">Email:</span>
                            <span className="wrap-break-word">{warehouse.email}</span>
                          </div>
                        )}
                        {warehouse.contact_name && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[60px]">Contact:</span>
                            <span>{warehouse.contact_name}</span>
                          </div>
                        )}
                        {warehouse.contact_phone && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[60px]">Phone:</span>
                            <span>{warehouse.contact_phone}</span>
                          </div>
                        )}
                        {(warehouse.street ||
                          warehouse.city ||
                          warehouse.state ||
                          warehouse.postcode) && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[60px]">Address:</span>
                            <span className="wrap-break-word">
                              {[
                                warehouse.street,
                                warehouse.city,
                                warehouse.state,
                                warehouse.postcode,
                              ]
                                .filter(Boolean)
                                .join(', ')}
                            </span>
                          </div>
                        )}
                        {warehouse.store && warehouse.store.length > 0 && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[60px]">Stores:</span>
                            <span className="wrap-break-word">
                              {warehouse.store.map((s) => s.store_name).join(', ')}
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
                    Showing {warehouses.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
                    {Math.min(page * limit, totalDocs)} of {totalDocs} warehouses
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={!hasPrevPage || loadingWarehouses}
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
                            disabled={loadingWarehouses}
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
                      disabled={!hasNextPage || loadingWarehouses}
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
