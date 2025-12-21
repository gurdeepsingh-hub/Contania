'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FormInput, FormTextarea, FormCombobox } from '@/components/ui/form-field'

type SKU = {
  id: number
  skuCode: string
  description?: string
  huPerSu?: number
  weightPerHU_kg?: number
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

type OutboundProductLine = {
  id?: number
  skuId?: number
  skuDescription?: string
  batchNumber?: string
  requiredQty?: number
  allocatedQty?: number
  requiredWeight?: number
  allocatedWeight?: number
  requiredCubicPerHU?: number
  containerNumber?: string
  location?: string
  expiry?: string
  attribute1?: string
  attribute2?: string
}

const productLineSchema = z.object({
  skuId: z.number().min(1, 'SKU is required'),
  batchNumber: z.string().min(1, 'Batch number is required'),
  requiredQty: z.number().min(1, 'Required quantity must be at least 1').optional(),
  requiredWeight: z.number().min(0, 'Required weight must be 0 or greater').optional(),
  requiredCubicPerHU: z.number().min(0, 'Required cubic per HU must be 0 or greater').optional(),
  containerNumber: z.string().optional(),
})

type ProductLineFormData = z.infer<typeof productLineSchema>

interface OutboundProductLineFormProps {
  outboundInventoryId: number
  warehouseId?: number
  initialData?: OutboundProductLine
  onSave: (data: OutboundProductLine) => Promise<void>
  onCancel: () => void
}

type BatchOption = {
  batchNumber: string
  skuId: number | { id: number; skuCode?: string; description?: string }
  skuDescription?: string
}

export function OutboundProductLineForm({
  outboundInventoryId: _outboundInventoryId,
  warehouseId,
  initialData,
  onSave,
  onCancel,
}: OutboundProductLineFormProps) {
  const [batchOptions, setBatchOptions] = useState<BatchOption[]>([])
  const [_loading, setLoading] = useState(false)
  const [loadingBatches, setLoadingBatches] = useState(false)
  const [skuDescription, setSkuDescription] = useState<string>('')
  const [selectedSku, setSelectedSku] = useState<SKU | null>(null)
  const [expiryDate, setExpiryDate] = useState<string>('')
  const [attribute1, setAttribute1] = useState<string>('')
  const [attribute2, setAttribute2] = useState<string>('')
  const [requiredCubicPerHU, setRequiredCubicPerHU] = useState<number | undefined>()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ProductLineFormData>({
    resolver: zodResolver(productLineSchema),
    defaultValues: {
      skuId: initialData?.skuId,
      batchNumber: initialData?.batchNumber || '',
      requiredQty: initialData?.requiredQty,
      requiredWeight: initialData?.requiredWeight,
      requiredCubicPerHU: initialData?.requiredCubicPerHU,
      containerNumber: initialData?.containerNumber || '',
    },
  })

  const loadBatchOptions = useCallback(async () => {
    if (!warehouseId) return

    setLoadingBatches(true)
    try {
      const res = await fetch(`/api/batches?warehouseId=${warehouseId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.batches) {
          setBatchOptions(data.batches)
        }
      }
    } catch (error) {
      console.error('Error loading batches:', error)
    } finally {
      setLoadingBatches(false)
    }
  }, [warehouseId])

  const handleBatchChange = useCallback(
    async (batchNumber: string, skuId?: number) => {
      setValue('batchNumber', batchNumber)

      // Find the batch to get SKU ID if not provided
      const batch = batchOptions.find((b) => b.batchNumber === batchNumber)
      if (!batch) return

      const batchSkuId = skuId || (typeof batch.skuId === 'object' ? batch.skuId.id : batch.skuId)
      if (!batchSkuId) return

      // Set SKU ID
      setValue('skuId', batchSkuId)

      // Auto-fetch SKU data from batch
      try {
        const res = await fetch(`/api/skus/${batchSkuId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.sku) {
            const sku = data.sku as SKU
            setSelectedSku(sku)
            setSkuDescription(sku.description || '')

            // Auto-populate expiry, attribute1, attribute2 if SKU has them enabled
            if (sku.isExpriy && sku.expiryDate) {
              // Format date for input (YYYY-MM-DD)
              const dateStr =
                typeof sku.expiryDate === 'string'
                  ? sku.expiryDate.split('T')[0]
                  : new Date(sku.expiryDate).toISOString().split('T')[0]
              setExpiryDate(dateStr)
            } else {
              setExpiryDate('')
            }
            if (sku.isAttribute1 && sku.attribute1) {
              setAttribute1(sku.attribute1)
            } else {
              setAttribute1('')
            }
            if (sku.isAttribute2 && sku.attribute2) {
              setAttribute2(sku.attribute2)
            } else {
              setAttribute2('')
            }

            // Auto-calculate cubic from SKU dimensions (length × width × height in m³)
            if (sku.lengthPerHU_mm && sku.widthPerHU_mm && sku.heightPerHU_mm) {
              // Convert from mm³ to m³: divide by 1,000,000,000
              const cubicM3 =
                (sku.lengthPerHU_mm * sku.widthPerHU_mm * sku.heightPerHU_mm) / 1_000_000_000
              setRequiredCubicPerHU(cubicM3)
              setValue('requiredCubicPerHU', cubicM3)
            } else {
              setRequiredCubicPerHU(undefined)
              setValue('requiredCubicPerHU', undefined)
            }
          }
        }
      } catch (error) {
        console.error('Error fetching SKU:', error)
      }
    },
    [batchOptions, setValue],
  )

  useEffect(() => {
    if (warehouseId) {
      loadBatchOptions()
    }
  }, [warehouseId, loadBatchOptions])

  useEffect(() => {
    if (initialData) {
      setSkuDescription(initialData.skuDescription || '')
      setRequiredCubicPerHU(initialData.requiredCubicPerHU)
      setExpiryDate(initialData.expiry || '')
      setAttribute1(initialData.attribute1 || '')
      setAttribute2(initialData.attribute2 || '')

      // If we have batch number and batches are loaded, fetch SKU from batch
      if (initialData.batchNumber && warehouseId && batchOptions.length > 0) {
        const batch = batchOptions.find((b) => b.batchNumber === initialData.batchNumber)
        if (batch) {
          const skuId = typeof batch.skuId === 'object' ? batch.skuId.id : batch.skuId
          if (skuId) {
            handleBatchChange(initialData.batchNumber, skuId)
          }
        }
      } else if (initialData.skuId) {
        // Fallback: Load SKU directly if we have skuId
        fetch(`/api/skus/${initialData.skuId}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.sku) {
              const sku = data.sku as SKU
              setSelectedSku(sku)
              if (sku.isExpriy && sku.expiryDate && !initialData.expiry) {
                setExpiryDate(sku.expiryDate)
              }
              if (sku.isAttribute1 && sku.attribute1 && !initialData.attribute1) {
                setAttribute1(sku.attribute1)
              }
              if (sku.isAttribute2 && sku.attribute2 && !initialData.attribute2) {
                setAttribute2(sku.attribute2)
              }
            }
          })
          .catch((error) => console.error('Error fetching SKU:', error))
      }
    }
  }, [initialData, warehouseId, batchOptions, handleBatchChange])

  const onSubmit = async (data: ProductLineFormData) => {
    // Map frontend "required" fields to backend "expected" fields
    await onSave({
      ...data,
      skuDescription,
      requiredCubicPerHU,
      expiry: selectedSku?.isExpriy ? expiryDate : undefined,
      attribute1: selectedSku?.isAttribute1 ? attribute1 : undefined,
      attribute2: selectedSku?.isAttribute2 ? attribute2 : undefined,
      // Map to backend field names
      expectedQty: data.requiredQty,
      expectedWeight: data.requiredWeight,
      expectedCubicPerHU: data.requiredCubicPerHU,
    } as OutboundProductLine & { expectedQty?: number; expectedWeight?: number; expectedCubicPerHU?: number })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
      {/* Batch Number First */}
      {warehouseId ? (
        <FormCombobox
          label="Batch Number"
          required
          error={errors.batchNumber?.message}
          options={batchOptions.map((batch) => ({
            value: batch.batchNumber,
            label: batch.batchNumber,
          }))}
          placeholder={loadingBatches ? 'Loading batches...' : 'Select batch number'}
          searchPlaceholder="Search batches..."
          value={watch('batchNumber')}
          onValueChange={(value) => {
            handleBatchChange(value as string)
          }}
        />
      ) : (
        <FormInput
          label="Batch Number"
          required
          error={errors.batchNumber?.message}
          placeholder="Select warehouse first to load batches"
          {...register('batchNumber')}
          disabled
        />
      )}

      {/* SKU Description (auto-fetched from batch) */}
      <FormInput label="SKU Description" value={skuDescription} readOnly className="bg-muted" />

      {/* SKU-related fields (only show if present in SKU, non-editable, auto-populated) */}
      {selectedSku?.isExpriy && (
        <FormInput
          label="Expiry Date"
          type="date"
          value={expiryDate || ''}
          readOnly
          className="bg-muted"
        />
      )}

      {selectedSku?.isAttribute1 && (
        <FormTextarea
          label="Attribute 1"
          value={attribute1 || ''}
          readOnly
          className="bg-muted"
          rows={3}
        />
      )}

      {selectedSku?.isAttribute2 && (
        <FormTextarea
          label="Attribute 2"
          value={attribute2 || ''}
          readOnly
          className="bg-muted"
          rows={3}
        />
      )}

      {/* Container Number, Qty Required, Weight Required, Cubic Required */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput
          label="Container Number (optional)"
          error={errors.containerNumber?.message}
          placeholder="Enter container number"
          {...register('containerNumber')}
        />
        <FormInput
          label="Required Quantity"
          type="number"
          min="1"
          error={errors.requiredQty?.message}
          placeholder="Enter required quantity"
          {...register('requiredQty', { valueAsNumber: true })}
        />
        <FormInput
          label="Required Weight (kg)"
          type="number"
          min="0"
          step="0.01"
          error={errors.requiredWeight?.message}
          placeholder="Enter required weight"
          {...register('requiredWeight', { valueAsNumber: true })}
        />
        <FormInput
          label="Required Cubic per HU (m³) (auto-calculated)"
          value={requiredCubicPerHU?.toFixed(6) || ''}
          readOnly
          className="bg-muted"
        />
      </div>

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
