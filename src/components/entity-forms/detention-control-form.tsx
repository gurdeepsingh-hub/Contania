'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FormInput, FormSelect, FormCombobox } from '@/components/ui/form-field'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Save, X, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { ShippingLineForm } from './shipping-line-form'
import { valueAsNumberOrUndefined } from '@/lib/utils'

const detentionControlSchema = z.object({
  shippingLineId: z.number().min(1, 'Shipping line is required'),
  containerType: z.enum(['RF', 'DRY']),
  importFreeDays: z.number().optional(),
})

type DetentionControlFormData = z.infer<typeof detentionControlSchema>

type DetentionControl = {
  id?: number
  shippingLineId?: number | { id: number }
  containerType?: 'RF' | 'DRY'
  importFreeDays?: number
}

type ShippingLine = {
  id: number
  name: string
}

interface DetentionControlFormProps {
  initialData?: DetentionControl | null
  onSuccess: (detentionControl: DetentionControl) => void
  onCancel: () => void
  mode?: 'create' | 'edit'
}

export function DetentionControlForm({
  initialData,
  onSuccess,
  onCancel,
  mode = 'create',
}: DetentionControlFormProps) {
  const [shippingLines, setShippingLines] = useState<ShippingLine[]>([])
  const [showShippingLineModal, setShowShippingLineModal] = useState(false)

  useEffect(() => {
    const loadShippingLines = async () => {
      try {
        const res = await fetch('/api/shipping-lines?limit=100')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.shippingLines) {
            setShippingLines(data.shippingLines)
          }
        }
      } catch (error) {
        console.error('Error loading shipping lines:', error)
      }
    }
    loadShippingLines()
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<DetentionControlFormData>({
    resolver: zodResolver(detentionControlSchema),
    defaultValues: {
      shippingLineId:
        typeof initialData?.shippingLineId === 'object'
          ? initialData.shippingLineId.id
          : initialData?.shippingLineId || undefined,
      containerType: initialData?.containerType || 'DRY',
      importFreeDays: initialData?.importFreeDays || undefined,
    },
  })

  const shippingLineId = watch('shippingLineId')

  // Auto-fetch calculateImportFreeDaysUsing when shipping line changes
  useEffect(() => {
    if (shippingLineId) {
      const shippingLine = shippingLines.find((sl) => sl.id === shippingLineId)
      if (shippingLine) {
        // Fetch full shipping line details to get calculateImportFreeDaysUsing
        fetch(`/api/shipping-lines/${shippingLineId}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.success && data.shippingLine) {
              // This field is auto-filled by the backend hook, so we don't need to set it here
            }
          })
          .catch((error) => {
            console.error('Error fetching shipping line details:', error)
          })
      }
    }
  }, [shippingLineId, shippingLines])

  const onSubmit = async (data: DetentionControlFormData) => {
    try {
      const url = initialData?.id
        ? `/api/detention-control/${initialData.id}`
        : '/api/detention-control'
      const method = initialData?.id ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        const result = await res.json()
        toast.success(
          mode === 'create'
            ? 'Detention control created successfully'
            : 'Detention control updated successfully',
        )
        onSuccess(result.detentionControl || result)
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to save detention control')
      }
    } catch (error) {
      console.error('Error saving detention control:', error)
      toast.error('An error occurred while saving the detention control')
    }
  }

  const handleShippingLineCreated = (shippingLine: { id?: number; name?: string }) => {
    if (shippingLine.id) {
      // Add to the list
      const newShippingLine: ShippingLine = {
        id: shippingLine.id,
        name: shippingLine.name || '',
      }
      setShippingLines((prev) => [...prev, newShippingLine])
      // Set as selected
      setValue('shippingLineId', shippingLine.id, { shouldValidate: true })
      toast.success('Shipping line created successfully')
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <FormCombobox
                label="Shipping Line"
                required
                placeholder="Select shipping line..."
                options={shippingLines.map((sl) => ({
                  value: sl.id,
                  label: sl.name,
                }))}
                value={shippingLineId}
                onValueChange={(value) => {
                  const numValue = value && !isNaN(Number(value)) ? Number(value) : undefined
                  if (numValue !== undefined) {
                    setValue('shippingLineId', numValue, {
                      shouldValidate: true,
                    })
                  } else {
                    setValue('shippingLineId', undefined as any, {
                      shouldValidate: true,
                    })
                  }
                }}
                error={errors.shippingLineId?.message}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="mt-8"
              onClick={() => setShowShippingLineModal(true)}
              title="Quick create shipping line"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        <FormSelect
          label="Container Type"
          required
          error={errors.containerType?.message}
          options={[
            { value: 'RF', label: 'RF' },
            { value: 'DRY', label: 'DRY' },
          ]}
          {...register('containerType')}
        />
        <FormInput
          label="Import Free Days"
          type="number"
          error={errors.importFreeDays?.message}
          placeholder="Number of import free days"
          {...register('importFreeDays', { setValueAs: valueAsNumberOrUndefined })}
        />
      </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create' : 'Update'}
          </Button>
        </div>
      </form>

      {/* Quick Create Shipping Line Dialog */}
      <Dialog open={showShippingLineModal} onOpenChange={setShowShippingLineModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick Create Shipping Line</DialogTitle>
            <DialogDescription>Create a new shipping line quickly</DialogDescription>
          </DialogHeader>
          <ShippingLineForm
            onSuccess={handleShippingLineCreated}
            onCancel={() => setShowShippingLineModal(false)}
            mode="create"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

