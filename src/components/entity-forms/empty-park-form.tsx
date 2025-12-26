'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FormInput } from '@/components/ui/form-field'
import { Save, X } from 'lucide-react'
import { toast } from 'sonner'

const phoneRegex = /^[\d\s\-\+\(\)]+$/

const emptyParkSchema = z.object({
  name: z.string().min(1, 'Empty park name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  contactName: z.string().optional(),
  contactPhoneNumber: z
    .string()
    .regex(phoneRegex, 'Phone number can only contain numbers, spaces, dashes, parentheses, and plus signs')
    .optional()
    .or(z.literal('')),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postcode: z.string().optional(),
    })
    .optional(),
})

type EmptyParkFormData = z.infer<typeof emptyParkSchema>

type EmptyPark = {
  id?: number
  name?: string
  email?: string
  contactName?: string
  contactPhoneNumber?: string
  address?: {
    street?: string
    city?: string
    state?: string
    postcode?: string
  }
}

interface EmptyParkFormProps {
  initialData?: EmptyPark | null
  onSuccess: (emptyPark: EmptyPark) => void
  onCancel: () => void
  mode?: 'create' | 'edit'
}

export function EmptyParkForm({
  initialData,
  onSuccess,
  onCancel,
  mode = 'create',
}: EmptyParkFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmptyParkFormData>({
    resolver: zodResolver(emptyParkSchema),
    defaultValues: {
      name: initialData?.name || '',
      email: initialData?.email || '',
      contactName: initialData?.contactName || '',
      contactPhoneNumber: initialData?.contactPhoneNumber || '',
      address: initialData?.address || {
        street: '',
        city: '',
        state: '',
        postcode: '',
      },
    },
  })

  const onSubmit = async (data: EmptyParkFormData) => {
    try {
      const url = initialData?.id
        ? `/api/empty-parks/${initialData.id}`
        : '/api/empty-parks'
      const method = initialData?.id ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        const result = await res.json()
        toast.success(
          mode === 'create' ? 'Empty park created successfully' : 'Empty park updated successfully',
        )
        onSuccess(result.emptyPark || result)
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to save empty park')
      }
    } catch (error) {
      console.error('Error saving empty park:', error)
      toast.error('An error occurred while saving the empty park')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Name"
          required
          error={errors.name?.message}
          placeholder="Empty park name"
          {...register('name')}
        />
        <FormInput
          label="Email"
          type="email"
          error={errors.email?.message}
          placeholder="Email address"
          {...register('email')}
        />
        <FormInput
          label="Contact Name"
          error={errors.contactName?.message}
          placeholder="Contact name"
          {...register('contactName')}
        />
        <FormInput
          label="Contact Phone Number"
          type="tel"
          error={errors.contactPhoneNumber?.message}
          placeholder="Contact phone number"
          {...register('contactPhoneNumber')}
        />
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold mb-4">Address</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Street"
            error={errors.address?.street?.message}
            placeholder="Street address"
            {...register('address.street')}
          />
          <FormInput
            label="City"
            error={errors.address?.city?.message}
            placeholder="City"
            {...register('address.city')}
          />
          <FormInput
            label="State"
            error={errors.address?.state?.message}
            placeholder="State"
            {...register('address.state')}
          />
          <FormInput
            label="Postcode"
            error={errors.address?.postcode?.message}
            placeholder="Postcode"
            {...register('address.postcode')}
          />
        </div>
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

