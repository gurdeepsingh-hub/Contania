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
  Package,
  Truck,
} from 'lucide-react'
import { hasPermission } from '@/lib/permissions'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { VesselForm } from '@/components/entity-forms/vessel-form'

type VesselItem = {
  id: number
  vesselName: string
  voyageNumber?: string
  lloydsNumber?: string
  wharfId?: number | { id: number; name?: string }
  jobType: 'import' | 'export'
  eta?: string
  availability?: string
  storageStart?: string
  firstFreeImportDate?: string
  etd?: string
  receivalStart?: string
  cutoff?: string
  reeferCutoff?: string
}

type TenantUser = {
  id?: number | string
  role?: number | string | { id: number; permissions?: Record<string, boolean> }
  [key: string]: unknown
}

export default function VesselsPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)
  const [_currentUser, setCurrentUser] = useState<TenantUser | null>(null)
  const [vessels, setVessels] = useState<VesselItem[]>([])
  const [loadingVessels, setLoadingVessels] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingVessel, setEditingVessel] = useState<VesselItem | null>(null)

  // Pagination state
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [totalDocs, setTotalDocs] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [hasPrevPage, setHasPrevPage] = useState(false)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import')

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
      loadVessels()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, page, limit, searchQuery, activeTab])

  const loadVessels = async () => {
    try {
      setLoadingVessels(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        depth: '1',
        jobType: activeTab,
        ...(searchQuery && { search: searchQuery }),
      })
      const res = await fetch(`/api/vessels?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.vessels) {
          setVessels(data.vessels)
          setTotalDocs(data.totalDocs || 0)
          setTotalPages(data.totalPages || 0)
          setHasPrevPage(data.hasPrevPage || false)
          setHasNextPage(data.hasNextPage || false)
        }
      }
    } catch (error) {
      console.error('Error loading vessels:', error)
    } finally {
      setLoadingVessels(false)
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

  const handleAddVessel = (jobType?: 'import' | 'export') => {
    setEditingVessel(null)
    setShowAddForm(true)
    // If jobType is provided, it will be passed to the form
    if (jobType) {
      setActiveTab(jobType)
    }
  }

  const handleEditVessel = (vessel: VesselItem) => {
    setEditingVessel(vessel)
    setShowAddForm(true)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingVessel(null)
  }

  const handleSuccess = async () => {
    await loadVessels()
    setTimeout(() => {
      handleCancel()
    }, 1500)
  }

  const handleDeleteVessel = async (vessel: VesselItem) => {
    if (
      !confirm(`Are you sure you want to delete ${vessel.vesselName}? This action cannot be undone.`)
    ) {
      return
    }

    try {
      const res = await fetch(`/api/vessels/${vessel.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Vessel deleted successfully')
        await loadVessels()
      } else {
        const data = await res.json()
        toast.error(data.message || 'Failed to delete vessel')
      }
    } catch (error) {
      console.error('Error deleting vessel:', error)
      toast.error('An error occurred while deleting the vessel')
    }
  }

  const getWharfName = (wharfId: number | { id: number; name?: string } | undefined): string => {
    if (!wharfId) return 'N/A'
    if (typeof wharfId === 'object' && wharfId !== null) {
      return wharfId.name || `Wharf ${wharfId.id}`
    }
    return `Wharf ${wharfId}`
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
          <h1 className="text-3xl font-bold">Vessels</h1>
          <p className="text-muted-foreground">Manage vessel information</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => {
            setActiveTab('import')
            setPage(1)
          }}
          className={`px-4 py-2 font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'import'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Package className="h-4 w-4" />
          Import
        </button>
        <button
          onClick={() => {
            setActiveTab('export')
            setPage(1)
          }}
          className={`px-4 py-2 font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'export'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Truck className="h-4 w-4" />
          Export
        </button>
      </div>

      <Dialog open={showAddForm} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVessel ? 'Edit Vessel' : `Add New ${activeTab === 'import' ? 'Import' : 'Export'} Vessel`}</DialogTitle>
            <DialogDescription>
              {editingVessel ? 'Update vessel information' : `Create a new ${activeTab} vessel`}
            </DialogDescription>
          </DialogHeader>
          <VesselForm
            key={editingVessel?.id || 'new'}
            initialData={editingVessel || undefined}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
            mode={editingVessel ? 'edit' : 'create'}
            jobType={editingVessel?.jobType || activeTab}
          />
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Ship className="h-5 w-5" />
                {activeTab === 'import' ? 'Import' : 'Export'} Vessels ({totalDocs})
              </CardTitle>
              <CardDescription>Manage {activeTab} vessel information</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative max-w-sm w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vessels..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => handleAddVessel(activeTab)} className="min-h-[44px]" title={`Add ${activeTab === 'import' ? 'Import' : 'Export'} Vessel`}>
                <Plus className="h-4 w-4 mr-2" />
                Add {activeTab === 'import' ? 'Import' : 'Export'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingVessels ? (
            <div className="text-center py-8 text-muted-foreground">Loading vessels...</div>
          ) : vessels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No vessels found matching your search' : 'No vessels found'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {vessels.map((vessel) => (
                  <Card key={vessel.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg font-semibold line-clamp-1 pr-2">
                          {vessel.vesselName}
                        </CardTitle>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditVessel(vessel)}
                            className="h-8 w-8"
                            title="Edit Vessel"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteVessel(vessel)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete Vessel"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {vessel.voyageNumber && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[80px]">Voyage:</span>
                            <span>{vessel.voyageNumber}</span>
                          </div>
                        )}
                        {vessel.lloydsNumber && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[80px]">Lloyds:</span>
                            <span>{vessel.lloydsNumber}</span>
                          </div>
                        )}
                        {vessel.wharfId && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[80px]">Wharf:</span>
                            <span>{getWharfName(vessel.wharfId)}</span>
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
                    Showing {vessels.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
                    {Math.min(page * limit, totalDocs)} of {totalDocs} vessels
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={!hasPrevPage || loadingVessels}
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
                            disabled={loadingVessels}
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
                      disabled={!hasNextPage || loadingVessels}
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

