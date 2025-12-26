'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FormInput, FormSelect } from '@/components/ui/form-field'
import { Save, X } from 'lucide-react'
import { toast } from 'sonner'

const phoneRegex = /^[\d\s\-\+\(\)]+$/

const shippingLineSchema = z.object({
  name: z.string().min(1, 'Shipping line name is required'),
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
  importFreeDays: z.number().optional(),
  calculateImportFreeDaysUsing: z
    .enum(['availability_date', 'first_free_import_date', 'discharge_date', 'full_gate_out'])
    .optional(),
})

type ShippingLineFormData = z.infer<typeof shippingLineSchema>

type ShippingLine = {
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
  importFreeDays?: number
  calculateImportFreeDaysUsing?: string
}

interface ShippingLineFormProps {
  initialData?: ShippingLine | null
  onSuccess: (shippingLine: ShippingLine) => void
  onCancel: () => void
  mode?: 'create' | 'edit'
}

export function ShippingLineForm({
  initialData,
  onSuccess,
  onCancel,
  mode = 'create',
}: ShippingLineFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ShippingLineFormData>({
    resolver: zodResolver(shippingLineSchema),
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
      importFreeDays: initialData?.importFreeDays || undefined,
      calculateImportFreeDaysUsing: (initialData?.calculateImportFreeDaysUsing ||
        undefined) as
        | 'availability_date'
        | 'first_free_import_date'
        | 'discharge_date'
        | 'full_gate_out'
        | undefined,
    },
  })

  const onSubmit = async (data: ShippingLineFormData) => {
    try {
      const url = initialData?.id
        ? `/api/shipping-lines/${initialData.id}`
        : '/api/shipping-lines'
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
            ? 'Shipping line created successfully'
            : 'Shipping line updated successfully',
        )
        onSuccess(result.shippingLine || result)
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to save shipping line')
      }
    } catch (error) {
      console.error('Error saving shipping line:', error)
      toast.error('An error occurred while saving the shipping line')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Name"
          required
          error={errors.name?.message}
          placeholder="Shipping line name"
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

      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold mb-4">Import Free Days Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Import Free Days"
            type="number"
            error={errors.importFreeDays?.message}
            placeholder="Number of import free days"
            {...register('importFreeDays', { valueAsNumber: true })}
          />
          <FormSelect
            label="Calculate Import Free Days Using"
            error={errors.calculateImportFreeDaysUsing?.message}
            options={[
              { value: 'availability_date', label: 'Availability Date' },
              { value: 'first_free_import_date', label: 'First Free Import Date' },
              { value: 'discharge_date', label: 'Discharge Date' },
              { value: 'full_gate_out', label: 'Full Gate Out' },
            ]}
            {...register('calculateImportFreeDaysUsing')}
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

