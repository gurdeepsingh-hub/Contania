'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FormInput, FormSelect } from '@/components/ui/form-field'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { X, Save } from 'lucide-react'
import { toast } from 'sonner'
import { valueAsNumberOrUndefined } from '@/lib/utils'

const vehicleSchema = z.object({
  fleetNumber: z.string().min(1, 'Fleet number is required'),
  rego: z.string().min(1, 'Registration is required'),
  regoExpiryDate: z.string().optional(),
  gpsId: z.string().optional(),
  description: z.string().optional(),
  defaultDepotId: z.number().optional(),
  aTrailerId: z.number().optional(),
  bTrailerId: z.number().optional(),
  cTrailerId: z.number().optional(),
  defaultTrailerCombinationId: z.number().optional(),
  sideloader: z.boolean().optional(),
})

type VehicleFormData = z.infer<typeof vehicleSchema>

type Vehicle = {
  id?: number
  fleetNumber?: string
  rego?: string
  regoExpiryDate?: string
  gpsId?: string
  description?: string
  defaultDepotId?: number | { id: number; name?: string }
  aTrailerId?: number | { id: number; name?: string }
  bTrailerId?: number | { id: number; name?: string }
  cTrailerId?: number | { id: number; name?: string }
  defaultTrailerCombinationId?: number | { id: number; name?: string }
  sideloader?: boolean
}

type TrailerType = {
  id: number
  name: string
  trailerA: boolean
  trailerB: boolean
  trailerC: boolean
}

type Warehouse = {
  id: number
  name: string
}

interface VehicleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: Vehicle | null
  mode?: 'create' | 'edit'
  onSuccess?: (vehicle: Vehicle) => void
}

export function VehicleFormDialog({
  open,
  onOpenChange,
  initialData,
  mode = 'create',
  onSuccess,
}: VehicleFormDialogProps) {
  const [trailerTypes, setTrailerTypes] = useState<TrailerType[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      fleetNumber: '',
      rego: '',
      regoExpiryDate: '',
      gpsId: '',
      description: '',
      defaultDepotId: undefined,
      aTrailerId: undefined,
      bTrailerId: undefined,
      cTrailerId: undefined,
      defaultTrailerCombinationId: undefined,
      sideloader: false,
    },
  })

  const watchedSideloader = watch('sideloader')

  useEffect(() => {
    if (open) {
      loadTrailerTypes()
      loadWarehouses()
      if (initialData) {
        const depotId =
          initialData.defaultDepotId && typeof initialData.defaultDepotId === 'object'
            ? initialData.defaultDepotId.id
            : initialData.defaultDepotId
        const aTrailerId =
          initialData.aTrailerId && typeof initialData.aTrailerId === 'object'
            ? initialData.aTrailerId.id
            : initialData.aTrailerId
        const bTrailerId =
          initialData.bTrailerId && typeof initialData.bTrailerId === 'object'
            ? initialData.bTrailerId.id
            : initialData.bTrailerId
        const cTrailerId =
          initialData.cTrailerId && typeof initialData.cTrailerId === 'object'
            ? initialData.cTrailerId.id
            : initialData.cTrailerId
        const defaultTrailerCombinationId =
          initialData.defaultTrailerCombinationId && typeof initialData.defaultTrailerCombinationId === 'object'
            ? initialData.defaultTrailerCombinationId.id
            : initialData.defaultTrailerCombinationId

        reset({
          fleetNumber: initialData.fleetNumber || '',
          rego: initialData.rego || '',
          regoExpiryDate: initialData.regoExpiryDate || '',
          gpsId: initialData.gpsId || '',
          description: initialData.description || '',
          defaultDepotId: depotId ? depotId : undefined,
          aTrailerId: aTrailerId ? aTrailerId : undefined,
          bTrailerId: bTrailerId ? bTrailerId : undefined,
          cTrailerId: cTrailerId ? cTrailerId : undefined,
          defaultTrailerCombinationId: defaultTrailerCombinationId ? defaultTrailerCombinationId : undefined,
          sideloader: initialData.sideloader || false,
        })
      } else {
        reset({
          fleetNumber: '',
          rego: '',
          regoExpiryDate: '',
          gpsId: '',
          description: '',
          defaultDepotId: undefined,
          aTrailerId: undefined,
          bTrailerId: undefined,
          cTrailerId: undefined,
          defaultTrailerCombinationId: undefined,
          sideloader: false,
        })
      }
    }
  }, [open, initialData, reset])

  const loadTrailerTypes = async () => {
    try {
      const res = await fetch('/api/trailer-types?limit=1000', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.trailerTypes) {
          setTrailerTypes(data.trailerTypes)
        } else {
          console.error('Error loading trailer types: Invalid response structure', data)
        }
      } else {
        const errorData = await res.json().catch(() => ({ message: 'Unknown error' }))
        console.error('Error loading trailer types:', res.status, errorData)
        toast.error(`Failed to load trailer types: ${errorData.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error loading trailer types:', error)
      toast.error('Failed to load trailer types. Please refresh the page.')
    }
  }

  const loadWarehouses = async () => {
    try {
      const res = await fetch('/api/warehouses?limit=1000', {
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.warehouses) {
          setWarehouses(data.warehouses)
        } else {
          console.error('Error loading warehouses: Invalid response structure', data)
        }
      } else {
        const errorData = await res.json().catch(() => ({ message: 'Unknown error' }))
        console.error('Error loading warehouses:', res.status, errorData)
      }
    } catch (error) {
      console.error('Error loading warehouses:', error)
    }
  }

  const onSubmit = async (data: VehicleFormData) => {
    setLoading(true)
    try {
      if (mode === 'edit' && initialData?.id) {
        const res = await fetch(`/api/vehicles/${initialData.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (res.ok) {
          const responseData = await res.json()
          toast.success('Vehicle updated successfully')
          // Keep dialog open briefly showing success, then close automatically
          setTimeout(() => {
            onSuccess?.(responseData.vehicle)
            onOpenChange(false)
          }, 1500)
        } else {
          // Handle API error responses
          try {
            const responseData = await res.json()
            const errorMessage =
              responseData.message || responseData.error || 'Failed to update vehicle'
            toast.error(errorMessage)
          } catch (jsonError) {
            toast.error('Failed to update vehicle. Please try again.')
          }
        }
      } else {
        const res = await fetch('/api/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (res.ok) {
          const responseData = await res.json()
          toast.success('Vehicle created successfully')
          // Keep dialog open briefly showing success, then close automatically
          setTimeout(() => {
            onSuccess?.(responseData.vehicle)
            onOpenChange(false)
          }, 1500)
        } else {
          // Handle API error responses
          try {
            const responseData = await res.json()
            const errorMessage =
              responseData.message || responseData.error || 'Failed to create vehicle'
            toast.error(errorMessage)
          } catch (jsonError) {
            toast.error('Failed to create vehicle. Please try again.')
          }
        }
      }
    } catch (error) {
      console.error('Error saving vehicle:', error)
      // Handle network errors and other exceptions
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error('Network error. Please check your connection and try again.')
      } else {
        toast.error('An error occurred while saving the vehicle. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit Vehicle' : 'Add New Vehicle'}</DialogTitle>
          <DialogDescription>
            {mode === 'edit' ? 'Update vehicle information' : 'Create a new vehicle'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Fleet Number"
              required
              error={errors.fleetNumber?.message}
              placeholder="Fleet identification number"
              {...register('fleetNumber')}
            />
            <FormInput
              label="Registration"
              required
              error={errors.rego?.message}
              placeholder="Registration number"
              {...register('rego')}
            />
            <FormInput
              label="Registration Expiry"
              type="date"
              error={errors.regoExpiryDate?.message}
              {...register('regoExpiryDate')}
            />
            <FormInput
              label="GPS ID"
              error={errors.gpsId?.message}
              placeholder="GPS device ID"
              {...register('gpsId')}
            />
            <FormSelect
              label="Default Depot"
              placeholder="Select depot"
              options={[
                { value: '', label: 'None' },
                ...warehouses.map((warehouse) => ({
                  value: warehouse.id.toString(),
                  label: warehouse.name,
                })),
              ]}
              error={errors.defaultDepotId?.message}
              {...register('defaultDepotId', { setValueAs: valueAsNumberOrUndefined })}
            />
            <FormInput
              label="Description"
              error={errors.description?.message}
              placeholder="Vehicle description"
              {...register('description')}
            />
            <FormSelect
              label="A Trailer"
              placeholder="Select trailer type"
              options={[
                { value: '', label: 'None' },
                ...(trailerTypes || [])
                  .filter((trailerType) => trailerType && trailerType.trailerA === true)
                  .map((trailerType) => ({
                    value: trailerType.id.toString(),
                    label: trailerType.name || 'Unnamed',
                  })),
              ]}
              error={errors.aTrailerId?.message}
              {...register('aTrailerId', { setValueAs: valueAsNumberOrUndefined })}
            />
            <FormSelect
              label="B Trailer"
              placeholder="Select trailer type"
              options={[
                { value: '', label: 'None' },
                ...(trailerTypes || [])
                  .filter((trailerType) => trailerType && trailerType.trailerB === true)
                  .map((trailerType) => ({
                    value: trailerType.id.toString(),
                    label: trailerType.name || 'Unnamed',
                  })),
              ]}
              error={errors.bTrailerId?.message}
              {...register('bTrailerId', { setValueAs: valueAsNumberOrUndefined })}
            />
            <FormSelect
              label="C Trailer"
              placeholder="Select trailer type"
              options={[
                { value: '', label: 'None' },
                ...(trailerTypes || [])
                  .filter((trailerType) => trailerType && trailerType.trailerC === true)
                  .map((trailerType) => ({
                    value: trailerType.id.toString(),
                    label: trailerType.name || 'Unnamed',
                  })),
              ]}
              error={errors.cTrailerId?.message}
              {...register('cTrailerId', { setValueAs: valueAsNumberOrUndefined })}
            />
            <FormSelect
              label="Default Trailer Combination"
              placeholder="Select trailer type"
              options={[
                { value: '', label: 'None' },
                ...(trailerTypes || []).map((trailerType) => ({
                  value: trailerType.id.toString(),
                  label: trailerType.name || 'Unnamed',
                })),
              ]}
              error={errors.defaultTrailerCombinationId?.message}
              {...register('defaultTrailerCombinationId', { setValueAs: valueAsNumberOrUndefined })}
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sideloader"
                checked={watchedSideloader}
                onCheckedChange={(checked) => setValue('sideloader', checked === true)}
              />
              <Label htmlFor="sideloader" className="cursor-pointer">
                Is this a sideloader?
              </Label>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
              disabled={loading || isSubmitting}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={loading || isSubmitting}>
              <Save className="h-4 w-4 mr-2" />
              {loading || isSubmitting
                ? 'Saving...'
                : mode === 'edit'
                  ? 'Update Vehicle'
                  : 'Create Vehicle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
