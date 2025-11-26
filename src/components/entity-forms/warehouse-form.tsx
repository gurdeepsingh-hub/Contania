'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FormInput, FormSelect } from '@/components/ui/form-field'
import { Label } from '@/components/ui/label'
import { X, Save } from 'lucide-react'
import { toast } from 'sonner'

const warehouseSchema = z.object({
  name: z.string().min(1, 'Warehouse name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  type: z.string().optional(),
  store: z.array(z.object({ store_name: z.string() })),
})

type WarehouseFormData = z.infer<typeof warehouseSchema>

type Warehouse = {
  id?: number
  name?: string
  email?: string
  contact_name?: string
  contact_phone?: string
  street?: string
  city?: string
  state?: string
  postcode?: string
  type?: string
  store?: Array<{ store_name: string; id?: string }>
}

interface WarehouseFormProps {
  initialData?: Warehouse | null
  onSuccess: (warehouse: Warehouse) => void
  onCancel: () => void
  mode?: 'create' | 'edit'
}

export function WarehouseForm({ initialData, onSuccess, onCancel, mode = 'create' }: WarehouseFormProps) {
  const [storeInput, setStoreInput] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<WarehouseFormData>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      name: initialData?.name || '',
      email: initialData?.email || '',
      contact_name: initialData?.contact_name || '',
      contact_phone: initialData?.contact_phone || '',
      street: initialData?.street || '',
      city: initialData?.city || '',
      state: initialData?.state || '',
      postcode: initialData?.postcode || '',
      type: initialData?.type || '',
      store: initialData?.store?.map((s) => ({ store_name: s.store_name })) || [],
    },
  })

  const watchedStores = watch('store')

  const addStore = () => {
    if (storeInput.trim()) {
      const currentStores = watchedStores || []
      setValue('store', [...currentStores, { store_name: storeInput.trim() }], {
        shouldValidate: true,
      })
      setStoreInput('')
    }
  }

  const removeStore = (index: number) => {
    const currentStores = watchedStores || []
    setValue(
      'store',
      currentStores.filter((_, i) => i !== index),
      { shouldValidate: true },
    )
  }

  const onSubmit = async (data: WarehouseFormData) => {
    try {
      const url = mode === 'edit' && initialData?.id
        ? `/api/warehouses/${initialData.id}`
        : '/api/warehouses'
      const method = mode === 'edit' && initialData?.id ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        const responseData = await res.json()
        const warehouse = responseData.warehouse || responseData
        toast.success(mode === 'edit' ? 'Warehouse updated successfully' : 'Warehouse created successfully')
        onSuccess(warehouse)
        reset()
      } else {
        const errorData = await res.json()
        toast.error(errorData.message || `Failed to ${mode === 'edit' ? 'update' : 'create'} warehouse`)
      }
    } catch (error) {
      console.error('Error saving warehouse:', error)
      toast.error(`An error occurred while ${mode === 'edit' ? 'updating' : 'creating'} the warehouse`)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Warehouse Name"
          required
          error={errors.name?.message}
          placeholder="Warehouse or depot name"
          {...register('name')}
        />
        <FormSelect
          label="Type"
          placeholder="Select type"
          options={[
            { value: 'Depot', label: 'Depot' },
            { value: 'Warehouse', label: 'Warehouse' },
          ]}
          error={errors.type?.message}
          {...register('type')}
        />
        <FormInput
          label="Email"
          type="email"
          error={errors.email?.message}
          placeholder="warehouse@example.com"
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

      <div className="border-t pt-4">
        <Label htmlFor="store">Stores</Label>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <FormInput
            id="store"
            value={storeInput}
            onChange={(e) => setStoreInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addStore()
              }
            }}
            placeholder="Store name"
            containerClassName="flex-1"
            label=""
          />
          <Button type="button" onClick={addStore} variant="outline" className="min-h-[44px]">
            Add Store
          </Button>
        </div>
        {watchedStores && watchedStores.length > 0 && (
          <div className="mt-2 space-y-2">
            {watchedStores.map((store, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                <span>{store.store_name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeStore(index)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
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
              ? 'Update Warehouse'
              : 'Create Warehouse'}
        </Button>
      </div>
    </form>
  )
}

