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

// Helper to convert NaN/empty to undefined
const numberOrUndefined = z.union([
  z.undefined(),
  z.preprocess((val) => {
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
  }, z.number()),
])

const productLineSchema = z.object({
  skuId: z.number().min(1, 'SKU is required'),
  batchNumber: z.string().min(1, 'Batch number is required'),
  requiredQty: z.preprocess(
    (val) => {
      // Convert empty/NaN to a special marker for validation
      if (
        val === '' ||
        val === null ||
        val === undefined ||
        (typeof val === 'number' && Number.isNaN(val))
      ) {
        return '__EMPTY__'
      }
      // If it's already a valid number, return it
      if (typeof val === 'number' && Number.isFinite(val)) {
        return val
      }
      // If it's a string, try to parse it
      if (typeof val === 'string') {
        const parsed = parseFloat(val)
        return Number.isNaN(parsed) || !Number.isFinite(parsed) ? '__EMPTY__' : parsed
      }
      return '__EMPTY__'
    },
    z
      .union([
        z.literal('__EMPTY__').refine(() => false, {
          message: 'Required quantity is required',
        }),
        z.number().min(1, 'Required quantity must be at least 1'),
      ]),
  ),
  requiredWeight: numberOrUndefined,
  requiredCubicPerHU: numberOrUndefined,
  containerNumber: z.string().optional(),
})

type ProductLineFormData = z.infer<typeof productLineSchema>

interface OutboundProductLineFormProps {
  outboundInventoryId: number
  warehouseId?: number
  initialData?: OutboundProductLine
  onSave: (data: OutboundProductLine) => Promise<void>
  onCancel: () => void
  hideContainerNumber?: boolean
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
  hideContainerNumber = false,
}: OutboundProductLineFormProps) {
  const [batchOptions, setBatchOptions] = useState<BatchOption[]>([])
  const [skuOptions, setSkuOptions] = useState<SKU[]>([])
  const [loadingBatches, setLoadingBatches] = useState(false)
  const [loadingSkus, setLoadingSkus] = useState(false)
  const [skuDescription, setSkuDescription] = useState<string>('')
  const [selectedSku, setSelectedSku] = useState<SKU | null>(null)
  const [expiryDate, setExpiryDate] = useState<string>('')
  const [attribute1, setAttribute1] = useState<string>('')
  const [attribute2, setAttribute2] = useState<string>('')
  const [requiredCubicPerHU, setRequiredCubicPerHU] = useState<number | undefined>()
  const [selectedBatchSkuId, setSelectedBatchSkuId] = useState<number | null>(null)

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

  const loadSkuOptions = useCallback(async () => {
    setLoadingSkus(true)
    try {
      const res = await fetch('/api/skus?limit=1000')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.skus) {
          setSkuOptions(data.skus)
        }
      }
    } catch (error) {
      console.error('Error loading SKUs:', error)
    } finally {
      setLoadingSkus(false)
    }
  }, [])

  const handleBatchChange = useCallback(
    async (batchNumber: string, skuId?: number) => {
      setValue('batchNumber', batchNumber)

      // Find the batch to get SKU ID if not provided
      const batch = batchOptions.find((b) => b.batchNumber === batchNumber)
      if (!batch) return

      const batchSkuId = skuId || (typeof batch.skuId === 'object' ? batch.skuId.id : batch.skuId)
      if (!batchSkuId) return

      // Store the batch's SKU ID for filtering
      setSelectedBatchSkuId(batchSkuId)

      // Set SKU ID (will be updated if user selects different SKU)
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
                setRequiredCubicPerHU(cubicM3)
                setValue('requiredCubicPerHU', cubicM3)
              } else {
                setRequiredCubicPerHU(undefined)
                setValue('requiredCubicPerHU', undefined)
              }
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
    loadSkuOptions()
  }, [warehouseId, loadBatchOptions, loadSkuOptions])

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
    // Helper to clean NaN/undefined values
    const cleanNumber = (val: number | undefined): number | undefined => {
      if (val === undefined || val === null) return undefined
      if (typeof val === 'number' && (Number.isNaN(val) || !Number.isFinite(val))) {
        return undefined
      }
      return val
    }

    // Prepare the data to save
    const saveData: OutboundProductLine = {
      skuId: data.skuId,
      skuDescription,
      batchNumber: data.batchNumber,
      requiredQty: data.requiredQty,
      requiredWeight: cleanNumber(data.requiredWeight),
      requiredCubicPerHU: cleanNumber(data.requiredCubicPerHU),
      expiry: selectedSku?.isExpriy ? expiryDate : undefined,
      attribute1: selectedSku?.isAttribute1 ? attribute1 : undefined,
      attribute2: selectedSku?.isAttribute2 ? attribute2 : undefined,
      // Map to backend field names, ensuring NaN is converted to undefined
      expectedQty: data.requiredQty,
      expectedWeight: cleanNumber(data.requiredWeight),
      expectedCubicPerHU: cleanNumber(data.requiredCubicPerHU),
    }

    // Only include containerNumber if not hidden (for regular outbound jobs)
    if (!hideContainerNumber && data.containerNumber) {
      saveData.containerNumber = data.containerNumber
    }

    await onSave(saveData as OutboundProductLine & {
      expectedQty?: number
      expectedWeight?: number
      expectedCubicPerHU?: number
    })
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
          value={watch('batchNumber')}
          onValueChange={(value) => {
            if (value === undefined) {
              handleBatchChange('')
              setSelectedBatchSkuId(null)
              return
            }
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

      {/* SKU Selection - Filtered by batch's SKU */}
      {watch('batchNumber') && selectedBatchSkuId && (
        <FormCombobox
          label="SKU Number"
          required
          error={errors.skuId?.message}
          options={skuOptions
            .filter((sku) => sku.id === selectedBatchSkuId)
            .map((sku) => ({
              value: sku.id,
              label: `${sku.skuCode}${sku.description ? ` - ${sku.description}` : ''}`,
            }))}
          placeholder={loadingSkus ? 'Loading SKUs...' : 'Select SKU number'}
          value={watch('skuId')}
          onValueChange={(value) => {
            if (value === undefined) {
              // Don't clear required skuId, just reset UI state
              setSelectedSku(null)
              setSkuDescription('')
              return
            }
            const skuIdNum = typeof value === 'number' ? value : parseInt(value.toString())
            setValue('skuId', skuIdNum)
            // Load SKU details
            const sku = skuOptions.find((s) => s.id === skuIdNum)
            if (sku) {
              setSelectedSku(sku)
              setSkuDescription(sku.description || '')
              // Auto-populate expiry, attributes, cubic if SKU has them
              if (sku.isExpriy && sku.expiryDate) {
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
              // Auto-calculate cubic from SKU dimensions
              if (
                sku.lengthPerHU_mm &&
                sku.widthPerHU_mm &&
                sku.heightPerHU_mm &&
                !Number.isNaN(sku.lengthPerHU_mm) &&
                !Number.isNaN(sku.widthPerHU_mm) &&
                !Number.isNaN(sku.heightPerHU_mm)
              ) {
                const cubicM3 =
                  (sku.lengthPerHU_mm * sku.widthPerHU_mm * sku.heightPerHU_mm) / 1_000_000_000
                // Ensure the result is a valid number
                if (!Number.isNaN(cubicM3) && Number.isFinite(cubicM3)) {
                  setRequiredCubicPerHU(cubicM3)
                  setValue('requiredCubicPerHU', cubicM3)
                } else {
                  setRequiredCubicPerHU(undefined)
                  setValue('requiredCubicPerHU', undefined)
                }
              } else {
                setRequiredCubicPerHU(undefined)
                setValue('requiredCubicPerHU', undefined)
              }
            }
          }}
        />
      )}

      {/* SKU Description (auto-fetched from batch or selected SKU) */}
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
        {!hideContainerNumber && (
          <FormInput
            label="Container Number (optional)"
            error={errors.containerNumber?.message}
            placeholder="Enter container number"
            {...register('containerNumber')}
          />
        )}
        <FormInput
          label="Required Quantity"
          type="number"
          min="1"
          required
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
          placeholder="Enter weight"
          {...register('requiredWeight', {
            setValueAs: (v) => {
              // Handle empty, null, undefined
              if (v === '' || v === null || v === undefined) {
                return undefined
              }
              // Handle NaN (can occur with number inputs)
              if (typeof v === 'number' && (Number.isNaN(v) || !Number.isFinite(v))) {
                return undefined
              }
              // Convert string to number
              if (typeof v === 'string') {
                const parsed = parseFloat(v)
                return Number.isNaN(parsed) || !Number.isFinite(parsed) ? undefined : parsed
              }
              // Return number as-is if valid
              if (typeof v === 'number') {
                return v
              }
              return undefined
            },
          })}
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
