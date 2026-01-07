'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FormInput } from '@/components/ui/form-field'
import { X, Save } from 'lucide-react'
import { toast } from 'sonner'

const customerSchema = z.object({
  customer_name: z.string().min(1, 'Customer name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
})

type CustomerFormData = z.infer<typeof customerSchema>

type Customer = {
  id?: number
  customer_name?: string
  email?: string
  contact_name?: string
  contact_phone?: string
  street?: string
  city?: string
  state?: string
  postcode?: string
}

interface CustomerFormProps {
  initialData?: Customer | null
  onSuccess: (customer: Customer) => void
  onCancel: () => void
  mode?: 'create' | 'edit'
}

export function CustomerForm({ initialData, onSuccess, onCancel, mode = 'create' }: CustomerFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      customer_name: initialData?.customer_name || '',
      email: initialData?.email || '',
      contact_name: initialData?.contact_name || '',
      contact_phone: initialData?.contact_phone || '',
      street: initialData?.street || '',
      city: initialData?.city || '',
      state: initialData?.state || '',
      postcode: initialData?.postcode || '',
    },
  })

  const onSubmit = async (data: CustomerFormData) => {
    try {
      const url = mode === 'edit' && initialData?.id
        ? `/api/customers/${initialData.id}`
        : '/api/customers'
      const method = mode === 'edit' && initialData?.id ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        const responseData = await res.json()
        const customer = responseData.customer || responseData
        toast.success(mode === 'edit' ? 'Customer updated successfully' : 'Customer created successfully')
        // Keep dialog open briefly showing success, then close automatically
        setTimeout(() => {
          onSuccess(customer)
          reset()
        }, 1500)
      } else {
        // Handle API error responses
        try {
          const errorData = await res.json()
          const errorMessage = errorData.message || errorData.error || `Failed to ${mode === 'edit' ? 'update' : 'create'} customer`
          toast.error(errorMessage)
        } catch (jsonError) {
          // If response is not JSON, show generic error
          toast.error(`Failed to ${mode === 'edit' ? 'update' : 'create'} customer. Please try again.`)
        }
      }
    } catch (error) {
      console.error('Error saving customer:', error)
      // Handle network errors and other exceptions
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error('Network error. Please check your connection and try again.')
      } else {
        toast.error(`An error occurred while ${mode === 'edit' ? 'updating' : 'creating'} the customer. Please try again.`)
      }
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
        <FormInput
          label="Street"
          error={errors.street?.message}
          placeholder="Street address"
          {...register('street')}
        />
        <FormInput
          label="City"
          error={errors.city?.message}
          placeholder="City"
          {...register('city')}
        />
        <FormInput
          label="State"
          error={errors.state?.message}
          placeholder="State/Province"
          {...register('state')}
        />
        <FormInput
          label="Postcode"
          error={errors.postcode?.message}
          placeholder="Postal code"
          {...register('postcode')}
        />
      </div>
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
              ? 'Update Consignee/Consignor'
              : 'Create Consignee/Consignor'}
        </Button>
      </div>
    </form>
  )
}

