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

type TransportCompany = {
  id: number
  name: string
  contact?: string
  mobile?: string
}

type TenantUser = {
  id?: number | string
  role?: number | string | { id: number; permissions?: Record<string, boolean> }
  [key: string]: unknown
}

export default function TransportCompaniesPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)
  const [_currentUser, setCurrentUser] = useState<TenantUser | null>(null)
  const [transportCompanies, setTransportCompanies] = useState<TransportCompany[]>([])
  const [loadingTransportCompanies, setLoadingTransportCompanies] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingTransportCompany, setEditingTransportCompany] = useState<TransportCompany | null>(
    null,
  )
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

  const transportCompanySchema = z.object({
    name: z.string().min(1, 'Company name is required'),
    contact: z.string().optional(),
    mobile: z.string().optional(),
  })

  type TransportCompanyFormData = z.infer<typeof transportCompanySchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TransportCompanyFormData>({
    resolver: zodResolver(transportCompanySchema),
    defaultValues: {
      name: '',
      contact: '',
      mobile: '',
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
      loadTransportCompanies()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, page, limit, searchQuery])

  const loadTransportCompanies = async () => {
    try {
      setLoadingTransportCompanies(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(searchQuery && { search: searchQuery }),
      })
      const res = await fetch(`/api/transport-companies?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.transportCompanies) {
          setTransportCompanies(data.transportCompanies)
          setTotalDocs(data.totalDocs || 0)
          setTotalPages(data.totalPages || 0)
          setHasPrevPage(data.hasPrevPage || false)
          setHasNextPage(data.hasNextPage || false)
        }
      }
    } catch (error) {
      console.error('Error loading transport companies:', error)
    } finally {
      setLoadingTransportCompanies(false)
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
      contact: '',
      mobile: '',
    })
    setError(null)
    setSuccess(null)
  }

  const handleAddTransportCompany = () => {
    resetForm()
    setShowAddForm(true)
    setEditingTransportCompany(null)
  }

  const handleEditTransportCompany = (transportCompany: TransportCompany) => {
    reset({
      name: transportCompany.name || '',
      contact: transportCompany.contact || '',
      mobile: transportCompany.mobile || '',
    })
    setEditingTransportCompany(transportCompany)
    setShowAddForm(true)
    setError(null)
    setSuccess(null)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingTransportCompany(null)
    resetForm()
  }

  const onSubmit = async (data: TransportCompanyFormData) => {
    setError(null)
    setSuccess(null)

    try {
      if (editingTransportCompany) {
        const res = await fetch(`/api/transport-companies/${editingTransportCompany.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (res.ok) {
          setSuccess('Transport company updated successfully')
          await loadTransportCompanies()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const responseData = await res.json()
          setError(responseData.message || 'Failed to update transport company')
        }
      } else {
        const res = await fetch('/api/transport-companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (res.ok) {
          setSuccess('Transport company created successfully')
          await loadTransportCompanies()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const responseData = await res.json()
          setError(responseData.message || 'Failed to create transport company')
        }
      }
    } catch (error) {
      console.error('Error saving transport company:', error)
      setError('An error occurred while saving the transport company')
    }
  }

  const handleDeleteTransportCompany = async (transportCompany: TransportCompany) => {
    if (
      !confirm(
        `Are you sure you want to delete ${transportCompany.name}? This action cannot be undone.`,
      )
    ) {
      return
    }

    try {
      const res = await fetch(`/api/transport-companies/${transportCompany.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setSuccess('Transport company deleted successfully')
        await loadTransportCompanies()
        setTimeout(() => setSuccess(null), 2000)
      } else {
        const data = await res.json()
        setError(data.message || 'Failed to delete transport company')
      }
    } catch (error) {
      console.error('Error deleting transport company:', error)
      setError('An error occurred while deleting the transport company')
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
          <h1 className="text-3xl font-bold">Transport Companies</h1>
          <p className="text-muted-foreground">Manage third-party transport company information</p>
        </div>
        <Button
          onClick={handleAddTransportCompany}
          className="min-h-[44px]"
          size="icon"
          title="Add Transport Company"
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
              {editingTransportCompany ? 'Edit Transport Company' : 'Add New Transport Company'}
            </DialogTitle>
            <DialogDescription>
              {editingTransportCompany
                ? 'Update transport company information'
                : 'Create a new transport company'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Company Name"
                required
                error={errors.name?.message}
                placeholder="Transport company name"
                {...register('name')}
              />
              <FormInput
                label="Contact Person"
                error={errors.contact?.message}
                placeholder="Primary contact person"
                {...register('contact')}
              />
              <FormInput
                label="Mobile"
                type="tel"
                error={errors.mobile?.message}
                placeholder="Contact mobile number"
                {...register('mobile')}
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
                {editingTransportCompany ? 'Update Transport Company' : 'Create Transport Company'}
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
                Transport Companies ({totalDocs})
              </CardTitle>
              <CardDescription>Manage transport company information</CardDescription>
            </div>
            <div className="relative max-w-sm w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transport companies..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTransportCompanies ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading transport companies...
            </div>
          ) : transportCompanies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery
                ? 'No transport companies found matching your search'
                : 'No transport companies found'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {transportCompanies.map((transportCompany) => (
                  <Card key={transportCompany.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg font-semibold line-clamp-1 pr-2">
                          {transportCompany.name}
                        </CardTitle>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditTransportCompany(transportCompany)}
                            className="h-8 w-8"
                            title="Edit Transport Company"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteTransportCompany(transportCompany)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete Transport Company"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {transportCompany.contact && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[60px]">Contact:</span>
                            <span>{transportCompany.contact}</span>
                          </div>
                        )}
                        {transportCompany.mobile && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[60px]">Mobile:</span>
                            <span>{transportCompany.mobile}</span>
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
                    Showing {transportCompanies.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
                    {Math.min(page * limit, totalDocs)} of {totalDocs} transport companies
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={!hasPrevPage || loadingTransportCompanies}
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
                            disabled={loadingTransportCompanies}
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
                      disabled={!hasNextPage || loadingTransportCompanies}
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
