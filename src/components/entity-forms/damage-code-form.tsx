'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FormInput, FormSelect } from '@/components/ui/form-field'
import { Save, X } from 'lucide-react'
import { toast } from 'sonner'

const damageCodeSchema = z.object({
  freightType: z.enum(['Container', 'General', 'Warehouse']),
  reason: z.string().min(1, 'Reason is required'),
})

type DamageCodeFormData = z.infer<typeof damageCodeSchema>

type DamageCode = {
  id?: number
  freightType?: 'Container' | 'General' | 'Warehouse'
  reason?: string
}

interface DamageCodeFormProps {
  initialData?: DamageCode | null
  onSuccess: (damageCode: DamageCode) => void
  onCancel: () => void
  mode?: 'create' | 'edit'
}

export function DamageCodeForm({
  initialData,
  onSuccess,
  onCancel,
  mode = 'create',
}: DamageCodeFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DamageCodeFormData>({
    resolver: zodResolver(damageCodeSchema),
    defaultValues: {
      freightType: initialData?.freightType || 'Container',
      reason: initialData?.reason || '',
    },
  })

  const onSubmit = async (data: DamageCodeFormData) => {
    try {
      const url = initialData?.id
        ? `/api/damage-codes/${initialData.id}`
        : '/api/damage-codes'
      const method = initialData?.id ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        const result = await res.json()
        toast.success(
          mode === 'create' ? 'Damage code created successfully' : 'Damage code updated successfully',
        )
        onSuccess(result.damageCode || result)
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to save damage code')
      }
    } catch (error) {
      console.error('Error saving damage code:', error)
      toast.error('An error occurred while saving the damage code')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormSelect
          label="Freight Type"
          required
          error={errors.freightType?.message}
          options={[
            { value: 'Container', label: 'Container' },
            { value: 'General', label: 'General' },
            { value: 'Warehouse', label: 'Warehouse' },
          ]}
          {...register('freightType')}
        />
        <FormInput
          label="Reason"
          required
          error={errors.reason?.message}
          placeholder="Reason for damage code"
          {...register('reason')}
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


