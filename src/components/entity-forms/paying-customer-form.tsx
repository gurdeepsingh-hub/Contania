'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FormInput } from '@/components/ui/form-field'
import { X, Save } from 'lucide-react'
import { toast } from 'sonner'

const payingCustomerSchema = z.object({
  customer_name: z.string().min(1, 'Customer name is required'),
  abn: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  billing_street: z.string().optional(),
  billing_city: z.string().optional(),
  billing_state: z.string().optional(),
  billing_postcode: z.string().optional(),
  delivery_same_as_billing: z.boolean(),
  delivery_street: z.string().optional(),
  delivery_city: z.string().optional(),
  delivery_state: z.string().optional(),
  delivery_postcode: z.string().optional(),
})

type PayingCustomerFormData = z.infer<typeof payingCustomerSchema>

type PayingCustomer = {
  id?: number
  customer_name?: string
  abn?: string
  email?: string
  contact_name?: string
  contact_phone?: string
  billing_street?: string
  billing_city?: string
  billing_state?: string
  billing_postcode?: string
  delivery_same_as_billing?: boolean
  delivery_street?: string
  delivery_city?: string
  delivery_state?: string
  delivery_postcode?: string
}

interface PayingCustomerFormProps {
  initialData?: PayingCustomer | null
  onSuccess: (customer: PayingCustomer) => void
  onCancel: () => void
  mode?: 'create' | 'edit'
}

export function PayingCustomerForm({
  initialData,
  onSuccess,
  onCancel,
  mode = 'create',
}: PayingCustomerFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<PayingCustomerFormData>({
    resolver: zodResolver(payingCustomerSchema),
    defaultValues: {
      customer_name: initialData?.customer_name || '',
      abn: initialData?.abn || '',
      email: initialData?.email || '',
      contact_name: initialData?.contact_name || '',
      contact_phone: initialData?.contact_phone || '',
      billing_street: initialData?.billing_street || '',
      billing_city: initialData?.billing_city || '',
      billing_state: initialData?.billing_state || '',
      billing_postcode: initialData?.billing_postcode || '',
      delivery_same_as_billing: initialData?.delivery_same_as_billing ?? false,
      delivery_street: initialData?.delivery_street || '',
      delivery_city: initialData?.delivery_city || '',
      delivery_state: initialData?.delivery_state || '',
      delivery_postcode: initialData?.delivery_postcode || '',
    },
  })

  const deliverySameAsBilling = watch('delivery_same_as_billing')

  useEffect(() => {
    if (deliverySameAsBilling) {
      setValue('delivery_street', watch('billing_street'))
      setValue('delivery_city', watch('billing_city'))
      setValue('delivery_state', watch('billing_state'))
      setValue('delivery_postcode', watch('billing_postcode'))
    }
  }, [deliverySameAsBilling, watch, setValue])

  const onSubmit = async (data: PayingCustomerFormData) => {
    try {
      const url =
        mode === 'edit' && initialData?.id
          ? `/api/paying-customers/${initialData.id}`
          : '/api/paying-customers'
      const method = mode === 'edit' && initialData?.id ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        const responseData = await res.json()
        const customer = responseData.payingCustomer || responseData
        toast.success(
          mode === 'edit'
            ? 'Paying customer updated successfully'
            : 'Paying customer created successfully',
        )
        onSuccess(customer)
        reset()
      } else {
        const errorData = await res.json()
        toast.error(
          errorData.message || `Failed to ${mode === 'edit' ? 'update' : 'create'} paying customer`,
        )
      }
    } catch (error) {
      console.error('Error saving paying customer:', error)
      toast.error(
        `An error occurred while ${mode === 'edit' ? 'updating' : 'creating'} the paying customer`,
      )
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Customer Name"
          required
          error={errors.customer_name?.message}
          placeholder="Customer name"
          {...register('customer_name')}
        />
        <FormInput
          label="ABN"
          error={errors.abn?.message}
          placeholder="Australian Business Number"
          {...register('abn')}
        />
        <FormInput
          label="Email"
          type="email"
          error={errors.email?.message}
          placeholder="customer@example.com"
          {...register('email')}
        />
        <FormInput
          label="Contact Name"
          error={errors.contact_name?.message}
          placeholder="Contact person"
          {...register('contact_name')}
        />
        <FormInput
          label="Contact Phone"
          type="tel"
          error={errors.contact_phone?.message}
          placeholder="+61 2 XXXX XXXX"
          {...register('contact_phone')}
        />
      </div>

      <div className="space-y-4 border-t pt-4">
        <h3 className="font-semibold">Billing Address</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Street"
            error={errors.billing_street?.message}
            placeholder="Street address"
            {...register('billing_street')}
          />
          <FormInput
            label="City"
            error={errors.billing_city?.message}
            placeholder="City"
            {...register('billing_city')}
          />
          <FormInput
            label="State"
            error={errors.billing_state?.message}
            placeholder="State/Province"
            {...register('billing_state')}
          />
          <FormInput
            label="Postcode"
            error={errors.billing_postcode?.message}
            placeholder="Postal code"
            {...register('billing_postcode')}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t pt-4">
        <input
          type="checkbox"
          id="deliverySameAsBilling"
          {...register('delivery_same_as_billing')}
          className="h-4 w-4"
        />
        <label htmlFor="deliverySameAsBilling" className="text-sm">
          Delivery address same as billing
        </label>
      </div>

      {!deliverySameAsBilling && (
        <div className="space-y-4 border-t pt-4">
          <h3 className="font-semibold">Delivery Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Street"
              error={errors.delivery_street?.message}
              placeholder="Street address"
              {...register('delivery_street')}
            />
            <FormInput
              label="City"
              error={errors.delivery_city?.message}
              placeholder="City"
              {...register('delivery_city')}
            />
            <FormInput
              label="State"
              error={errors.delivery_state?.message}
              placeholder="State/Province"
              {...register('delivery_state')}
            />
            <FormInput
              label="Postcode"
              error={errors.delivery_postcode?.message}
              placeholder="Postal code"
              {...register('delivery_postcode')}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
          <Save className="h-4 w-4 mr-2" />
          {isSubmitting
            ? mode === 'edit'
              ? 'Updating...'
              : 'Creating...'
            : mode === 'edit'
              ? 'Update Paying Customer'
              : 'Create Paying Customer'}
        </Button>
      </div>
    </form>
  )
}
