'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  CreditCard,
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

type PayingCustomer = {
  id: number
  customer_name: string
  abn?: string
  email?: string
  contact_name?: string
  contact_phone?: string
  billing_street?: string
  billing_city?: string
  billing_state?: string
  billing_postcode?: string
  delivery_same_as_billing?: boolean
  delivery_street?: string
  delivery_city?: string
  delivery_state?: string
  delivery_postcode?: string
}

type TenantUser = {
  id?: number | string
  role?: number | string | { id: number; permissions?: Record<string, boolean> }
  [key: string]: unknown
}

export default function PayingCustomersPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)
  const [currentUser, setCurrentUser] = useState<TenantUser | null>(null)
  const [payingCustomers, setPayingCustomers] = useState<PayingCustomer[]>([])
  const [loadingPayingCustomers, setLoadingPayingCustomers] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingPayingCustomer, setEditingPayingCustomer] = useState<PayingCustomer | null>(null)
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

  const [formData, setFormData] = useState({
    customer_name: '',
    abn: '',
    email: '',
    contact_name: '',
    contact_phone: '',
    billing_street: '',
    billing_city: '',
    billing_state: '',
    billing_postcode: '',
    delivery_same_as_billing: false,
    delivery_street: '',
    delivery_city: '',
    delivery_state: '',
    delivery_postcode: '',
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
      loadPayingCustomers()
    }
  }, [authChecked, page, limit, searchQuery])

  useEffect(() => {
    if (formData.delivery_same_as_billing) {
      setFormData((prev) => ({
        ...prev,
        delivery_street: prev.billing_street,
        delivery_city: prev.billing_city,
        delivery_state: prev.billing_state,
        delivery_postcode: prev.billing_postcode,
      }))
    }
  }, [
    formData.delivery_same_as_billing,
    formData.billing_street,
    formData.billing_city,
    formData.billing_state,
    formData.billing_postcode,
  ])

  const loadPayingCustomers = async () => {
    try {
      setLoadingPayingCustomers(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(searchQuery && { search: searchQuery }),
      })
      const res = await fetch(`/api/paying-customers?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.payingCustomers) {
          setPayingCustomers(data.payingCustomers)
          setTotalDocs(data.totalDocs || 0)
          setTotalPages(data.totalPages || 0)
          setHasPrevPage(data.hasPrevPage || false)
          setHasNextPage(data.hasNextPage || false)
        }
      }
    } catch (error) {
      console.error('Error loading paying customers:', error)
    } finally {
      setLoadingPayingCustomers(false)
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
    setFormData({
      customer_name: '',
      abn: '',
      email: '',
      contact_name: '',
      contact_phone: '',
      billing_street: '',
      billing_city: '',
      billing_state: '',
      billing_postcode: '',
      delivery_same_as_billing: false,
      delivery_street: '',
      delivery_city: '',
      delivery_state: '',
      delivery_postcode: '',
    })
    setError(null)
    setSuccess(null)
  }

  const handleAddPayingCustomer = () => {
    resetForm()
    setShowAddForm(true)
    setEditingPayingCustomer(null)
  }

  const handleEditPayingCustomer = (payingCustomer: PayingCustomer) => {
    setFormData({
      customer_name: payingCustomer.customer_name || '',
      abn: payingCustomer.abn || '',
      email: payingCustomer.email || '',
      contact_name: payingCustomer.contact_name || '',
      contact_phone: payingCustomer.contact_phone || '',
      billing_street: payingCustomer.billing_street || '',
      billing_city: payingCustomer.billing_city || '',
      billing_state: payingCustomer.billing_state || '',
      billing_postcode: payingCustomer.billing_postcode || '',
      delivery_same_as_billing: payingCustomer.delivery_same_as_billing || false,
      delivery_street: payingCustomer.delivery_street || '',
      delivery_city: payingCustomer.delivery_city || '',
      delivery_state: payingCustomer.delivery_state || '',
      delivery_postcode: payingCustomer.delivery_postcode || '',
    })
    setEditingPayingCustomer(payingCustomer)
    setShowAddForm(true)
    setError(null)
    setSuccess(null)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingPayingCustomer(null)
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!formData.customer_name) {
      setError('Customer name is required')
      return
    }

    try {
      if (editingPayingCustomer) {
        const res = await fetch(`/api/paying-customers/${editingPayingCustomer.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })

        if (res.ok) {
          setSuccess('Paying customer updated successfully')
          await loadPayingCustomers()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const data = await res.json()
          setError(data.message || 'Failed to update paying customer')
        }
      } else {
        const res = await fetch('/api/paying-customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })

        if (res.ok) {
          setSuccess('Paying customer created successfully')
          await loadPayingCustomers()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const data = await res.json()
          setError(data.message || 'Failed to create paying customer')
        }
      }
    } catch (error) {
      console.error('Error saving paying customer:', error)
      setError('An error occurred while saving the paying customer')
    }
  }

  const handleDeletePayingCustomer = async (payingCustomer: PayingCustomer) => {
    if (
      !confirm(
        `Are you sure you want to delete ${payingCustomer.customer_name}? This action cannot be undone.`,
      )
    ) {
      return
    }

    try {
      const res = await fetch(`/api/paying-customers/${payingCustomer.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setSuccess('Paying customer deleted successfully')
        await loadPayingCustomers()
        setTimeout(() => setSuccess(null), 2000)
      } else {
        const data = await res.json()
        setError(data.message || 'Failed to delete paying customer')
      }
    } catch (error) {
      console.error('Error deleting paying customer:', error)
      setError('An error occurred while deleting the paying customer')
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
          <h1 className="text-3xl font-bold">Paying Customers</h1>
          <p className="text-muted-foreground">Manage paying customer information</p>
        </div>
        <Button
          onClick={handleAddPayingCustomer}
          className="min-h-[44px]"
          size="icon"
          title="Add Paying Customer"
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPayingCustomer ? 'Edit Paying Customer' : 'Add New Paying Customer'}
            </DialogTitle>
            <DialogDescription>
              {editingPayingCustomer
                ? 'Update paying customer information'
                : 'Create a new paying customer'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customer_name">Customer Name *</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  required
                  placeholder="Customer name"
                />
              </div>
              <div>
                <Label htmlFor="abn">ABN</Label>
                <Input
                  id="abn"
                  value={formData.abn}
                  onChange={(e) => setFormData({ ...formData, abn: e.target.value })}
                  placeholder="Business number"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="customer@example.com"
                />
              </div>
              <div>
                <Label htmlFor="contact_name">Contact Name</Label>
                <Input
                  id="contact_name"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  placeholder="Primary contact person"
                />
              </div>
              <div>
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input
                  id="contact_phone"
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  placeholder="+61 2 XXXX XXXX"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4">Billing Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="billing_street">Street</Label>
                  <Input
                    id="billing_street"
                    value={formData.billing_street}
                    onChange={(e) => setFormData({ ...formData, billing_street: e.target.value })}
                    placeholder="Street address"
                  />
                </div>
                <div>
                  <Label htmlFor="billing_city">City</Label>
                  <Input
                    id="billing_city"
                    value={formData.billing_city}
                    onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })}
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label htmlFor="billing_state">State</Label>
                  <Input
                    id="billing_state"
                    value={formData.billing_state}
                    onChange={(e) => setFormData({ ...formData, billing_state: e.target.value })}
                    placeholder="State/Province"
                  />
                </div>
                <div>
                  <Label htmlFor="billing_postcode">Postcode</Label>
                  <Input
                    id="billing_postcode"
                    value={formData.billing_postcode}
                    onChange={(e) => setFormData({ ...formData, billing_postcode: e.target.value })}
                    placeholder="Postal code"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  id="delivery_same_as_billing"
                  checked={formData.delivery_same_as_billing}
                  onChange={(e) =>
                    setFormData({ ...formData, delivery_same_as_billing: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="delivery_same_as_billing" className="cursor-pointer">
                  Delivery address same as billing address
                </Label>
              </div>
              {!formData.delivery_same_as_billing && (
                <>
                  <h3 className="text-lg font-semibold mb-4">Delivery Address</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="delivery_street">Street</Label>
                      <Input
                        id="delivery_street"
                        value={formData.delivery_street}
                        onChange={(e) =>
                          setFormData({ ...formData, delivery_street: e.target.value })
                        }
                        placeholder="Street address"
                      />
                    </div>
                    <div>
                      <Label htmlFor="delivery_city">City</Label>
                      <Input
                        id="delivery_city"
                        value={formData.delivery_city}
                        onChange={(e) =>
                          setFormData({ ...formData, delivery_city: e.target.value })
                        }
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <Label htmlFor="delivery_state">State</Label>
                      <Input
                        id="delivery_state"
                        value={formData.delivery_state}
                        onChange={(e) =>
                          setFormData({ ...formData, delivery_state: e.target.value })
                        }
                        placeholder="State/Province"
                      />
                    </div>
                    <div>
                      <Label htmlFor="delivery_postcode">Postcode</Label>
                      <Input
                        id="delivery_postcode"
                        value={formData.delivery_postcode}
                        onChange={(e) =>
                          setFormData({ ...formData, delivery_postcode: e.target.value })
                        }
                        placeholder="Postal code"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit">
                <Save className="h-4 w-4 mr-2" />
                {editingPayingCustomer ? 'Update Paying Customer' : 'Create Paying Customer'}
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
                <CreditCard className="h-5 w-5" />
                Paying Customers ({totalDocs})
              </CardTitle>
              <CardDescription>Manage paying customer information</CardDescription>
            </div>
            <div className="relative max-w-sm w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search paying customers..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPayingCustomers ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading paying customers...
            </div>
          ) : payingCustomers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery
                ? 'No paying customers found matching your search'
                : 'No paying customers found'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {payingCustomers.map((payingCustomer) => (
                  <Card key={payingCustomer.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg font-semibold line-clamp-1 pr-2">
                          {payingCustomer.customer_name}
                        </CardTitle>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditPayingCustomer(payingCustomer)}
                            className="h-8 w-8"
                            title="Edit Paying Customer"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletePayingCustomer(payingCustomer)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete Paying Customer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {payingCustomer.abn && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[60px]">ABN:</span>
                            <span>{payingCustomer.abn}</span>
                          </div>
                        )}
                        {payingCustomer.email && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[60px]">Email:</span>
                            <span className="break-words">{payingCustomer.email}</span>
                          </div>
                        )}
                        {payingCustomer.contact_name && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[60px]">Contact:</span>
                            <span>{payingCustomer.contact_name}</span>
                          </div>
                        )}
                        {payingCustomer.contact_phone && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[60px]">Phone:</span>
                            <span>{payingCustomer.contact_phone}</span>
                          </div>
                        )}
                        {(payingCustomer.billing_street ||
                          payingCustomer.billing_city ||
                          payingCustomer.billing_state ||
                          payingCustomer.billing_postcode) && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[60px]">Billing:</span>
                            <span className="break-words">
                              {[
                                payingCustomer.billing_street,
                                payingCustomer.billing_city,
                                payingCustomer.billing_state,
                                payingCustomer.billing_postcode,
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
                    Showing {payingCustomers.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
                    {Math.min(page * limit, totalDocs)} of {totalDocs} paying customers
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={!hasPrevPage || loadingPayingCustomers}
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
                            disabled={loadingPayingCustomers}
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
                      disabled={!hasNextPage || loadingPayingCustomers}
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
