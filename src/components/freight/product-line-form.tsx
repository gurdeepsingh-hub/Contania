'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FormInput, FormSelect, FormTextarea } from '@/components/ui/form-field'

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
}

const productLineSchema = z.object({
  skuId: z.number().min(1, 'SKU is required'),
  batchNumber: z.string().optional(),
  expectedQty: z.number().min(1, 'Expected quantity must be at least 1'),
  weightPerHU: z.number().min(0, 'Weight per HU must be 0 or greater').optional(),
  expectedWeight: z.number().min(0, 'Expected weight must be 0 or greater').optional(),
  sqmPerSU: z.number().min(0, 'SQM per SU must be 0 or greater').optional(),
  expectedCubicPerHU: z.number().min(0, 'Expected cubic per HU must be 0 or greater').optional(),
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
      expectedQty: initialData?.expectedQty,
      weightPerHU: initialData?.weightPerHU,
      expectedWeight: initialData?.expectedWeight,
      sqmPerSU: initialData?.sqmPerSU,
      expectedCubicPerHU: initialData?.expectedCubicPerHU,
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
          setSkuDescription(sku.description || '')
          setLpnQty(sku.huPerSu?.toString() || '')
          setValue('weightPerHU', sku.weightPerHU_kg)

          // Auto-calculate cubic from SKU dimensions (length × width × height in m³)
          if (sku.lengthPerHU_mm && sku.widthPerHU_mm && sku.heightPerHU_mm) {
            // Convert from mm³ to m³: divide by 1,000,000,000
            const cubicM3 =
              (sku.lengthPerHU_mm * sku.widthPerHU_mm * sku.heightPerHU_mm) / 1_000_000_000
            setExpectedCubicPerHU(cubicM3)
            setValue('expectedCubicPerHU', cubicM3)
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
                  if (storageUnit.lengthPerSU_mm && storageUnit.widthPerSU_mm) {
                    // Convert from mm² to m²: divide by 1,000,000
                    const sqmPerSUValue =
                      (storageUnit.lengthPerSU_mm * storageUnit.widthPerSU_mm) / 1_000_000
                    setSqmPerSU(sqmPerSUValue)
                    setValue('sqmPerSU', sqmPerSUValue)
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
    } as ProductLine)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
      <FormSelect
        label="SKU"
        required
        error={errors.skuId?.message}
        options={skus.map((sku) => ({
          value: sku.id,
          label: `${sku.skuCode} - ${sku.description || ''}`,
        }))}
        placeholder="Select SKU..."
        {...register('skuId', {
          valueAsNumber: true,
          onChange: (e) => handleSKUChange(parseInt(e.target.value)),
        })}
      />

      <FormInput label="SKU Description" value={skuDescription} readOnly className="bg-muted" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput label="LPN Qty (HU per SU)" value={lpnQty} readOnly className="bg-muted" />
        <FormInput
          label="Weight per HU (kg)"
          type="number"
          step="0.01"
          min="0"
          error={errors.weightPerHU?.message}
          placeholder="Enter weight per HU"
          {...register('weightPerHU', { valueAsNumber: true })}
        />
      </div>

      <FormInput
        label="Batch Number"
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
        label="Expected Weight"
        type="number"
        min="0"
        error={errors.expectedWeight?.message}
        placeholder="Enter expected weight"
        {...register('expectedWeight', { valueAsNumber: true })}
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
