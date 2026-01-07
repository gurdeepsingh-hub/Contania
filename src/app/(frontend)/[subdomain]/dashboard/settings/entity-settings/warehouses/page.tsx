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
  Store,
  AlertTriangle,
} from 'lucide-react'
import { hasPermission } from '@/lib/permissions'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

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
  type?: string
  storeCount?: number
}

type StoreItem = {
  id: number
  storeName: string
  zoneType: 'Indock' | 'Outdock' | 'Storage'
  countable?: boolean
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
  const [showStoreForm, setShowStoreForm] = useState(false)
  const [creatingStore, setCreatingStore] = useState(false)
  const [currentWarehouseId, setCurrentWarehouseId] = useState<number | null>(null)
  const [warehouseStores, setWarehouseStores] = useState<StoreItem[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [warehouseToDelete, setWarehouseToDelete] = useState<WarehouseItem | null>(null)
  const [storesToDelete, setStoresToDelete] = useState<StoreItem[]>([])

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
  })

  const storeSchema = z.object({
    storeName: z.string().min(1, 'Store name is required'),
    countable: z.boolean(),
    zoneType: z.enum(['Indock', 'Outdock', 'Storage']),
  })

  type WarehouseFormData = z.infer<typeof warehouseSchema>
  type StoreFormData = z.infer<typeof storeSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
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
    },
  })

  const {
    register: registerStore,
    handleSubmit: handleSubmitStore,
    formState: { errors: storeErrors },
    reset: resetStore,
  } = useForm<StoreFormData>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      storeName: '',
      countable: false,
      zoneType: undefined,
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
          // Fetch store counts for each warehouse
          // Use Promise.allSettled to handle errors gracefully
          const warehousePromises = data.warehouses.map(async (warehouse: WarehouseItem) => {
            try {
              const storesRes = await fetch(
                `/api/stores?warehouseId=${warehouse.id}&limit=1`
              )
              if (storesRes.ok) {
                const storesData = await storesRes.json()
                return {
                  ...warehouse,
                  storeCount: storesData.totalDocs || 0,
                }
              } else {
                // Log error but don't fail the whole operation
                console.warn(
                  `Failed to fetch store count for warehouse ${warehouse.id}:`,
                  storesRes.status
                )
                return { ...warehouse, storeCount: 0 }
              }
            } catch (error) {
              // Log error but don't fail the whole operation
              console.warn(
                `Error fetching store count for warehouse ${warehouse.id}:`,
                error
              )
              return { ...warehouse, storeCount: 0 }
            }
          })

          // Try to fetch store counts, but don't fail if it doesn't work
          try {
            const results = await Promise.allSettled(warehousePromises)
            const warehousesWithCounts = results.map((result, index) => {
              if (result.status === 'fulfilled') {
                return result.value
              } else {
                // If promise rejected, return warehouse with 0 count
                console.warn(
                  `Failed to get store count for warehouse ${data.warehouses[index]?.id}:`,
                  result.reason
                )
                return { ...data.warehouses[index], storeCount: 0 }
              }
            })
            setWarehouses(warehousesWithCounts)
          } catch (error) {
            // If store count fetching completely fails, just show warehouses without counts
            console.error('Error fetching store counts:', error)
            setWarehouses(data.warehouses.map((w: WarehouseItem) => ({ ...w, storeCount: 0 })))
          }
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

  const loadWarehouseStores = async (warehouseId: number) => {
    try {
      setLoadingStores(true)
      const res = await fetch(`/api/stores?warehouseId=${warehouseId}&limit=100`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.stores) {
          setWarehouseStores(data.stores)
        }
      }
    } catch (error) {
      console.error('Error loading warehouse stores:', error)
    } finally {
      setLoadingStores(false)
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
    })
  }

  const handleAddWarehouse = () => {
    resetForm()
    setShowAddForm(true)
    setEditingWarehouse(null)
    setCurrentWarehouseId(null)
    setShowStoreForm(false)
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
    })
    setEditingWarehouse(warehouse)
    setCurrentWarehouseId(warehouse.id)
    setShowAddForm(true)
    // Load stores for this warehouse
    loadWarehouseStores(warehouse.id)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingWarehouse(null)
    setCurrentWarehouseId(null)
    setShowStoreForm(false)
    setWarehouseStores([])
    resetForm()
    resetStore()
  }

  const onCreateStore = async (storeData: StoreFormData) => {
    const warehouseId = currentWarehouseId || editingWarehouse?.id || null
    if (!warehouseId) {
      toast.error('Please create the warehouse first before adding stores')
      return
    }

    setCreatingStore(true)
    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId,
          ...storeData,
        }),
      })

      if (res.ok) {
        const _responseData = await res.json()
        toast.success('Store created successfully')
        resetStore()
        setShowStoreForm(false)
        // Reload stores list and warehouses
        if (currentWarehouseId || editingWarehouse?.id) {
          await loadWarehouseStores(currentWarehouseId || editingWarehouse!.id)
        }
        await loadWarehouses()
      } else {
        const errorData = await res.json()
        toast.error(errorData.message || 'Failed to create store')
      }
    } catch (error) {
      console.error('Error creating store:', error)
      toast.error('Failed to create store')
    } finally {
      setCreatingStore(false)
    }
  }

  const onSubmit = async (data: WarehouseFormData) => {
    try {
      if (editingWarehouse) {
        const res = await fetch(`/api/warehouses/${editingWarehouse.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (res.ok) {
          const responseData = await res.json()
          const warehouse = responseData.warehouse || responseData
          if (warehouse.id) {
            setCurrentWarehouseId(warehouse.id)
            // Reload stores for the updated warehouse
            await loadWarehouseStores(warehouse.id)
          }
          toast.success('Warehouse updated successfully')
          await loadWarehouses()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const responseData = await res.json()
          toast.error(responseData.message || 'Failed to update warehouse')
        }
      } else {
        const res = await fetch('/api/warehouses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (res.ok) {
          const responseData = await res.json()
          const warehouse = responseData.warehouse || responseData
          if (warehouse.id) {
            setCurrentWarehouseId(warehouse.id)
            // Load stores for the newly created warehouse (will be empty initially)
            await loadWarehouseStores(warehouse.id)
          }
          toast.success('Warehouse created successfully')
          await loadWarehouses()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const responseData = await res.json()
          toast.error(responseData.message || 'Failed to create warehouse')
        }
      }
    } catch (error) {
      console.error('Error saving warehouse:', error)
      toast.error('An error occurred while saving the warehouse')
    }
  }

  const handleDeleteClick = async (warehouse: WarehouseItem) => {
    // Fetch stores for this warehouse
    try {
      const storesRes = await fetch(`/api/stores?warehouseId=${warehouse.id}&limit=100`)
      if (storesRes.ok) {
        const storesData = await storesRes.json()
        setStoresToDelete(storesData.stores || [])
      }
    } catch (error) {
      console.error('Error fetching stores:', error)
    }
    setWarehouseToDelete(warehouse)
    setShowDeleteDialog(true)
  }

  const handleDeleteWarehouse = async (deleteStores: boolean) => {
    if (!warehouseToDelete) return

    try {
      // If there are stores and user wants to delete them, delete stores first
      if (deleteStores && storesToDelete.length > 0) {
        for (const store of storesToDelete) {
          try {
            await fetch(`/api/stores/${store.id}`, {
              method: 'DELETE',
            })
          } catch (error) {
            console.error(`Error deleting store ${store.id}:`, error)
          }
        }
      }

      // Delete warehouse
      const res = await fetch(`/api/warehouses/${warehouseToDelete.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success(
          deleteStores && storesToDelete.length > 0
            ? 'Warehouse and stores deleted successfully'
            : 'Warehouse deleted successfully'
        )
        await loadWarehouses()
      } else {
        const data = await res.json()
        toast.error(data.message || 'Failed to delete warehouse')
      }
    } catch (error) {
      console.error('Error deleting warehouse:', error)
      toast.error('An error occurred while deleting the warehouse')
    } finally {
      setShowDeleteDialog(false)
      setWarehouseToDelete(null)
      setStoresToDelete([])
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

            {/* Stores List Section */}
            {(editingWarehouse?.id || currentWarehouseId) && (
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    Stores ({warehouseStores.length})
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowStoreForm(!showStoreForm)}
                    className="min-h-[36px]"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {showStoreForm ? 'Hide' : 'Quick Create Store'}
                  </Button>
                </div>

                {/* Display existing stores */}
                {loadingStores ? (
                  <div className="text-sm text-muted-foreground py-2">Loading stores...</div>
                ) : warehouseStores.length > 0 ? (
                  <div className="space-y-2">
                    {warehouseStores.map((store) => (
                      <div
                        key={store.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{store.storeName}</div>
                          <div className="text-muted-foreground text-xs">
                            {store.zoneType} {store.countable ? '• Countable' : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground py-2">
                    No stores found for this warehouse
                  </div>
                )}

                {showStoreForm && (
                  <div className="p-4 bg-muted rounded-lg space-y-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormInput
                          label="Store Name"
                          required
                          error={storeErrors.storeName?.message}
                          placeholder="Store name"
                          {...registerStore('storeName')}
                        />
                        <FormSelect
                          label="Zone Type"
                          required
                          error={storeErrors.zoneType?.message}
                          placeholder="Select zone type"
                          options={[
                            { value: 'Indock', label: 'Indock' },
                            { value: 'Outdock', label: 'Outdock' },
                            { value: 'Storage', label: 'Storage' },
                          ]}
                          {...registerStore('zoneType')}
                        />
                        <div className="flex items-center space-x-2 pt-6">
                          <input
                            type="checkbox"
                            id="countable-store"
                            {...registerStore('countable')}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <label
                            htmlFor="countable-store"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Countable
                          </label>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowStoreForm(false)
                            resetStore()
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={creatingStore}
                          onClick={handleSubmitStore(onCreateStore)}
                        >
                          {creatingStore ? 'Creating...' : 'Create Store'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                            onClick={() => handleDeleteClick(warehouse)}
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
                        {warehouse.storeCount !== undefined && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[60px]">Stores:</span>
                            <span className="flex items-center gap-1">
                              <Store className="h-3 w-3" />
                              {warehouse.storeCount}
                            </span>
                          </div>
                        )}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Warehouse
            </DialogTitle>
            <DialogDescription>
              {warehouseToDelete && (
                <>
                  {storesToDelete.length > 0 ? (
                    <div className="space-y-3 mt-2">
                      <p>
                        Are you sure you want to delete <strong>{warehouseToDelete.name}</strong>?
                      </p>
                      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                        <p className="text-sm font-medium text-destructive mb-2">
                          ⚠️ Warning: This warehouse has {storesToDelete.length} store
                          {storesToDelete.length !== 1 ? 's' : ''} attached to it.
                        </p>
                        <p className="text-sm">
                          Do you want to delete the warehouse and all its stores? This action
                          cannot be undone.
                        </p>
                        {storesToDelete.length > 0 && (
                          <div className="mt-2 text-xs space-y-1">
                            <p className="font-medium">Stores that will be deleted:</p>
                            <ul className="list-disc list-inside space-y-0.5 max-h-32 overflow-y-auto">
                              {storesToDelete.slice(0, 10).map((store) => (
                                <li key={store.id}>{store.storeName}</li>
                              ))}
                              {storesToDelete.length > 10 && (
                                <li className="text-muted-foreground">
                                  ... and {storesToDelete.length - 10} more
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p>
                      Are you sure you want to delete <strong>{warehouseToDelete.name}</strong>? This
                      action cannot be undone.
                    </p>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false)
                setWarehouseToDelete(null)
                setStoresToDelete([])
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            {storesToDelete.length > 0 ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleDeleteWarehouse(false)}
                  className="w-full sm:w-auto"
                >
                  Delete Warehouse Only
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteWarehouse(true)}
                  className="w-full sm:w-auto"
                >
                  Delete Warehouse & Stores
                </Button>
              </>
            ) : (
              <Button
                variant="destructive"
                onClick={() => handleDeleteWarehouse(false)}
                className="w-full sm:w-auto"
              >
                Delete Warehouse
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
