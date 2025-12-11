'use client'

import { useEffect, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FormInput, FormSelect, FormTextarea } from '@/components/ui/form-field'
import { Label } from '@/components/ui/label'
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
  const [_currentUser, setCurrentUser] = useState<TenantUser | null>(null)
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
  const [limit] = useState(20)
  const [totalDocs, setTotalDocs] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [hasPrevPage, setHasPrevPage] = useState(false)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const skuSchema = z.object({
    skuCode: z.string().min(1, 'SKU code is required'),
    description: z.string().optional(),
    customerId: z.string().optional(),
    storageUnitId: z.string().min(1, 'Storage Unit is required'),
    handlingUnitId: z.string().min(1, 'Handling Unit is required'),
    huPerSu: z.string().optional(),
    receiveHU: z.string().optional(),
    pickHU: z.string().optional(),
    pickStrategy: z.string().optional(),
    lengthPerHU_mm: z.string().optional(),
    widthPerHU_mm: z.string().optional(),
    heightPerHU_mm: z.string().optional(),
    weightPerHU_kg: z.string().optional(),
    casesPerLayer: z.string().optional(),
    layersPerPallet: z.string().optional(),
    casesPerPallet: z.string().optional(),
    eachsPerCase: z.string().optional(),
    isExpriy: z.boolean(),
    isAttribute1: z.boolean(),
    isAttribute2: z.boolean(),
    expiryDate: z.string().optional(),
    attribute1: z.string().optional(),
    attribute2: z.string().optional(),
  })

  type SKUFormData = z.infer<typeof skuSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<SKUFormData>({
    resolver: zodResolver(skuSchema),
    defaultValues: {
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
    },
  })

  // Track which fields were auto-calculated to allow manual override
  const [autoCalculatedFields, setAutoCalculatedFields] = useState<Set<string>>(new Set())
  const autoCalculatedFieldsRef = useRef<Set<string>>(new Set())

  // Keep ref in sync with state
  useEffect(() => {
    autoCalculatedFieldsRef.current = autoCalculatedFields
  }, [autoCalculatedFields])

  // Watch form values for auto-calculation
  const watchedCasesPerLayer = watch('casesPerLayer')
  const watchedLayersPerPallet = watch('layersPerPallet')
  const watchedHuPerSu = watch('huPerSu')
  const watchedCasesPerPallet = watch('casesPerPallet')
  const watchedIsExpriy = watch('isExpriy')
  const watchedIsAttribute1 = watch('isAttribute1')
  const watchedIsAttribute2 = watch('isAttribute2')

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
      loadSKUs()
      loadRelations()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, page, limit, searchQuery])

  // Auto-calculate casesPerPallet when casesPerLayer or layersPerPallet changes
  useEffect(() => {
    const casesPerLayer = watchedCasesPerLayer ? Number(watchedCasesPerLayer) : null
    const layersPerPallet = watchedLayersPerPallet ? Number(watchedLayersPerPallet) : null
    const isAutoCalculated = autoCalculatedFieldsRef.current.has('casesPerPallet')

    // Only auto-calculate if both values are available and valid
    if (
      casesPerLayer !== null &&
      layersPerPallet !== null &&
      casesPerLayer > 0 &&
      layersPerPallet > 0
    ) {
      // Only update if field is empty or was previously auto-calculated
      if (!watchedCasesPerPallet || isAutoCalculated) {
        const calculated = casesPerLayer * layersPerPallet
        setValue('casesPerPallet', String(calculated), { shouldValidate: false })
        setAutoCalculatedFields((prev) => new Set(prev).add('casesPerPallet'))
      }
    } else if (watchedCasesPerPallet && isAutoCalculated) {
      // Clear if dependencies are removed
      setValue('casesPerPallet', '', { shouldValidate: false })
      setAutoCalculatedFields((prev) => {
        const newSet = new Set(prev)
        newSet.delete('casesPerPallet')
        return newSet
      })
    }
  }, [watchedCasesPerLayer, watchedLayersPerPallet, watchedCasesPerPallet, setValue])

  // Auto-calculate layersPerPallet when huPerSu and casesPerLayer are both available
  useEffect(() => {
    const huPerSu = watchedHuPerSu ? Number(watchedHuPerSu) : null
    const casesPerLayer = watchedCasesPerLayer ? Number(watchedCasesPerLayer) : null
    const isAutoCalculated = autoCalculatedFieldsRef.current.has('layersPerPallet')

    // Only auto-calculate if both values are available and valid
    if (huPerSu !== null && casesPerLayer !== null && huPerSu > 0 && casesPerLayer > 0) {
      // Only update if field is empty or was previously auto-calculated
      if (!watchedLayersPerPallet || isAutoCalculated) {
        const calculated = Math.floor(huPerSu / casesPerLayer)
        if (calculated > 0) {
          setValue('layersPerPallet', String(calculated), { shouldValidate: false })
          setAutoCalculatedFields((prev) => new Set(prev).add('layersPerPallet'))
        }
      }
    } else if (watchedLayersPerPallet && isAutoCalculated) {
      // Clear if dependencies are removed
      setValue('layersPerPallet', '', { shouldValidate: false })
      setAutoCalculatedFields((prev) => {
        const newSet = new Set(prev)
        newSet.delete('layersPerPallet')
        return newSet
      })
    }
  }, [watchedHuPerSu, watchedCasesPerLayer, watchedLayersPerPallet, setValue])

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
          setValue('customerId', String(data.customer.id))
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
          setValue('storageUnitId', String(data.storageUnit.id))
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
          setValue('handlingUnitId', String(data.handlingUnit.id))
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
    reset({
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

    reset({
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

  const onSubmit = async (data: SKUFormData) => {
    setError(null)
    setSuccess(null)

    try {
      const submitData: Record<string, unknown> = {
        skuCode: data.skuCode,
        description: data.description || undefined,
        customerId: data.customerId ? Number(data.customerId) : undefined,
        storageUnitId: Number(data.storageUnitId),
        handlingUnitId: Number(data.handlingUnitId),
        huPerSu: data.huPerSu ? Number(data.huPerSu) : undefined,
        receiveHU: data.receiveHU || undefined,
        pickHU: data.pickHU || undefined,
        pickStrategy: data.pickStrategy || undefined,
        lengthPerHU_mm: data.lengthPerHU_mm ? Number(data.lengthPerHU_mm) : undefined,
        widthPerHU_mm: data.widthPerHU_mm ? Number(data.widthPerHU_mm) : undefined,
        heightPerHU_mm: data.heightPerHU_mm ? Number(data.heightPerHU_mm) : undefined,
        weightPerHU_kg: data.weightPerHU_kg ? Number(data.weightPerHU_kg) : undefined,
        casesPerLayer: data.casesPerLayer ? Number(data.casesPerLayer) : undefined,
        layersPerPallet: data.layersPerPallet ? Number(data.layersPerPallet) : undefined,
        casesPerPallet: data.casesPerPallet ? Number(data.casesPerPallet) : undefined,
        eachsPerCase: data.eachsPerCase ? Number(data.eachsPerCase) : undefined,
        isExpriy: data.isExpriy,
        isAttribute1: data.isAttribute1,
        isAttribute2: data.isAttribute2,
        expiryDate: data.expiryDate || undefined,
        attribute1: data.attribute1 || undefined,
        attribute2: data.attribute2 || undefined,
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
          const responseData = await res.json()
          setError(responseData.message || 'Failed to update SKU')
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
          const responseData = await res.json()
          setError(responseData.message || 'Failed to create SKU')
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="SKU Code"
                required
                error={errors.skuCode?.message}
                placeholder="Unique SKU identifier"
                {...register('skuCode')}
              />
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
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
                <FormSelect
                  label=""
                  placeholder="Select customer"
                  options={customers.map((c) => ({ value: String(c.id), label: c.customer_name }))}
                  error={errors.customerId?.message}
                  {...register('customerId')}
                  containerClassName="mb-0"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
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
                <FormSelect
                  label=""
                  required
                  placeholder="Select storage unit"
                  options={storageUnits.map((u) => ({ value: String(u.id), label: u.name }))}
                  error={errors.storageUnitId?.message}
                  {...register('storageUnitId')}
                  containerClassName="mb-0"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
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
                <FormSelect
                  label=""
                  required
                  placeholder="Select handling unit"
                  options={handlingUnits.map((u) => ({ value: String(u.id), label: u.name }))}
                  error={errors.handlingUnitId?.message}
                  {...register('handlingUnitId')}
                  containerClassName="mb-0"
                />
              </div>
              <div className="md:col-span-2">
                <FormTextarea
                  label="Description"
                  error={errors.description?.message}
                  placeholder="Detailed product description"
                  {...register('description')}
                />
              </div>
              <FormInput
                label="HU per SU"
                type="number"
                step="0.01"
                error={errors.huPerSu?.message}
                placeholder="Number of handling units per storage unit"
                {...register('huPerSu', {
                  onChange: () => {
                    if (autoCalculatedFields.has('layersPerPallet')) {
                      setAutoCalculatedFields((prev) => {
                        const newSet = new Set(prev)
                        newSet.delete('layersPerPallet')
                        return newSet
                      })
                    }
                  },
                })}
              />
              <FormSelect
                label="Receive HU"
                placeholder="Select option"
                options={[
                  { value: 'YES', label: 'YES' },
                  { value: 'NO', label: 'NO' },
                ]}
                error={errors.receiveHU?.message}
                {...register('receiveHU')}
              />
              <FormSelect
                label="Pick HU"
                placeholder="Select option"
                options={[
                  { value: 'YES', label: 'YES' },
                  { value: 'NO', label: 'NO' },
                ]}
                error={errors.pickHU?.message}
                {...register('pickHU')}
              />
              <FormSelect
                label="Pick Strategy"
                placeholder="Select strategy"
                options={[
                  { value: 'FIFO', label: 'FIFO' },
                  { value: 'FEFO', label: 'FEFO' },
                ]}
                error={errors.pickStrategy?.message}
                {...register('pickStrategy')}
              />
              <FormInput
                label="Length per HU (mm)"
                type="number"
                step="0.01"
                error={errors.lengthPerHU_mm?.message}
                placeholder="Length in millimeters"
                {...register('lengthPerHU_mm')}
              />
              <FormInput
                label="Width per HU (mm)"
                type="number"
                step="0.01"
                error={errors.widthPerHU_mm?.message}
                placeholder="Width in millimeters"
                {...register('widthPerHU_mm')}
              />
              <FormInput
                label="Height per HU (mm)"
                type="number"
                step="0.01"
                error={errors.heightPerHU_mm?.message}
                placeholder="Height in millimeters"
                {...register('heightPerHU_mm')}
              />
              <FormInput
                label="Weight per HU (kg)"
                type="number"
                step="0.01"
                error={errors.weightPerHU_kg?.message}
                placeholder="Weight in kilograms"
                {...register('weightPerHU_kg')}
              />
              <FormInput
                label="Cases per Layer"
                type="number"
                error={errors.casesPerLayer?.message}
                placeholder="Number of cases"
                {...register('casesPerLayer', {
                  onChange: () => {
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
                  },
                })}
              />
              <FormInput
                label="Layers per Pallet"
                type="number"
                error={errors.layersPerPallet?.message}
                placeholder="Number of layers"
                {...register('layersPerPallet', {
                  onChange: () => {
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
                  },
                })}
              />
              <FormInput
                label="Cases per Pallet"
                type="number"
                error={errors.casesPerPallet?.message}
                placeholder="Number of cases"
                {...register('casesPerPallet', {
                  onChange: () => {
                    if (autoCalculatedFields.has('casesPerPallet')) {
                      setAutoCalculatedFields((prev) => {
                        const newSet = new Set(prev)
                        newSet.delete('casesPerPallet')
                        return newSet
                      })
                    }
                  },
                })}
              />
              <FormInput
                label="Eachs per Case"
                type="number"
                error={errors.eachsPerCase?.message}
                placeholder="Number of units"
                {...register('eachsPerCase')}
              />
              <div className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <input
                    id="isExpriy"
                    type="checkbox"
                    {...register('isExpriy')}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isExpriy">Enable Expiry Date</Label>
                </div>
              </div>
              {watchedIsExpriy && (
                <FormInput
                  label="Expiry Date"
                  type="date"
                  error={errors.expiryDate?.message}
                  {...register('expiryDate')}
                />
              )}
              <div className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <input
                    id="isAttribute1"
                    type="checkbox"
                    {...register('isAttribute1')}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isAttribute1">Enable Attribute 1</Label>
                </div>
              </div>
              {watchedIsAttribute1 && (
                <div className="md:col-span-2">
                  <FormTextarea
                    label="Attribute 1"
                    error={errors.attribute1?.message}
                    placeholder="Extra notes"
                    {...register('attribute1')}
                  />
                </div>
              )}
              <div className="md:col-span-2">
                <div className="flex items-center gap-2">
                  <input
                    id="isAttribute2"
                    type="checkbox"
                    {...register('isAttribute2')}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isAttribute2">Enable Attribute 2</Label>
                </div>
              </div>
              {watchedIsAttribute2 && (
                <div className="md:col-span-2">
                  <FormTextarea
                    label="Attribute 2"
                    error={errors.attribute2?.message}
                    placeholder="Extra notes"
                    {...register('attribute2')}
                  />
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
                  className="shrink-0 min-h-[44px] min-w-[44px]"
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
                  className="shrink-0 min-h-[44px] min-w-[44px]"
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
                  className="shrink-0 min-h-[44px] min-w-[44px]"
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
                        <div className="flex gap-1 shrink-0">
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
                          <span className="wrap-break-word">{getCustomerName(sku.customerId)}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-medium min-w-[100px]">Storage Unit:</span>
                          <span className="wrap-break-word">
                            {getStorageUnitName(sku.storageUnitId)}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="font-medium min-w-[100px]">Handling Unit:</span>
                          <span className="wrap-break-word">
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
