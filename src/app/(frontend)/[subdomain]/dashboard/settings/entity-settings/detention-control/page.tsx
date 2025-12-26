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
  Clock,
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
import { DetentionControlForm } from '@/components/entity-forms/detention-control-form'

type DetentionControlItem = {
  id: number
  shippingLineId: number | { id: number; name?: string }
  containerType: 'RF' | 'DRY'
  importFreeDays?: number
  calculateImportFreeDaysUsing?: string
}

type TenantUser = {
  id?: number | string
  role?: number | string | { id: number; permissions?: Record<string, boolean> }
  [key: string]: unknown
}

export default function DetentionControlPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)
  const [_currentUser, setCurrentUser] = useState<TenantUser | null>(null)
  const [detentionControls, setDetentionControls] = useState<DetentionControlItem[]>([])
  const [loadingDetentionControls, setLoadingDetentionControls] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingDetentionControl, setEditingDetentionControl] =
    useState<DetentionControlItem | null>(null)

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
      loadDetentionControls()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, page, limit, searchQuery])

  const loadDetentionControls = async () => {
    try {
      setLoadingDetentionControls(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        depth: '1',
        ...(searchQuery && { search: searchQuery }),
      })
      const res = await fetch(`/api/detention-control?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.detentionControls) {
          setDetentionControls(data.detentionControls)
          setTotalDocs(data.totalDocs || 0)
          setTotalPages(data.totalPages || 0)
          setHasPrevPage(data.hasPrevPage || false)
          setHasNextPage(data.hasNextPage || false)
        }
      }
    } catch (error) {
      console.error('Error loading detention controls:', error)
    } finally {
      setLoadingDetentionControls(false)
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

  const handleAddDetentionControl = () => {
    setEditingDetentionControl(null)
    setShowAddForm(true)
  }

  const handleEditDetentionControl = (detentionControl: DetentionControlItem) => {
    setEditingDetentionControl(detentionControl)
    setShowAddForm(true)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingDetentionControl(null)
  }

  const handleSuccess = async () => {
    await loadDetentionControls()
    setTimeout(() => {
      handleCancel()
    }, 1500)
  }

  const handleDeleteDetentionControl = async (detentionControl: DetentionControlItem) => {
    if (
      !confirm(
        `Are you sure you want to delete this detention control? This action cannot be undone.`,
      )
    ) {
      return
    }

    try {
      const res = await fetch(`/api/detention-control/${detentionControl.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Detention control deleted successfully')
        await loadDetentionControls()
      } else {
        const data = await res.json()
        toast.error(data.message || 'Failed to delete detention control')
      }
    } catch (error) {
      console.error('Error deleting detention control:', error)
      toast.error('An error occurred while deleting the detention control')
    }
  }

  const getShippingLineName = (
    shippingLineId: number | { id: number; name?: string },
  ): string => {
    if (typeof shippingLineId === 'object' && shippingLineId !== null) {
      return shippingLineId.name || `Shipping Line ${shippingLineId.id}`
    }
    return `Shipping Line ${shippingLineId}`
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
          <h1 className="text-3xl font-bold">Detention Control</h1>
          <p className="text-muted-foreground">Manage detention control information</p>
        </div>
        <Button
          onClick={handleAddDetentionControl}
          className="min-h-[44px]"
          size="icon"
          title="Add Detention Control"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={showAddForm} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDetentionControl
                ? 'Edit Detention Control'
                : 'Add New Detention Control'}
            </DialogTitle>
            <DialogDescription>
              {editingDetentionControl
                ? 'Update detention control information'
                : 'Create a new detention control'}
            </DialogDescription>
          </DialogHeader>
          <DetentionControlForm
            initialData={editingDetentionControl || undefined}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
            mode={editingDetentionControl ? 'edit' : 'create'}
          />
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Detention Controls ({totalDocs})
              </CardTitle>
              <CardDescription>Manage detention control information</CardDescription>
            </div>
            <div className="relative max-w-sm w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search detention controls..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingDetentionControls ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading detention controls...
            </div>
          ) : detentionControls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery
                ? 'No detention controls found matching your search'
                : 'No detention controls found'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {detentionControls.map((detentionControl) => (
                  <Card key={detentionControl.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg font-semibold line-clamp-1 pr-2">
                          {getShippingLineName(detentionControl.shippingLineId)} -{' '}
                          {detentionControl.containerType}
                        </CardTitle>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditDetentionControl(detentionControl)}
                            className="h-8 w-8"
                            title="Edit Detention Control"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteDetentionControl(detentionControl)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete Detention Control"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-start gap-2">
                          <span className="font-medium min-w-[80px]">Container Type:</span>
                          <span>{detentionControl.containerType}</span>
                        </div>
                        {detentionControl.importFreeDays !== undefined && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[80px]">Import Free Days:</span>
                            <span>{detentionControl.importFreeDays}</span>
                          </div>
                        )}
                        {detentionControl.calculateImportFreeDaysUsing && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[80px]">Calculate Using:</span>
                            <span>{detentionControl.calculateImportFreeDaysUsing}</span>
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
                    Showing {detentionControls.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
                    {Math.min(page * limit, totalDocs)} of {totalDocs} detention controls
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={!hasPrevPage || loadingDetentionControls}
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
                            disabled={loadingDetentionControls}
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
                      disabled={!hasNextPage || loadingDetentionControls}
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

