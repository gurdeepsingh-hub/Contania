'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FormInput } from '@/components/ui/form-field'
import { X, Save } from 'lucide-react'
import { toast } from 'sonner'

const transportCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  contact: z.string().optional(),
  mobile: z.string().optional(),
})

type TransportCompanyFormData = z.infer<typeof transportCompanySchema>

type TransportCompany = {
  id?: number
  name?: string
  contact?: string
  mobile?: string
}

interface TransportCompanyFormProps {
  initialData?: TransportCompany | null
  onSuccess: (transportCompany: TransportCompany) => void
  onCancel: () => void
  mode?: 'create' | 'edit'
}

export function TransportCompanyForm({
  initialData,
  onSuccess,
  onCancel,
  mode = 'create',
}: TransportCompanyFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<TransportCompanyFormData>({
    resolver: zodResolver(transportCompanySchema),
    defaultValues: {
      name: initialData?.name || '',
      contact: initialData?.contact || '',
      mobile: initialData?.mobile || '',
    },
  })

  const onSubmit = async (data: TransportCompanyFormData) => {
    try {
      const url = mode === 'edit' && initialData?.id
        ? `/api/transport-companies/${initialData.id}`
        : '/api/transport-companies'
      const method = mode === 'edit' && initialData?.id ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        const responseData = await res.json()
        const transportCompany = responseData.transportCompany || responseData
        toast.success(
          mode === 'edit'
            ? 'Transport company updated successfully'
            : 'Transport company created successfully',
        )
        // Keep dialog open briefly showing success, then close automatically
        setTimeout(() => {
          onSuccess(transportCompany)
          reset()
        }, 1500)
      } else {
        // Handle API error responses
        try {
          const errorData = await res.json()
          const errorMessage = errorData.message || errorData.error || `Failed to ${mode === 'edit' ? 'update' : 'create'} transport company`
          toast.error(errorMessage)
        } catch (jsonError) {
          // If response is not JSON, show generic error
          toast.error(`Failed to ${mode === 'edit' ? 'update' : 'create'} transport company. Please try again.`)
        }
      }
    } catch (error) {
      console.error('Error saving transport company:', error)
      // Handle network errors and other exceptions
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error('Network error. Please check your connection and try again.')
      } else {
        toast.error(`An error occurred while ${mode === 'edit' ? 'updating' : 'creating'} the transport company. Please try again.`)
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Company Name"
          required
          error={errors.name?.message}
          placeholder="Transport company name"
          {...register('name')}
        />
        <FormInput
          label="Contact Person"
          error={errors.contact?.message}
          placeholder="Primary contact person"
          {...register('contact')}
        />
        <FormInput
          label="Mobile"
          type="tel"
          error={errors.mobile?.message}
          placeholder="Contact mobile number"
          {...register('mobile')}
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
              ? 'Update Transport Company'
              : 'Create Transport Company'}
        </Button>
      </div>
    </form>
  )
}

