'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FormInput, FormSelect, FormTextarea, FormCombobox } from '@/components/ui/form-field'

type SKU = {
  id: number
  skuCode: string
  description?: string
  huPerSu?: number
  weightPerHU_kg?: number
  storageUnitId?: number | { id: number }
  lengthPerHU_mm?: number
  widthPerHU_mm?: number
  heightPerHU_mm?: number
  isExpriy?: boolean
  isAttribute1?: boolean
  isAttribute2?: boolean
  expiryDate?: string
  attribute1?: string
  attribute2?: string
}

type ProductLine = {
  id?: number
  skuId?: number
  skuDescription?: string
  batchNumber?: string
  lpnQty?: string
  sqmPerSU?: number
  expectedQty?: number
  recievedQty?: number
  expectedWeight?: number
  recievedWeight?: number
  palletSpaces?: number
  weightPerHU?: number
  expectedCubicPerHU?: number
  recievedCubicPerHU?: number
  expiryDate?: string
  attribute1?: string
  attribute2?: string
}

// Helper to convert NaN/empty to undefined
const numberOrUndefined = z.preprocess((val) => {
  // Convert NaN, null, undefined, or empty string to undefined
  if (val === null || val === undefined || val === '') {
    return undefined
  }
  // Handle NaN
  if (typeof val === 'number' && (Number.isNaN(val) || !Number.isFinite(val))) {
    return undefined
  }
  // If it's already a valid number, return it
  if (typeof val === 'number') {
    return val
  }
  // If it's a string, try to parse it
  if (typeof val === 'string') {
    const parsed = parseFloat(val)
    return Number.isNaN(parsed) || !Number.isFinite(parsed) ? undefined : parsed
  }
  return undefined
}, z.number().optional())

const productLineSchema = z.object({
  skuId: z.number().min(1, 'SKU is required'),
  batchNumber: z.string().min(1, 'Batch number is required'),
  expectedQty: z.number().min(1, 'Expected quantity must be at least 1'),
  weightPerHU: numberOrUndefined,
  expectedWeight: numberOrUndefined,
  sqmPerSU: z.preprocess((val) => {
    if (val === null || val === undefined || val === '') {
      return undefined
    }
    if (typeof val === 'number' && (Number.isNaN(val) || !Number.isFinite(val))) {
      return undefined
    }
    if (typeof val === 'number') {
      return val
    }
    if (typeof val === 'string') {
      const parsed = parseFloat(val)
      return Number.isNaN(parsed) || !Number.isFinite(parsed) ? undefined : parsed
    }
    return undefined
  }, z.number().min(0, 'SQM per SU must be 0 or greater').optional()) as z.ZodType<
    number | undefined
  >,
  expectedCubicPerHU: z.preprocess((val) => {
    if (val === null || val === undefined || val === '') {
      return undefined
    }
    if (typeof val === 'number' && (Number.isNaN(val) || !Number.isFinite(val))) {
      return undefined
    }
    if (typeof val === 'number') {
      return val
    }
    if (typeof val === 'string') {
      const parsed = parseFloat(val)
      return Number.isNaN(parsed) || !Number.isFinite(parsed) ? undefined : parsed
    }
    return undefined
  }, z.number().min(0, 'Expected cubic per HU must be 0 or greater').optional()) as z.ZodType<
    number | undefined
  >,
  expiryDate: z.string().optional(),
  attribute1: z.string().optional(),
  attribute2: z.string().optional(),
})

type ProductLineFormData = z.infer<typeof productLineSchema>

interface ProductLineFormProps {
  inboundInventoryId: number
  initialData?: ProductLine
  onSave: (data: ProductLine) => Promise<void>
  onCancel: () => void
}

export function ProductLineForm({
  inboundInventoryId,
  initialData,
  onSave,
  onCancel,
}: ProductLineFormProps) {
  const [skus, setSkus] = useState<SKU[]>([])
  const [loading, setLoading] = useState(false)
  const [skuDescription, setSkuDescription] = useState<string>('')
  const [lpnQty, setLpnQty] = useState<string>('')
  const [palletSpaces, setPalletSpaces] = useState<number | undefined>()
  const [sqmPerSU, setSqmPerSU] = useState<number | undefined>()
  const [expectedCubicPerHU, setExpectedCubicPerHU] = useState<number | undefined>()
  const [selectedSku, setSelectedSku] = useState<SKU | null>(null)
  const [expiryDate, setExpiryDate] = useState<string>('')
  const [attribute1, setAttribute1] = useState<string>('')
  const [attribute2, setAttribute2] = useState<string>('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ProductLineFormData>({
    resolver: zodResolver(productLineSchema) as any,
    defaultValues: {
      skuId: initialData?.skuId,
      batchNumber: initialData?.batchNumber || '',
      expectedQty: initialData?.expectedQty,
      weightPerHU: initialData?.weightPerHU,
      expectedWeight: initialData?.expectedWeight,
      sqmPerSU: initialData?.sqmPerSU,
      expectedCubicPerHU: initialData?.expectedCubicPerHU,
      expiryDate: initialData?.expiryDate || '',
      attribute1: initialData?.attribute1 || '',
      attribute2: initialData?.attribute2 || '',
    },
  })

  const watchedExpectedQty = watch('expectedQty')
  const watchedLpnQty = lpnQty

  useEffect(() => {
    loadSKUs()
    if (initialData) {
      setSkuDescription(initialData.skuDescription || '')
      setLpnQty(initialData.lpnQty || '')
      setPalletSpaces(initialData.palletSpaces)
      setSqmPerSU(initialData.sqmPerSU)
      setExpectedCubicPerHU(initialData.expectedCubicPerHU)
      setExpiryDate(initialData.expiryDate || '')
      setAttribute1(initialData.attribute1 || '')
      setAttribute2(initialData.attribute2 || '')
      // Load SKU if we have skuId to get optional fields info
      if (initialData.skuId) {
        // Fetch SKU to check optional fields
        fetch(`/api/skus/${initialData.skuId}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.sku) {
              const sku = data.sku as SKU
              setSelectedSku(sku)
              // Set expiry/attributes if SKU has them and initialData doesn't
              if (sku.isExpriy && sku.expiryDate && !initialData.expiryDate) {
                setExpiryDate(sku.expiryDate)
                setValue('expiryDate', sku.expiryDate)
              }
              if (sku.isAttribute1 && sku.attribute1 && !initialData.attribute1) {
                setAttribute1(sku.attribute1)
                setValue('attribute1', sku.attribute1)
              }
              if (sku.isAttribute2 && sku.attribute2 && !initialData.attribute2) {
                setAttribute2(sku.attribute2)
                setValue('attribute2', sku.attribute2)
              }
            }
          })
          .catch((error) => console.error('Error fetching SKU:', error))
      }
    }
  }, [initialData])

  useEffect(() => {
    // Auto-calculate pallet spaces when expectedQty or lpnQty changes
    if (watchedExpectedQty && watchedLpnQty) {
      const lpnQtyNum = parseFloat(watchedLpnQty)
      if (lpnQtyNum > 0) {
        setPalletSpaces(watchedExpectedQty / lpnQtyNum)
      }
    }
  }, [watchedExpectedQty, watchedLpnQty])

  const loadSKUs = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/skus?limit=100')
      if (res.ok) {
        const data = await res.json()
        setSkus(data.skus || [])
      }
    } catch (error) {
      console.error('Error loading SKUs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSKUChange = async (skuId: number) => {
    setValue('skuId', skuId)

    // Auto-fetch SKU data
    try {
      const res = await fetch(`/api/skus/${skuId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.sku) {
          const sku = data.sku as SKU
          setSelectedSku(sku)
          setSkuDescription(sku.description || '')
          setLpnQty(sku.huPerSu?.toString() || '')
          setValue('weightPerHU', sku.weightPerHU_kg)

          // Auto-populate expiry, attribute1, attribute2 if SKU has them enabled
          if (sku.isExpriy && sku.expiryDate) {
            // Format date for input (YYYY-MM-DD)
            const dateStr =
              typeof sku.expiryDate === 'string'
                ? sku.expiryDate.split('T')[0]
                : new Date(sku.expiryDate).toISOString().split('T')[0]
            setExpiryDate(dateStr)
            setValue('expiryDate', dateStr)
          } else {
            setExpiryDate('')
            setValue('expiryDate', '')
          }
          if (sku.isAttribute1 && sku.attribute1) {
            setAttribute1(sku.attribute1)
            setValue('attribute1', sku.attribute1)
          } else {
            setAttribute1('')
            setValue('attribute1', '')
          }
          if (sku.isAttribute2 && sku.attribute2) {
            setAttribute2(sku.attribute2)
            setValue('attribute2', sku.attribute2)
          } else {
            setAttribute2('')
            setValue('attribute2', '')
          }

          // Auto-calculate cubic from SKU dimensions (length × width × height in m³)
          if (
            sku.lengthPerHU_mm &&
            sku.widthPerHU_mm &&
            sku.heightPerHU_mm &&
            !Number.isNaN(sku.lengthPerHU_mm) &&
            !Number.isNaN(sku.widthPerHU_mm) &&
            !Number.isNaN(sku.heightPerHU_mm)
          ) {
            // Convert from mm³ to m³: divide by 1,000,000,000
            const cubicM3 =
              (sku.lengthPerHU_mm * sku.widthPerHU_mm * sku.heightPerHU_mm) / 1_000_000_000
            // Ensure the result is a valid number
            if (!Number.isNaN(cubicM3) && Number.isFinite(cubicM3)) {
              setExpectedCubicPerHU(cubicM3)
              setValue('expectedCubicPerHU', cubicM3)
            } else {
              setExpectedCubicPerHU(undefined)
              setValue('expectedCubicPerHU', undefined)
            }
          } else {
            setExpectedCubicPerHU(undefined)
            setValue('expectedCubicPerHU', undefined)
          }

          // Fetch Storage Unit to calculate SQM/SU
          const storageUnitId =
            typeof sku.storageUnitId === 'object' ? sku.storageUnitId.id : sku.storageUnitId

          if (storageUnitId) {
            try {
              const suRes = await fetch(`/api/storage-units/${storageUnitId}`)
              if (suRes.ok) {
                const suData = await suRes.json()
                if (suData.success && suData.storageUnit) {
                  const storageUnit = suData.storageUnit as {
                    lengthPerSU_mm?: number
                    widthPerSU_mm?: number
                  }

                  // Auto-calculate SQM/SU from Storage Unit dimensions (length × width in m²)
                  if (
                    storageUnit.lengthPerSU_mm &&
                    storageUnit.widthPerSU_mm &&
                    !Number.isNaN(storageUnit.lengthPerSU_mm) &&
                    !Number.isNaN(storageUnit.widthPerSU_mm)
                  ) {
                    // Convert from mm² to m²: divide by 1,000,000
                    const sqmPerSUValue =
                      (storageUnit.lengthPerSU_mm * storageUnit.widthPerSU_mm) / 1_000_000
                    // Ensure the result is a valid number
                    if (!Number.isNaN(sqmPerSUValue) && Number.isFinite(sqmPerSUValue)) {
                      setSqmPerSU(sqmPerSUValue)
                      setValue('sqmPerSU', sqmPerSUValue)
                    } else {
                      setSqmPerSU(undefined)
                      setValue('sqmPerSU', undefined)
                    }
                  } else {
                    setSqmPerSU(undefined)
                    setValue('sqmPerSU', undefined)
                  }
                }
              }
            } catch (error) {
              console.error('Error fetching Storage Unit:', error)
              setSqmPerSU(undefined)
              setValue('sqmPerSU', undefined)
            }
          } else {
            setSqmPerSU(undefined)
            setValue('sqmPerSU', undefined)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching SKU:', error)
    }
  }

  const onSubmit = async (data: ProductLineFormData) => {
    await onSave({
      ...data,
      skuDescription,
      lpnQty,
      palletSpaces,
      sqmPerSU,
      expectedCubicPerHU,
      expiryDate: selectedSku?.isExpriy ? data.expiryDate : undefined,
      attribute1: selectedSku?.isAttribute1 ? data.attribute1 : undefined,
      attribute2: selectedSku?.isAttribute2 ? data.attribute2 : undefined,
    } as ProductLine)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
      <FormCombobox
        label="SKU"
        required
        error={errors.skuId?.message}
        options={skus.map((sku) => ({
          value: sku.id,
          label: `${sku.skuCode} - ${sku.description || ''}`,
        }))}
        placeholder="Select SKU..."
        value={watch('skuId')}
        onValueChange={(value) => {
          if (value === undefined) {
            // For required fields, we don't clear the value but reset related state
            // The form validation will handle the required check
            setSelectedSku(null)
            setSkuDescription('')
            return
          }
          const skuId = typeof value === 'number' ? value : parseInt(value.toString())
          setValue('skuId', skuId)
          handleSKUChange(skuId)
        }}
      />

      <FormInput label="SKU Description" value={skuDescription} readOnly className="bg-muted" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput label="LPN Qty (HU per SU)" value={lpnQty} readOnly className="bg-muted" />
        <FormInput
          label="Weight per HU (kg) (optional)"
          type="number"
          step="0.01"
          min="0"
          error={errors.weightPerHU?.message}
          placeholder="Enter weight per HU"
          {...register('weightPerHU', {
            valueAsNumber: true,
            setValueAs: (v) => {
              if (
                v === '' ||
                v === null ||
                v === undefined ||
                (typeof v === 'number' && Number.isNaN(v))
              ) {
                return undefined
              }
              return typeof v === 'string' ? parseFloat(v) : v
            },
          })}
        />
      </div>

      <FormInput
        label="Batch Number"
        required
        error={errors.batchNumber?.message}
        placeholder="Enter batch number"
        {...register('batchNumber')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput
          label="Expected Quantity"
          type="number"
          min="1"
          required
          error={errors.expectedQty?.message}
          placeholder="Enter expected quantity"
          {...register('expectedQty', { valueAsNumber: true })}
        />
        <FormInput
          label="Pallet Spaces (auto-calculated)"
          value={palletSpaces?.toFixed(2) || '0'}
          readOnly
          className="bg-muted"
        />
      </div>

      <FormInput
        label="Expected Weight (optional)"
        type="number"
        min="0"
        step="0.01"
        error={errors.expectedWeight?.message}
        placeholder="Enter expected weight"
        {...register('expectedWeight', {
          valueAsNumber: true,
          setValueAs: (v) => {
            if (
              v === '' ||
              v === null ||
              v === undefined ||
              (typeof v === 'number' && Number.isNaN(v))
            ) {
              return undefined
            }
            return typeof v === 'string' ? parseFloat(v) : v
          },
        })}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput
          label="SQM/SU (auto-calculated)"
          value={sqmPerSU?.toFixed(4) || ''}
          readOnly
          className="bg-muted"
        />
        <FormInput
          label="Expected Cubic per HU (m³) (auto-calculated)"
          value={expectedCubicPerHU?.toFixed(6) || ''}
          readOnly
          className="bg-muted"
        />
      </div>

      {/* Optional fields from SKU - only show if SKU has them enabled, auto-populated and non-editable */}
      {selectedSku?.isExpriy && (
        <FormInput
          label="Expiry Date"
          type="date"
          value={expiryDate}
          readOnly
          className="bg-muted"
        />
      )}

      {selectedSku?.isAttribute1 && (
        <FormTextarea label="Attribute 1" value={attribute1} readOnly className="bg-muted" />
      )}

      {selectedSku?.isAttribute2 && (
        <FormTextarea label="Attribute 2" value={attribute2} readOnly className="bg-muted" />
      )}

      <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button type="submit" className="w-full sm:w-auto">
          Save Product Line
        </Button>
      </div>
    </form>
  )
}
