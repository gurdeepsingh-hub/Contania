'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FormInput } from '@/components/ui/form-field'
import { Save, X } from 'lucide-react'
import { toast } from 'sonner'

const containerSizeSchema = z.object({
  size: z.string().min(1, 'Container size is required'),
  code: z.string().optional(),
  description: z.string().optional(),
})

type ContainerSizeFormData = z.infer<typeof containerSizeSchema>

type ContainerSize = {
  id?: number
  size?: string
  code?: string
  description?: string
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
      size: initialData?.size || '',
      code: initialData?.code || '',
      description: initialData?.description || '',
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
          required
          error={errors.size?.message}
          placeholder="e.g., 20ft, 40ft"
          {...register('size')}
        />
        <FormInput
          label="Code"
          error={errors.code?.message}
          placeholder="Unique code"
          {...register('code')}
        />
      </div>
      <FormInput
        label="Description"
        error={errors.description?.message}
        placeholder="Description"
        {...register('description')}
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


