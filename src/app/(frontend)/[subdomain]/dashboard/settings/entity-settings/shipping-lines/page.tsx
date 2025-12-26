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
  Ship,
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
import { ShippingLineForm } from '@/components/entity-forms/shipping-line-form'

type ShippingLineItem = {
  id: number
  name: string
  email?: string
  contactName?: string
  contactPhoneNumber?: string
  address?: {
    street?: string
    city?: string
    state?: string
    postcode?: string
  }
  importFreeDays?: number
  calculateImportFreeDaysUsing?: string
}

type TenantUser = {
  id?: number | string
  role?: number | string | { id: number; permissions?: Record<string, boolean> }
  [key: string]: unknown
}

export default function ShippingLinesPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)
  const [_currentUser, setCurrentUser] = useState<TenantUser | null>(null)
  const [shippingLines, setShippingLines] = useState<ShippingLineItem[]>([])
  const [loadingShippingLines, setLoadingShippingLines] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingShippingLine, setEditingShippingLine] = useState<ShippingLineItem | null>(null)

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
      loadShippingLines()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, page, limit, searchQuery])

  const loadShippingLines = async () => {
    try {
      setLoadingShippingLines(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(searchQuery && { search: searchQuery }),
      })
      const res = await fetch(`/api/shipping-lines?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.shippingLines) {
          setShippingLines(data.shippingLines)
          setTotalDocs(data.totalDocs || 0)
          setTotalPages(data.totalPages || 0)
          setHasPrevPage(data.hasPrevPage || false)
          setHasNextPage(data.hasNextPage || false)
        }
      }
    } catch (error) {
      console.error('Error loading shipping lines:', error)
    } finally {
      setLoadingShippingLines(false)
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

  const handleAddShippingLine = () => {
    setEditingShippingLine(null)
    setShowAddForm(true)
  }

  const handleEditShippingLine = (shippingLine: ShippingLineItem) => {
    setEditingShippingLine(shippingLine)
    setShowAddForm(true)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingShippingLine(null)
  }

  const handleSuccess = async () => {
    await loadShippingLines()
    setTimeout(() => {
      handleCancel()
    }, 1500)
  }

  const handleDeleteShippingLine = async (shippingLine: ShippingLineItem) => {
    if (
      !confirm(
        `Are you sure you want to delete ${shippingLine.name}? This action cannot be undone.`,
      )
    ) {
      return
    }

    try {
      const res = await fetch(`/api/shipping-lines/${shippingLine.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Shipping line deleted successfully')
        await loadShippingLines()
      } else {
        const data = await res.json()
        toast.error(data.message || 'Failed to delete shipping line')
      }
    } catch (error) {
      console.error('Error deleting shipping line:', error)
      toast.error('An error occurred while deleting the shipping line')
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
          <h1 className="text-3xl font-bold">Shipping Lines</h1>
          <p className="text-muted-foreground">Manage shipping line information</p>
        </div>
        <Button
          onClick={handleAddShippingLine}
          className="min-h-[44px]"
          size="icon"
          title="Add Shipping Line"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={showAddForm} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingShippingLine ? 'Edit Shipping Line' : 'Add New Shipping Line'}
            </DialogTitle>
            <DialogDescription>
              {editingShippingLine
                ? 'Update shipping line information'
                : 'Create a new shipping line'}
            </DialogDescription>
          </DialogHeader>
          <ShippingLineForm
            initialData={editingShippingLine || undefined}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
            mode={editingShippingLine ? 'edit' : 'create'}
          />
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Ship className="h-5 w-5" />
                Shipping Lines ({totalDocs})
              </CardTitle>
              <CardDescription>Manage shipping line information</CardDescription>
            </div>
            <div className="relative max-w-sm w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search shipping lines..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingShippingLines ? (
            <div className="text-center py-8 text-muted-foreground">Loading shipping lines...</div>
          ) : shippingLines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery
                ? 'No shipping lines found matching your search'
                : 'No shipping lines found'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {shippingLines.map((shippingLine) => (
                  <Card key={shippingLine.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg font-semibold line-clamp-1 pr-2">
                          {shippingLine.name}
                        </CardTitle>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditShippingLine(shippingLine)}
                            className="h-8 w-8"
                            title="Edit Shipping Line"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteShippingLine(shippingLine)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete Shipping Line"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {shippingLine.email && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[80px]">Email:</span>
                            <span className="wrap-break-word">{shippingLine.email}</span>
                          </div>
                        )}
                        {shippingLine.contactName && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[80px]">Contact:</span>
                            <span>{shippingLine.contactName}</span>
                          </div>
                        )}
                        {shippingLine.contactPhoneNumber && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[80px]">Phone:</span>
                            <span>{shippingLine.contactPhoneNumber}</span>
                          </div>
                        )}
                        {shippingLine.importFreeDays !== undefined && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[80px]">Import Free Days:</span>
                            <span>{shippingLine.importFreeDays}</span>
                          </div>
                        )}
                        {shippingLine.calculateImportFreeDaysUsing && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[80px]">Calculate Using:</span>
                            <span>{shippingLine.calculateImportFreeDaysUsing}</span>
                          </div>
                        )}
                        {shippingLine.address &&
                          (shippingLine.address.street ||
                            shippingLine.address.city ||
                            shippingLine.address.state ||
                            shippingLine.address.postcode) && (
                            <div className="flex items-start gap-2">
                              <span className="font-medium min-w-[80px]">Address:</span>
                              <span className="wrap-break-word">
                                {[
                                  shippingLine.address.street,
                                  shippingLine.address.city,
                                  shippingLine.address.state,
                                  shippingLine.address.postcode,
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
                    Showing {shippingLines.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
                    {Math.min(page * limit, totalDocs)} of {totalDocs} shipping lines
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={!hasPrevPage || loadingShippingLines}
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
                            disabled={loadingShippingLines}
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
                      disabled={!hasNextPage || loadingShippingLines}
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

