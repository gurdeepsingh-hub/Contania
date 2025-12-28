'use client'

import { useEffect, useState } from 'react'

import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Store,
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
import { StoreForm } from '@/components/entity-forms/store-form'

type StoreItem = {
  id: number
  warehouseId: number | string | { id: number; name?: string }
  storeName: string
  countable?: boolean
  zoneType: 'Indock' | 'Outdock' | 'Storage'
}

type TenantUser = {
  id?: number | string
  role?: number | string | { id: number; permissions?: Record<string, boolean> }
  [key: string]: unknown
}

export default function StoresPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)
  const [_currentUser, setCurrentUser] = useState<TenantUser | null>(null)
  const [stores, setStores] = useState<StoreItem[]>([])
  const [loadingStores, setLoadingStores] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingStore, setEditingStore] = useState<StoreItem | null>(null)

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
      loadStores()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, page, limit, searchQuery])

  const loadStores = async () => {
    try {
      setLoadingStores(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        depth: '1', // Include warehouse details
        ...(searchQuery && { search: searchQuery }),
      })
      const res = await fetch(`/api/stores?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.stores) {
          setStores(data.stores)
          setTotalDocs(data.totalDocs || 0)
          setTotalPages(data.totalPages || 0)
          setHasPrevPage(data.hasPrevPage || false)
          setHasNextPage(data.hasNextPage || false)
        }
      }
    } catch (error) {
      console.error('Error loading stores:', error)
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

  const handleAddStore = () => {
    setEditingStore(null)
    setShowAddForm(true)
  }

  const handleEditStore = (store: StoreItem) => {
    setEditingStore(store)
    setShowAddForm(true)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingStore(null)
  }

  const handleSuccess = async () => {
    await loadStores()
    setTimeout(() => {
      handleCancel()
    }, 1500)
  }

  const handleDeleteStore = async (store: StoreItem) => {
    if (
      !confirm(`Are you sure you want to delete ${store.storeName}? This action cannot be undone.`)
    ) {
      return
    }

    try {
      const res = await fetch(`/api/stores/${store.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Store deleted successfully')
        await loadStores()
      } else {
        const data = await res.json()
        toast.error(data.message || 'Failed to delete store')
      }
    } catch (error) {
      console.error('Error deleting store:', error)
      toast.error('An error occurred while deleting the store')
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

  const getWarehouseName = (
    warehouseId: number | string | { id: number; name?: string },
  ): string => {
    if (typeof warehouseId === 'object' && warehouseId !== null) {
      return warehouseId.name || `Warehouse ${warehouseId.id}`
    }
    return `Warehouse ${warehouseId}`
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
          <h1 className="text-3xl font-bold">Stores</h1>
          <p className="text-muted-foreground">Manage store information</p>
        </div>
        <Button onClick={handleAddStore} className="min-h-[44px]" size="icon" title="Add Store">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={showAddForm} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStore ? 'Edit Store' : 'Add New Store'}</DialogTitle>
            <DialogDescription>
              {editingStore ? 'Update store information' : 'Create a new store'}
            </DialogDescription>
          </DialogHeader>
          <StoreForm
            initialData={editingStore || undefined}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
            mode={editingStore ? 'edit' : 'create'}
          />
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Stores ({totalDocs})
              </CardTitle>
              <CardDescription>Manage store information</CardDescription>
            </div>
            <div className="relative max-w-sm w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search stores..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingStores ? (
            <div className="text-center py-8 text-muted-foreground">Loading stores...</div>
          ) : stores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No stores found matching your search' : 'No stores found'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {stores.map((store) => (
                  <Card key={store.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg font-semibold line-clamp-1 pr-2">
                          {store.storeName}
                        </CardTitle>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditStore(store)}
                            className="h-8 w-8"
                            title="Edit Store"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteStore(store)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete Store"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-start gap-2">
                          <span className="font-medium min-w-[80px]">Warehouse:</span>
                          <span className="wrap-break-word">
                            {getWarehouseName(store.warehouseId)}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-medium min-w-[80px]">Zone Type:</span>
                          <span>{store.zoneType}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-medium min-w-[80px]">Countable:</span>
                          <span>{store.countable ? 'Yes' : 'No'}</span>
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
                    Showing {stores.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
                    {Math.min(page * limit, totalDocs)} of {totalDocs} stores
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={!hasPrevPage || loadingStores}
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
                            disabled={loadingStores}
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
                      disabled={!hasNextPage || loadingStores}
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
