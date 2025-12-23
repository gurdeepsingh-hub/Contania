'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { FormInput, FormSelect } from '@/components/ui/form-field'
import { X, Save } from 'lucide-react'
import { toast } from 'sonner'

const storeSchema = z.object({
  warehouseId: z.string().min(1, 'Warehouse is required'),
  storeName: z.string().min(1, 'Store name is required'),
  countable: z.boolean(),
  zoneType: z.enum(['Indock', 'Outdock', 'Storage']),
})

type StoreFormData = z.infer<typeof storeSchema>

type Store = {
  id?: number
  warehouseId?: number | string | { id: number; name?: string }
  storeName?: string
  countable?: boolean
  zoneType?: 'Indock' | 'Outdock' | 'Storage'
}

type Warehouse = {
  id: number
  name: string
}

interface StoreFormProps {
  initialData?: Store | null
  onSuccess: (store: Store) => void
  onCancel: () => void
  mode?: 'create' | 'edit'
}

export function StoreForm({ initialData, onSuccess, onCancel, mode = 'create' }: StoreFormProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loadingWarehouses, setLoadingWarehouses] = useState(true)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<StoreFormData>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      warehouseId: initialData?.warehouseId
        ? typeof initialData.warehouseId === 'object'
          ? String(initialData.warehouseId.id)
          : String(initialData.warehouseId)
        : '',
      storeName: initialData?.storeName || '',
      countable: initialData?.countable || false,
      zoneType: initialData?.zoneType || undefined,
    },
  })

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        setLoadingWarehouses(true)
        const res = await fetch('/api/warehouses?limit=1000')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.warehouses) {
            setWarehouses(data.warehouses)
          }
        }
      } catch (error) {
        console.error('Error fetching warehouses:', error)
      } finally {
        setLoadingWarehouses(false)
      }
    }

    fetchWarehouses()
  }, [])

  const onSubmit = async (data: StoreFormData) => {
    try {
      const url =
        mode === 'edit' && initialData?.id ? `/api/stores/${initialData.id}` : '/api/stores'
      const method = mode === 'edit' && initialData?.id ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          warehouseId: Number(data.warehouseId),
        }),
      })

      if (res.ok) {
        const responseData = await res.json()
        const store = responseData.store || responseData
        toast.success(mode === 'edit' ? 'Store updated successfully' : 'Store created successfully')
        // Keep dialog open briefly showing success, then close automatically
        setTimeout(() => {
          onSuccess(store)
          reset()
        }, 1500)
      } else {
        // Handle API error responses
        try {
          const errorData = await res.json()
          const errorMessage =
            errorData.message ||
            errorData.error ||
            `Failed to ${mode === 'edit' ? 'update' : 'create'} store`
          toast.error(errorMessage)
        } catch (_jsonError) {
          // If response is not JSON, show generic error
          toast.error(`Failed to ${mode === 'edit' ? 'update' : 'create'} store. Please try again.`)
        }
      }
    } catch (error) {
      console.error('Error saving store:', error)
      // Handle network errors and other exceptions
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error('Network error. Please check your connection and try again.')
      } else {
        toast.error(
          `An error occurred while ${mode === 'edit' ? 'updating' : 'creating'} the store. Please try again.`,
        )
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormSelect
          label="Warehouse"
          required
          error={errors.warehouseId?.message}
          placeholder="Select warehouse"
          options={warehouses.map((w) => ({ value: String(w.id), label: w.name }))}
          disabled={loadingWarehouses}
          {...register('warehouseId')}
        />
        <FormInput
          label="Store Name"
          required
          error={errors.storeName?.message}
          placeholder="Store name"
          {...register('storeName')}
        />
        <FormSelect
          label="Zone Type"
          required
          error={errors.zoneType?.message}
          placeholder="Select zone type"
          options={[
            { value: 'Indock', label: 'Indock' },
            { value: 'Outdock', label: 'Outdock' },
            { value: 'Storage', label: 'Storage' },
          ]}
          {...register('zoneType')}
        />
        <div className="flex items-center space-x-2 pt-6">
          <input
            type="checkbox"
            id="countable"
            {...register('countable')}
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
              ? 'Update Store'
              : 'Create Store'}
        </Button>
      </div>
    </form>
  )
}
