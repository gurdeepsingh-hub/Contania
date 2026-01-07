'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FormInput, FormSelect } from '@/components/ui/form-field'
import { Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { valueAsNumberOrUndefined } from '@/lib/utils'

const containerSizeSchema = z.object({
  size: z.number().min(1, 'Container size is required'),
  description: z.string().optional(),
  attribute: z.enum(['HC', 'RF', 'GP', 'TK', 'OT']).optional(),
  weight: z.number().min(0, 'Weight must be a positive number').optional(),
})

type ContainerSizeFormData = z.infer<typeof containerSizeSchema>

type ContainerSize = {
  id?: number
  size?: number
  description?: string
  attribute?: 'HC' | 'RF' | 'GP' | 'TK' | 'OT'
  weight?: number
}

interface ContainerSizeFormProps {
  initialData?: ContainerSize | null
  onSuccess: (containerSize: ContainerSize) => void
  onCancel: () => void
  mode?: 'create' | 'edit'
}

export function ContainerSizeForm({
  initialData,
  onSuccess,
  onCancel,
  mode = 'create',
}: ContainerSizeFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContainerSizeFormData>({
    resolver: zodResolver(containerSizeSchema),
    defaultValues: {
      size: initialData?.size ? (typeof initialData.size === 'string' ? parseFloat(initialData.size) || undefined : initialData.size) : undefined,
      description: initialData?.description || '',
      attribute: initialData?.attribute || undefined,
      weight: initialData?.weight || undefined,
    },
  })

  const onSubmit = async (data: ContainerSizeFormData) => {
    try {
      const url = initialData?.id
        ? `/api/container-sizes/${initialData.id}`
        : '/api/container-sizes'
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
            ? 'Container size created successfully'
            : 'Container size updated successfully',
        )
        onSuccess(result.containerSize || result)
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to save container size')
      }
    } catch (error) {
      console.error('Error saving container size:', error)
      toast.error('An error occurred while saving the container size')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Size"
          type="number"
          required
          error={errors.size?.message}
          placeholder="e.g., 20, 40"
          {...register('size', { setValueAs: valueAsNumberOrUndefined, valueAsNumber: true })}
        />
        <FormSelect
          label="Attribute"
          error={errors.attribute?.message}
          placeholder="Select attribute"
          options={[
            { value: 'HC', label: 'HC' },
            { value: 'RF', label: 'RF' },
            { value: 'GP', label: 'GP' },
            { value: 'TK', label: 'TK' },
            { value: 'OT', label: 'OT' },
          ]}
          {...register('attribute')}
        />
      </div>
      <FormInput
        label="Description"
        error={errors.description?.message}
        placeholder="Description"
        {...register('description')}
      />
      <FormInput
        label="Weight (kg)"
        type="number"
        error={errors.weight?.message}
        placeholder="Weight in kg"
        {...register('weight', { setValueAs: valueAsNumberOrUndefined })}
      />

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
  )
}


