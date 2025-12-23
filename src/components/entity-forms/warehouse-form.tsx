'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FormInput, FormSelect } from '@/components/ui/form-field'
import { Label } from '@/components/ui/label'
import { X, Save, Plus } from 'lucide-react'
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
}

interface WarehouseFormProps {
  initialData?: Warehouse | null
  onSuccess: (warehouse: Warehouse) => void
  onCancel: () => void
  mode?: 'create' | 'edit'
}

const storeSchema = z.object({
  storeName: z.string().min(1, 'Store name is required'),
  countable: z.boolean(),
  zoneType: z.enum(['Indock', 'Outdock', 'Storage']),
})

type StoreFormData = z.infer<typeof storeSchema>

export function WarehouseForm({
  initialData,
  onSuccess,
  onCancel,
  mode = 'create',
}: WarehouseFormProps) {
  const [showStoreForm, setShowStoreForm] = useState(false)
  const [creatingStore, setCreatingStore] = useState(false)
  const [currentWarehouseId, setCurrentWarehouseId] = useState<number | null>(
    initialData?.id || null,
  )
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
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
    },
  })

  const {
    register: registerStore,
    handleSubmit: handleSubmitStore,
    formState: { errors: storeErrors },
    reset: resetStore,
  } = useForm<StoreFormData>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      storeName: '',
      countable: false,
      zoneType: undefined,
    },
  })

  const onCreateStore = async (storeData: StoreFormData) => {
    const warehouseId =
      currentWarehouseId || (mode === 'edit' && initialData?.id ? initialData.id : null)
    if (!warehouseId) {
      toast.error('Please create the warehouse first before adding stores')
      return
    }

    setCreatingStore(true)
    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseId,
          ...storeData,
        }),
      })

      if (res.ok) {
        const _responseData = await res.json()
        toast.success('Store created successfully')
        resetStore()
        setShowStoreForm(false)
        // Optionally refresh the warehouse data or call a callback
      } else {
        const errorData = await res.json()
        toast.error(errorData.message || 'Failed to create store')
      }
    } catch (error) {
      console.error('Error creating store:', error)
      toast.error('Failed to create store')
    } finally {
      setCreatingStore(false)
    }
  }

  const onSubmit = async (data: WarehouseFormData) => {
    try {
      const url =
        mode === 'edit' && initialData?.id ? `/api/warehouses/${initialData.id}` : '/api/warehouses'
      const method = mode === 'edit' && initialData?.id ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        const responseData = await res.json()
        const warehouse = responseData.warehouse || responseData
        toast.success(
          mode === 'edit' ? 'Warehouse updated successfully' : 'Warehouse created successfully',
        )

        // Update current warehouse ID so store creation becomes available
        if (warehouse.id) {
          setCurrentWarehouseId(warehouse.id)
        }

        // Keep dialog open briefly showing success, then close automatically
        setTimeout(() => {
          onSuccess(warehouse)
          reset()
        }, 1500)
      } else {
        // Handle API error responses
        try {
          const errorData = await res.json()
          const errorMessage =
            errorData.message ||
            errorData.error ||
            `Failed to ${mode === 'edit' ? 'update' : 'create'} warehouse`
          toast.error(errorMessage)
        } catch (_jsonError) {
          // If response is not JSON, show generic error
          toast.error(
            `Failed to ${mode === 'edit' ? 'update' : 'create'} warehouse. Please try again.`,
          )
        }
      }
    } catch (error) {
      console.error('Error saving warehouse:', error)
      // Handle network errors and other exceptions
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error('Network error. Please check your connection and try again.')
      } else {
        toast.error(
          `An error occurred while ${mode === 'edit' ? 'updating' : 'creating'} the warehouse. Please try again.`,
        )
      }
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

      {/* Quick Create Store Section - Show in edit mode or after warehouse is created */}
      {(mode === 'edit' || currentWarehouseId) && (
        <div className="border-t pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <Label>Stores</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowStoreForm(!showStoreForm)}
              className="min-h-[36px]"
            >
              <Plus className="h-4 w-4 mr-2" />
              {showStoreForm ? 'Hide' : 'Quick Create Store'}
            </Button>
          </div>

          {showStoreForm && (
            <div className="p-4 bg-muted rounded-lg space-y-4">
              <form onSubmit={handleSubmitStore(onCreateStore)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormInput
                    label="Store Name"
                    required
                    error={storeErrors.storeName?.message}
                    placeholder="Store name"
                    {...registerStore('storeName')}
                  />
                  <FormSelect
                    label="Zone Type"
                    required
                    error={storeErrors.zoneType?.message}
                    placeholder="Select zone type"
                    options={[
                      { value: 'Indock', label: 'Indock' },
                      { value: 'Outdock', label: 'Outdock' },
                      { value: 'Storage', label: 'Storage' },
                    ]}
                    {...registerStore('zoneType')}
                  />
                  <div className="flex items-center space-x-2 pt-6">
                    <input
                      type="checkbox"
                      id="countable"
                      {...registerStore('countable')}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <label
                      htmlFor="countable"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Countable
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowStoreForm(false)
                      resetStore()
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={creatingStore}>
                    {creatingStore ? 'Creating...' : 'Create Store'}
                  </Button>
                </div>
              </form>
            </div>
          )}
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
              ? 'Update Warehouse'
              : 'Create Warehouse'}
        </Button>
      </div>
    </form>
  )
}
