'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FormInput, FormSelect } from '@/components/ui/form-field'
import { Save, X } from 'lucide-react'
import { toast } from 'sonner'

const containerWeightSchema = z.object({
  size: z.string().min(1, 'Container size is required'),
  attribute: z.enum(['HC', 'RF', 'GP', 'TK', 'OT']),
  weight: z.number().min(0, 'Weight must be a positive number'),
})

type ContainerWeightFormData = z.infer<typeof containerWeightSchema>

type ContainerWeight = {
  id?: number
  size?: string
  attribute?: 'HC' | 'RF' | 'GP' | 'TK' | 'OT'
  weight?: number
}

interface ContainerWeightFormProps {
  initialData?: ContainerWeight | null
  onSuccess: (containerWeight: ContainerWeight) => void
  onCancel: () => void
  mode?: 'create' | 'edit'
}

export function ContainerWeightForm({
  initialData,
  onSuccess,
  onCancel,
  mode = 'create',
}: ContainerWeightFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContainerWeightFormData>({
    resolver: zodResolver(containerWeightSchema),
    defaultValues: {
      size: initialData?.size || '',
      attribute: initialData?.attribute || 'GP',
      weight: initialData?.weight || undefined,
    },
  })

  const onSubmit = async (data: ContainerWeightFormData) => {
    try {
      const url = initialData?.id
        ? `/api/container-weights/${initialData.id}`
        : '/api/container-weights'
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
            ? 'Container weight created successfully'
            : 'Container weight updated successfully',
        )
        onSuccess(result.containerWeight || result)
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to save container weight')
      }
    } catch (error) {
      console.error('Error saving container weight:', error)
      toast.error('An error occurred while saving the container weight')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Size"
          required
          error={errors.size?.message}
          placeholder="Container size"
          {...register('size')}
        />
        <FormSelect
          label="Attribute"
          required
          error={errors.attribute?.message}
          options={[
            { value: 'HC', label: 'HC' },
            { value: 'RF', label: 'RF' },
            { value: 'GP', label: 'GP' },
            { value: 'TK', label: 'TK' },
            { value: 'OT', label: 'OT' },
          ]}
          {...register('attribute')}
        />
        <FormInput
          label="Weight (kg)"
          type="number"
          required
          error={errors.weight?.message}
          placeholder="Weight in kg"
          {...register('weight', { valueAsNumber: true })}
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
  )
}


