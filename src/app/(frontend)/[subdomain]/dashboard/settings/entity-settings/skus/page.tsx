'use client'

import { useEffect, useState, useRef } from 'react'
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
  Barcode,
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

type SKU = {
  id: number
  skuCode: string
  description?: string
  customerId?: number | { id: number; customer_name?: string }
  storageUnitId?: number | { id: number; name?: string; palletSpaces?: number }
  handlingUnitId?: number | { id: number; name?: string }
  palletSpacesOfStorageUnit?: number
  huPerSu?: number
  receiveHU?: string
  pickHU?: string
  pickStrategy?: string
  lengthPerHU_mm?: number
  widthPerHU_mm?: number
  heightPerHU_mm?: number
  weightPerHU_kg?: number
  casesPerLayer?: number
  layersPerPallet?: number
  casesPerPallet?: number
  eachsPerCase?: number
  isExpriy?: boolean
  isAttribute1?: boolean
  isAttribute2?: boolean
  expiryDate?: string
  attribute1?: string
  attribute2?: string
}

type Customer = {
  id: number
  customer_name: string
}

type StorageUnit = {
  id: number
  name: string
  palletSpaces?: number
}

type HandlingUnit = {
  id: number
  name: string
}

type TenantUser = {
  id?: number | string
  role?: number | string | { id: number; permissions?: Record<string, boolean> }
  [key: string]: unknown
}

export default function SKUsPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)
  const [currentUser, setCurrentUser] = useState<TenantUser | null>(null)
  const [skus, setSkus] = useState<SKU[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [storageUnits, setStorageUnits] = useState<StorageUnit[]>([])
  const [handlingUnits, setHandlingUnits] = useState<HandlingUnit[]>([])
  const [loadingSkus, setLoadingSkus] = useState(false)
  const [loadingRelations, setLoadingRelations] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingSku, setEditingSku] = useState<SKU | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Quick-create modal states
  const [showQuickCreateCustomer, setShowQuickCreateCustomer] = useState(false)
  const [showQuickCreateStorageUnit, setShowQuickCreateStorageUnit] = useState(false)
  const [showQuickCreateHandlingUnit, setShowQuickCreateHandlingUnit] = useState(false)
  const [quickCreateData, setQuickCreateData] = useState({
    name: '',
    abbreviation: '',
    palletSpaces: '',
    lengthPerSU_mm: '',
    widthPerSU_mm: '',
    whstoChargeBy: '',
  })

  // Pagination state
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [totalDocs, setTotalDocs] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [hasPrevPage, setHasPrevPage] = useState(false)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [formData, setFormData] = useState({
    skuCode: '',
    description: '',
    customerId: '',
    storageUnitId: '',
    handlingUnitId: '',
    huPerSu: '',
    receiveHU: '',
    pickHU: '',
    pickStrategy: '',
    lengthPerHU_mm: '',
    widthPerHU_mm: '',
    heightPerHU_mm: '',
    weightPerHU_kg: '',
    casesPerLayer: '',
    layersPerPallet: '',
    casesPerPallet: '',
    eachsPerCase: '',
    isExpriy: false,
    isAttribute1: false,
    isAttribute2: false,
    expiryDate: '',
    attribute1: '',
    attribute2: '',
  })

  // Track which fields were auto-calculated to allow manual override
  const [autoCalculatedFields, setAutoCalculatedFields] = useState<Set<string>>(new Set())
  const autoCalculatedFieldsRef = useRef<Set<string>>(new Set())

  // Keep ref in sync with state
  useEffect(() => {
    autoCalculatedFieldsRef.current = autoCalculatedFields
  }, [autoCalculatedFields])

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
      loadSKUs()
      loadRelations()
    }
  }, [authChecked, page, limit, searchQuery])

  // Auto-calculate casesPerPallet when casesPerLayer or layersPerPallet changes
  useEffect(() => {
    const casesPerLayer = formData.casesPerLayer ? Number(formData.casesPerLayer) : null
    const layersPerPallet = formData.layersPerPallet ? Number(formData.layersPerPallet) : null
    const isAutoCalculated = autoCalculatedFieldsRef.current.has('casesPerPallet')

    // Only auto-calculate if both values are available and valid
    if (
      casesPerLayer !== null &&
      layersPerPallet !== null &&
      casesPerLayer > 0 &&
      layersPerPallet > 0
    ) {
      // Only update if field is empty or was previously auto-calculated
      if (!formData.casesPerPallet || isAutoCalculated) {
        const calculated = casesPerLayer * layersPerPallet
        setFormData((prev) => ({ ...prev, casesPerPallet: String(calculated) }))
        setAutoCalculatedFields((prev) => new Set(prev).add('casesPerPallet'))
      }
    } else if (formData.casesPerPallet && isAutoCalculated) {
      // Clear if dependencies are removed
      setFormData((prev) => ({ ...prev, casesPerPallet: '' }))
      setAutoCalculatedFields((prev) => {
        const newSet = new Set(prev)
        newSet.delete('casesPerPallet')
        return newSet
      })
    }
  }, [formData.casesPerLayer, formData.layersPerPallet, formData.casesPerPallet])

  // Auto-calculate layersPerPallet when huPerSu and casesPerLayer are both available
  useEffect(() => {
    const huPerSu = formData.huPerSu ? Number(formData.huPerSu) : null
    const casesPerLayer = formData.casesPerLayer ? Number(formData.casesPerLayer) : null
    const isAutoCalculated = autoCalculatedFieldsRef.current.has('layersPerPallet')

    // Only auto-calculate if both values are available and valid
    if (huPerSu !== null && casesPerLayer !== null && huPerSu > 0 && casesPerLayer > 0) {
      // Only update if field is empty or was previously auto-calculated
      if (!formData.layersPerPallet || isAutoCalculated) {
        const calculated = Math.floor(huPerSu / casesPerLayer)
        if (calculated > 0) {
          setFormData((prev) => ({ ...prev, layersPerPallet: String(calculated) }))
          setAutoCalculatedFields((prev) => new Set(prev).add('layersPerPallet'))
        }
      }
    } else if (formData.layersPerPallet && isAutoCalculated) {
      // Clear if dependencies are removed
      setFormData((prev) => ({ ...prev, layersPerPallet: '' }))
      setAutoCalculatedFields((prev) => {
        const newSet = new Set(prev)
        newSet.delete('layersPerPallet')
        return newSet
      })
    }
  }, [formData.huPerSu, formData.casesPerLayer, formData.layersPerPallet])

  const loadRelations = async () => {
    try {
      setLoadingRelations(true)
      const [customersRes, storageRes, handlingRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/storage-units'),
        fetch('/api/handling-units'),
      ])

      if (customersRes.ok) {
        const data = await customersRes.json()
        if (data.success && data.customers) {
          setCustomers(data.customers)
        }
      }
      if (storageRes.ok) {
        const data = await storageRes.json()
        if (data.success && data.storageUnits) {
          setStorageUnits(data.storageUnits)
        }
      }
      if (handlingRes.ok) {
        const data = await handlingRes.json()
        if (data.success && data.handlingUnits) {
          setHandlingUnits(data.handlingUnits)
        }
      }
    } catch (error) {
      console.error('Error loading relations:', error)
    } finally {
      setLoadingRelations(false)
    }
  }

  const loadSKUs = async () => {
    try {
      setLoadingSkus(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        depth: '1',
        ...(searchQuery && { search: searchQuery }),
      })
      const res = await fetch(`/api/skus?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.skus) {
          setSkus(data.skus)
          setTotalDocs(data.totalDocs || 0)
          setTotalPages(data.totalPages || 0)
          setHasPrevPage(data.hasPrevPage || false)
          setHasNextPage(data.hasNextPage || false)
        }
      }
    } catch (error) {
      console.error('Error loading SKUs:', error)
    } finally {
      setLoadingSkus(false)
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

  // Quick-create handlers
  const handleQuickCreateCustomer = async () => {
    if (!quickCreateData.name) {
      setError('Customer name is required')
      return
    }
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: quickCreateData.name }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.customer) {
          await loadRelations()
          setFormData({ ...formData, customerId: String(data.customer.id) })
          setShowQuickCreateCustomer(false)
          setQuickCreateData({
            name: '',
            abbreviation: '',
            palletSpaces: '',
            lengthPerSU_mm: '',
            widthPerSU_mm: '',
            whstoChargeBy: '',
          })
          setSuccess('Customer created successfully')
        }
      } else {
        const errorData = await res.json()
        setError(errorData.message || 'Failed to create customer')
      }
    } catch (error) {
      console.error('Error creating customer:', error)
      setError('Failed to create customer')
    }
  }

  const handleQuickCreateStorageUnit = async () => {
    if (!quickCreateData.name) {
      setError('Storage unit name is required')
      return
    }
    try {
      const res = await fetch('/api/storage-units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickCreateData.name,
          abbreviation: quickCreateData.abbreviation || undefined,
          palletSpaces: quickCreateData.palletSpaces
            ? Number(quickCreateData.palletSpaces)
            : undefined,
          lengthPerSU_mm: quickCreateData.lengthPerSU_mm
            ? Number(quickCreateData.lengthPerSU_mm)
            : undefined,
          widthPerSU_mm: quickCreateData.widthPerSU_mm
            ? Number(quickCreateData.widthPerSU_mm)
            : undefined,
          whstoChargeBy: quickCreateData.whstoChargeBy || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.storageUnit) {
          await loadRelations()
          setFormData({ ...formData, storageUnitId: String(data.storageUnit.id) })
          setShowQuickCreateStorageUnit(false)
          setQuickCreateData({
            name: '',
            abbreviation: '',
            palletSpaces: '',
            lengthPerSU_mm: '',
            widthPerSU_mm: '',
            whstoChargeBy: '',
          })
          setSuccess('Storage unit created successfully')
        }
      } else {
        const errorData = await res.json()
        setError(errorData.message || 'Failed to create storage unit')
      }
    } catch (error) {
      console.error('Error creating storage unit:', error)
      setError('Failed to create storage unit')
    }
  }

  const handleQuickCreateHandlingUnit = async () => {
    if (!quickCreateData.name) {
      setError('Handling unit name is required')
      return
    }
    try {
      const res = await fetch('/api/handling-units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: quickCreateData.name,
          abbreviation: quickCreateData.abbreviation || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.handlingUnit) {
          await loadRelations()
          setFormData({ ...formData, handlingUnitId: String(data.handlingUnit.id) })
          setShowQuickCreateHandlingUnit(false)
          setQuickCreateData({
            name: '',
            abbreviation: '',
            palletSpaces: '',
            lengthPerSU_mm: '',
            widthPerSU_mm: '',
            whstoChargeBy: '',
          })
          setSuccess('Handling unit created successfully')
        }
      } else {
        const errorData = await res.json()
        setError(errorData.message || 'Failed to create handling unit')
      }
    } catch (error) {
      console.error('Error creating handling unit:', error)
      setError('Failed to create handling unit')
    }
  }

  const resetForm = () => {
    setFormData({
      skuCode: '',
      description: '',
      customerId: '',
      storageUnitId: '',
      handlingUnitId: '',
      huPerSu: '',
      receiveHU: '',
      pickHU: '',
      pickStrategy: '',
      lengthPerHU_mm: '',
      widthPerHU_mm: '',
      heightPerHU_mm: '',
      weightPerHU_kg: '',
      casesPerLayer: '',
      layersPerPallet: '',
      casesPerPallet: '',
      eachsPerCase: '',
      isExpriy: false,
      isAttribute1: false,
      isAttribute2: false,
      expiryDate: '',
      attribute1: '',
      attribute2: '',
    })
    setAutoCalculatedFields(new Set())
    setError(null)
    setSuccess(null)
  }

  const handleAddSku = () => {
    resetForm()
    setShowAddForm(true)
    setEditingSku(null)
  }

  const handleEditSku = (sku: SKU) => {
    const customerId =
      typeof sku.customerId === 'object' && sku.customerId && 'id' in sku.customerId
        ? String(sku.customerId.id)
        : sku.customerId
          ? String(sku.customerId)
          : ''

    const storageUnitId =
      typeof sku.storageUnitId === 'object' && sku.storageUnitId && 'id' in sku.storageUnitId
        ? String(sku.storageUnitId.id)
        : sku.storageUnitId
          ? String(sku.storageUnitId)
          : ''

    const handlingUnitId =
      typeof sku.handlingUnitId === 'object' && sku.handlingUnitId && 'id' in sku.handlingUnitId
        ? String(sku.handlingUnitId.id)
        : sku.handlingUnitId
          ? String(sku.handlingUnitId)
          : ''

    setFormData({
      skuCode: sku.skuCode || '',
      description: sku.description || '',
      customerId,
      storageUnitId,
      handlingUnitId,
      huPerSu: sku.huPerSu?.toString() || '',
      receiveHU: sku.receiveHU || '',
      pickHU: sku.pickHU || '',
      pickStrategy: sku.pickStrategy || '',
      lengthPerHU_mm: sku.lengthPerHU_mm?.toString() || '',
      widthPerHU_mm: sku.widthPerHU_mm?.toString() || '',
      heightPerHU_mm: sku.heightPerHU_mm?.toString() || '',
      weightPerHU_kg: sku.weightPerHU_kg?.toString() || '',
      casesPerLayer: sku.casesPerLayer?.toString() || '',
      layersPerPallet: sku.layersPerPallet?.toString() || '',
      casesPerPallet: sku.casesPerPallet?.toString() || '',
      eachsPerCase: sku.eachsPerCase?.toString() || '',
      isExpriy: sku.isExpriy || false,
      isAttribute1: sku.isAttribute1 || false,
      isAttribute2: sku.isAttribute2 || false,
      expiryDate: sku.expiryDate ? sku.expiryDate.split('T')[0] : '',
      attribute1: sku.attribute1 || '',
      attribute2: sku.attribute2 || '',
    })
    setEditingSku(sku)
    setShowAddForm(true)
    setError(null)
    setSuccess(null)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingSku(null)
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!formData.skuCode || !formData.storageUnitId || !formData.handlingUnitId) {
      setError('SKU code, Storage Unit, and Handling Unit are required')
      return
    }

    try {
      const submitData: Record<string, unknown> = {
        skuCode: formData.skuCode,
        description: formData.description || undefined,
        customerId: formData.customerId ? Number(formData.customerId) : undefined,
        storageUnitId: Number(formData.storageUnitId),
        handlingUnitId: Number(formData.handlingUnitId),
        huPerSu: formData.huPerSu ? Number(formData.huPerSu) : undefined,
        receiveHU: formData.receiveHU || undefined,
        pickHU: formData.pickHU || undefined,
        pickStrategy: formData.pickStrategy || undefined,
        lengthPerHU_mm: formData.lengthPerHU_mm ? Number(formData.lengthPerHU_mm) : undefined,
        widthPerHU_mm: formData.widthPerHU_mm ? Number(formData.widthPerHU_mm) : undefined,
        heightPerHU_mm: formData.heightPerHU_mm ? Number(formData.heightPerHU_mm) : undefined,
        weightPerHU_kg: formData.weightPerHU_kg ? Number(formData.weightPerHU_kg) : undefined,
        casesPerLayer: formData.casesPerLayer ? Number(formData.casesPerLayer) : undefined,
        layersPerPallet: formData.layersPerPallet ? Number(formData.layersPerPallet) : undefined,
        casesPerPallet: formData.casesPerPallet ? Number(formData.casesPerPallet) : undefined,
        eachsPerCase: formData.eachsPerCase ? Number(formData.eachsPerCase) : undefined,
        isExpriy: formData.isExpriy,
        isAttribute1: formData.isAttribute1,
        isAttribute2: formData.isAttribute2,
        expiryDate: formData.expiryDate || undefined,
        attribute1: formData.attribute1 || undefined,
        attribute2: formData.attribute2 || undefined,
      }

      if (editingSku) {
        const res = await fetch(`/api/skus/${editingSku.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitData),
        })

        if (res.ok) {
          setSuccess('SKU updated successfully')
          await loadSKUs()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const data = await res.json()
          setError(data.message || 'Failed to update SKU')
        }
      } else {
        const res = await fetch('/api/skus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitData),
        })

        if (res.ok) {
          setSuccess('SKU created successfully')
          await loadSKUs()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const data = await res.json()
          setError(data.message || 'Failed to create SKU')
        }
      }
    } catch (error) {
      console.error('Error saving SKU:', error)
      setError('An error occurred while saving the SKU')
    }
  }

  const handleDeleteSku = async (sku: SKU) => {
    if (
      !confirm(`Are you sure you want to delete SKU ${sku.skuCode}? This action cannot be undone.`)
    ) {
      return
    }

    try {
      const res = await fetch(`/api/skus/${sku.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setSuccess('SKU deleted successfully')
        await loadSKUs()
        setTimeout(() => setSuccess(null), 2000)
      } else {
        const data = await res.json()
        setError(data.message || 'Failed to delete SKU')
      }
    } catch (error) {
      console.error('Error deleting SKU:', error)
      setError('An error occurred while deleting the SKU')
    }
  }

  const getCustomerName = (customerId?: number | { id: number; customer_name?: string }) => {
    if (!customerId) return 'N/A'
    if (typeof customerId === 'object' && customerId && 'customer_name' in customerId) {
      return customerId.customer_name
    }
    const customer = customers.find(
      (c) => c.id === (typeof customerId === 'object' ? customerId.id : customerId),
    )
    return customer?.customer_name || 'N/A'
  }

  const getStorageUnitName = (storageUnitId?: number | { id: number; name?: string }) => {
    if (!storageUnitId) return 'N/A'
    if (typeof storageUnitId === 'object' && storageUnitId && 'name' in storageUnitId) {
      return storageUnitId.name
    }
    const unit = storageUnits.find(
      (u) => u.id === (typeof storageUnitId === 'object' ? storageUnitId.id : storageUnitId),
    )
    return unit?.name || 'N/A'
  }

  const getHandlingUnitName = (handlingUnitId?: number | { id: number; name?: string }) => {
    if (!handlingUnitId) return 'N/A'
    if (typeof handlingUnitId === 'object' && handlingUnitId && 'name' in handlingUnitId) {
      return handlingUnitId.name
    }
    const unit = handlingUnits.find(
      (u) => u.id === (typeof handlingUnitId === 'object' ? handlingUnitId.id : handlingUnitId),
    )
    return unit?.name || 'N/A'
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
          <h1 className="text-3xl font-bold">SKUs</h1>
          <p className="text-muted-foreground">Manage stock keeping units</p>
        </div>
        <Button onClick={handleAddSku} className="min-h-[44px]" size="icon" title="Add SKU">
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSku ? 'Edit SKU' : 'Add New SKU'}</DialogTitle>
            <DialogDescription>
              {editingSku ? 'Update SKU information' : 'Create a new SKU'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="skuCode">SKU Code *</Label>
                <Input
                  id="skuCode"
                  value={formData.skuCode}
                  onChange={(e) => setFormData({ ...formData, skuCode: e.target.value })}
                  required
                  placeholder="Unique SKU identifier"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="customerId">Customer</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowQuickCreateCustomer(true)}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    New
                  </Button>
                </div>
                <select
                  id="customerId"
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.customer_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="storageUnitId">Storage Unit *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowQuickCreateStorageUnit(true)}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    New
                  </Button>
                </div>
                <select
                  id="storageUnitId"
                  value={formData.storageUnitId}
                  onChange={(e) => setFormData({ ...formData, storageUnitId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  required
                >
                  <option value="">Select storage unit</option>
                  {storageUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="handlingUnitId">Handling Unit *</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowQuickCreateHandlingUnit(true)}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    New
                  </Button>
                </div>
                <select
                  id="handlingUnitId"
                  value={formData.handlingUnitId}
                  onChange={(e) => setFormData({ ...formData, handlingUnitId: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  required
                >
                  <option value="">Select handling unit</option>
                  {handlingUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  placeholder="Detailed product description"
                />
              </div>
              <div>
                <Label htmlFor="huPerSu">HU per SU</Label>
                <Input
                  id="huPerSu"
                  type="number"
                  step="0.01"
                  value={formData.huPerSu}
                  onChange={(e) => {
                    setFormData({ ...formData, huPerSu: e.target.value })
                    // Remove auto-calculated flag if user manually edits
                    if (autoCalculatedFields.has('layersPerPallet')) {
                      setAutoCalculatedFields((prev) => {
                        const newSet = new Set(prev)
                        newSet.delete('layersPerPallet')
                        return newSet
                      })
                    }
                  }}
                  placeholder="Number of handling units per storage unit"
                />
              </div>
              <div>
                <Label htmlFor="receiveHU">Receive HU</Label>
                <select
                  id="receiveHU"
                  value={formData.receiveHU}
                  onChange={(e) => setFormData({ ...formData, receiveHU: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                >
                  <option value="">Select option</option>
                  <option value="YES">YES</option>
                  <option value="NO">NO</option>
                </select>
              </div>
              <div>
                <Label htmlFor="pickHU">Pick HU</Label>
                <select
                  id="pickHU"
                  value={formData.pickHU}
                  onChange={(e) => setFormData({ ...formData, pickHU: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                >
                  <option value="">Select option</option>
                  <option value="YES">YES</option>
                  <option value="NO">NO</option>
                </select>
              </div>
              <div>
                <Label htmlFor="pickStrategy">Pick Strategy</Label>
                <select
                  id="pickStrategy"
                  value={formData.pickStrategy}
                  onChange={(e) => setFormData({ ...formData, pickStrategy: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                >
                  <option value="">Select strategy</option>
                  <option value="FIFO">FIFO</option>
                  <option value="FEFO">FEFO</option>
                </select>
              </div>
              <div>
                <Label htmlFor="lengthPerHU_mm">Length per HU (mm)</Label>
                <Input
                  id="lengthPerHU_mm"
                  type="number"
                  step="0.01"
                  value={formData.lengthPerHU_mm}
                  onChange={(e) => setFormData({ ...formData, lengthPerHU_mm: e.target.value })}
                  placeholder="Length in millimeters"
                />
              </div>
              <div>
                <Label htmlFor="widthPerHU_mm">Width per HU (mm)</Label>
                <Input
                  id="widthPerHU_mm"
                  type="number"
                  step="0.01"
                  value={formData.widthPerHU_mm}
                  onChange={(e) => setFormData({ ...formData, widthPerHU_mm: e.target.value })}
                  placeholder="Width in millimeters"
                />
              </div>
              <div>
                <Label htmlFor="heightPerHU_mm">Height per HU (mm)</Label>
                <Input
                  id="heightPerHU_mm"
                  type="number"
                  step="0.01"
                  value={formData.heightPerHU_mm}
                  onChange={(e) => setFormData({ ...formData, heightPerHU_mm: e.target.value })}
                  placeholder="Height in millimeters"
                />
              </div>
              <div>
                <Label htmlFor="weightPerHU_kg">Weight per HU (kg)</Label>
                <Input
                  id="weightPerHU_kg"
                  type="number"
                  step="0.01"
                  value={formData.weightPerHU_kg}
                  onChange={(e) => setFormData({ ...formData, weightPerHU_kg: e.target.value })}
                  placeholder="Weight in kilograms"
                />
              </div>
              <div>
                <Label htmlFor="casesPerLayer">Cases per Layer</Label>
                <Input
                  id="casesPerLayer"
                  type="number"
                  value={formData.casesPerLayer}
                  onChange={(e) => {
                    setFormData({ ...formData, casesPerLayer: e.target.value })
                    // Remove auto-calculated flag if user manually edits
                    if (
                      autoCalculatedFields.has('layersPerPallet') ||
                      autoCalculatedFields.has('casesPerPallet')
                    ) {
                      setAutoCalculatedFields((prev) => {
                        const newSet = new Set(prev)
                        newSet.delete('layersPerPallet')
                        newSet.delete('casesPerPallet')
                        return newSet
                      })
                    }
                  }}
                  placeholder="Number of cases"
                />
              </div>
              <div>
                <Label htmlFor="layersPerPallet">Layers per Pallet</Label>
                <Input
                  id="layersPerPallet"
                  type="number"
                  value={formData.layersPerPallet}
                  onChange={(e) => {
                    setFormData({ ...formData, layersPerPallet: e.target.value })
                    // Remove auto-calculated flag if user manually edits
                    if (autoCalculatedFields.has('layersPerPallet')) {
                      setAutoCalculatedFields((prev) => {
                        const newSet = new Set(prev)
                        newSet.delete('layersPerPallet')
                        return newSet
                      })
                    }
                    if (autoCalculatedFields.has('casesPerPallet')) {
                      setAutoCalculatedFields((prev) => {
                        const newSet = new Set(prev)
                        newSet.delete('casesPerPallet')
                        return newSet
                      })
                    }
                  }}
                  placeholder="Number of layers"
                />
              </div>
              <div>
                <Label htmlFor="casesPerPallet">Cases per Pallet</Label>
                <Input
                  id="casesPerPallet"
                  type="number"
                  value={formData.casesPerPallet}
                  onChange={(e) => {
                    setFormData({ ...formData, casesPerPallet: e.target.value })
                    // Remove auto-calculated flag if user manually edits
                    if (autoCalculatedFields.has('casesPerPallet')) {
                      setAutoCalculatedFields((prev) => {
                        const newSet = new Set(prev)
                        newSet.delete('casesPerPallet')
                        return newSet
                      })
                    }
                  }}
                  placeholder="Number of cases"
                />
              </div>
              <div>
                <Label htmlFor="eachsPerCase">Eachs per Case</Label>
                <Input
                  id="eachsPerCase"
                  type="number"
                  value={formData.eachsPerCase}
                  onChange={(e) => setFormData({ ...formData, eachsPerCase: e.target.value })}
                  placeholder="Number of units"
                />
              </div>
              <div className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <input
                    id="isExpriy"
                    type="checkbox"
                    checked={formData.isExpriy}
                    onChange={(e) => setFormData({ ...formData, isExpriy: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isExpriy">Enable Expiry Date</Label>
                </div>
              </div>
              {formData.isExpriy && (
                <div>
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  />
                </div>
              )}
              <div className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <input
                    id="isAttribute1"
                    type="checkbox"
                    checked={formData.isAttribute1}
                    onChange={(e) => setFormData({ ...formData, isAttribute1: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isAttribute1">Enable Attribute 1</Label>
                </div>
              </div>
              {formData.isAttribute1 && (
                <div className="md:col-span-2">
                  <Label htmlFor="attribute1">Attribute 1</Label>
                  <textarea
                    id="attribute1"
                    value={formData.attribute1}
                    onChange={(e) => setFormData({ ...formData, attribute1: e.target.value })}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                    placeholder="Extra notes"
                  />
                </div>
              )}
              <div className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <input
                    id="isAttribute2"
                    type="checkbox"
                    checked={formData.isAttribute2}
                    onChange={(e) => setFormData({ ...formData, isAttribute2: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isAttribute2">Enable Attribute 2</Label>
                </div>
              </div>
              {formData.isAttribute2 && (
                <div className="md:col-span-2">
                  <Label htmlFor="attribute2">Attribute 2</Label>
                  <textarea
                    id="attribute2"
                    value={formData.attribute2}
                    onChange={(e) => setFormData({ ...formData, attribute2: e.target.value })}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                    placeholder="Extra notes"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit">
                <Save className="h-4 w-4 mr-2" />
                {editingSku ? 'Update SKU' : 'Create SKU'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick-create Customer Modal */}
      {showQuickCreateCustomer && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowQuickCreateCustomer(false)
              setQuickCreateData({
                name: '',
                abbreviation: '',
                palletSpaces: '',
                lengthPerSU_mm: '',
                widthPerSU_mm: '',
                whstoChargeBy: '',
              })
            }
          }}
        >
          <Card className="relative w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <CardTitle>Quick Create Customer</CardTitle>
                  <CardDescription>Create a new customer quickly</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowQuickCreateCustomer(false)
                    setQuickCreateData({
                      name: '',
                      abbreviation: '',
                      palletSpaces: '',
                      lengthPerSU_mm: '',
                      widthPerSU_mm: '',
                      whstoChargeBy: '',
                    })
                  }}
                  className="flex-shrink-0 min-h-[44px] min-w-[44px]"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="quickCustomerName">Customer Name *</Label>
                  <Input
                    id="quickCustomerName"
                    value={quickCreateData.name}
                    onChange={(e) =>
                      setQuickCreateData({ ...quickCreateData, name: e.target.value })
                    }
                    placeholder="Customer name"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowQuickCreateCustomer(false)
                      setQuickCreateData({
                        name: '',
                        abbreviation: '',
                        palletSpaces: '',
                        lengthPerSU_mm: '',
                        widthPerSU_mm: '',
                        whstoChargeBy: '',
                      })
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleQuickCreateCustomer}>Create</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick-create Storage Unit Modal */}
      {showQuickCreateStorageUnit && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowQuickCreateStorageUnit(false)
              setQuickCreateData({
                name: '',
                abbreviation: '',
                palletSpaces: '',
                lengthPerSU_mm: '',
                widthPerSU_mm: '',
                whstoChargeBy: '',
              })
            }
          }}
        >
          <Card className="relative w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <CardTitle>Quick Create Storage Unit</CardTitle>
                  <CardDescription>Create a new storage unit quickly</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowQuickCreateStorageUnit(false)
                    setQuickCreateData({
                      name: '',
                      abbreviation: '',
                      palletSpaces: '',
                      lengthPerSU_mm: '',
                      widthPerSU_mm: '',
                      whstoChargeBy: '',
                    })
                  }}
                  className="flex-shrink-0 min-h-[44px] min-w-[44px]"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="quickStorageUnitName">Name *</Label>
                  <Input
                    id="quickStorageUnitName"
                    value={quickCreateData.name}
                    onChange={(e) =>
                      setQuickCreateData({ ...quickCreateData, name: e.target.value })
                    }
                    placeholder="Storage unit name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="quickStorageUnitAbbreviation">Abbreviation</Label>
                  <Input
                    id="quickStorageUnitAbbreviation"
                    value={quickCreateData.abbreviation}
                    onChange={(e) =>
                      setQuickCreateData({ ...quickCreateData, abbreviation: e.target.value })
                    }
                    placeholder="e.g. PAL"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowQuickCreateStorageUnit(false)
                      setQuickCreateData({
                        name: '',
                        abbreviation: '',
                        palletSpaces: '',
                        lengthPerSU_mm: '',
                        widthPerSU_mm: '',
                        whstoChargeBy: '',
                      })
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleQuickCreateStorageUnit}>Create</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick-create Handling Unit Modal */}
      {showQuickCreateHandlingUnit && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowQuickCreateHandlingUnit(false)
              setQuickCreateData({
                name: '',
                abbreviation: '',
                palletSpaces: '',
                lengthPerSU_mm: '',
                widthPerSU_mm: '',
                whstoChargeBy: '',
              })
            }
          }}
        >
          <Card className="relative w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <CardTitle>Quick Create Handling Unit</CardTitle>
                  <CardDescription>Create a new handling unit quickly</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowQuickCreateHandlingUnit(false)
                    setQuickCreateData({
                      name: '',
                      abbreviation: '',
                      palletSpaces: '',
                      lengthPerSU_mm: '',
                      widthPerSU_mm: '',
                      whstoChargeBy: '',
                    })
                  }}
                  className="flex-shrink-0 min-h-[44px] min-w-[44px]"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="quickHandlingUnitName">Name *</Label>
                  <Input
                    id="quickHandlingUnitName"
                    value={quickCreateData.name}
                    onChange={(e) =>
                      setQuickCreateData({ ...quickCreateData, name: e.target.value })
                    }
                    placeholder="Handling unit name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="quickHandlingUnitAbbreviation">Abbreviation</Label>
                  <Input
                    id="quickHandlingUnitAbbreviation"
                    value={quickCreateData.abbreviation}
                    onChange={(e) =>
                      setQuickCreateData({ ...quickCreateData, abbreviation: e.target.value })
                    }
                    placeholder="e.g. CTN"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowQuickCreateHandlingUnit(false)
                      setQuickCreateData({
                        name: '',
                        abbreviation: '',
                        palletSpaces: '',
                        lengthPerSU_mm: '',
                        widthPerSU_mm: '',
                        whstoChargeBy: '',
                      })
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleQuickCreateHandlingUnit}>Create</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Barcode className="h-5 w-5" />
                SKUs ({totalDocs})
              </CardTitle>
              <CardDescription>Manage stock keeping units</CardDescription>
            </div>
            <div className="relative max-w-sm w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search SKUs..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingSkus ? (
            <div className="text-center py-8 text-muted-foreground">Loading SKUs...</div>
          ) : skus.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No SKUs found matching your search' : 'No SKUs found'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {skus.map((sku) => (
                  <Card key={sku.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg font-semibold line-clamp-1 pr-2">
                          {sku.skuCode}
                        </CardTitle>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditSku(sku)}
                            className="h-8 w-8"
                            title="Edit SKU"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSku(sku)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Delete SKU"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        {sku.description && (
                          <div className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {sku.description}
                          </div>
                        )}
                        <div className="flex items-start gap-2">
                          <span className="font-medium min-w-[100px]">Customer:</span>
                          <span className="break-words">{getCustomerName(sku.customerId)}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-medium min-w-[100px]">Storage Unit:</span>
                          <span className="break-words">
                            {getStorageUnitName(sku.storageUnitId)}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-medium min-w-[100px]">Handling Unit:</span>
                          <span className="break-words">
                            {getHandlingUnitName(sku.handlingUnitId)}
                          </span>
                        </div>
                        {sku.palletSpacesOfStorageUnit && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[100px]">Pallet Spaces:</span>
                            <span>{sku.palletSpacesOfStorageUnit}</span>
                          </div>
                        )}
                        {sku.receiveHU && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[100px]">Receive HU:</span>
                            <span>{sku.receiveHU}</span>
                          </div>
                        )}
                        {sku.pickHU && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[100px]">Pick HU:</span>
                            <span>{sku.pickHU}</span>
                          </div>
                        )}
                        {sku.pickStrategy && (
                          <div className="flex items-start gap-2">
                            <span className="font-medium min-w-[100px]">Pick Strategy:</span>
                            <span>{sku.pickStrategy}</span>
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
                    Showing {skus.length > 0 ? (page - 1) * limit + 1 : 0} to{' '}
                    {Math.min(page * limit, totalDocs)} of {totalDocs} SKUs
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={!hasPrevPage || loadingSkus}
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
                            disabled={loadingSkus}
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
                      disabled={!hasNextPage || loadingSkus}
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
