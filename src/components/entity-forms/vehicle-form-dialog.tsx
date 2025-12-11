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
  aTrailerId?: number | { id: number; fleetNumber?: string; rego?: string }
  bTrailerId?: number | { id: number; fleetNumber?: string; rego?: string }
  cTrailerId?: number | { id: number; fleetNumber?: string; rego?: string }
  sideloader?: boolean
}

type Trailer = {
  id: number
  fleetNumber: string
  rego: string
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
  const [trailers, setTrailers] = useState<Trailer[]>([])
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
      sideloader: false,
    },
  })

  const watchedSideloader = watch('sideloader')

  useEffect(() => {
    if (open) {
      loadTrailers()
      loadWarehouses()
      if (initialData) {
        const depotId =
          typeof initialData.defaultDepotId === 'object'
            ? initialData.defaultDepotId.id
            : initialData.defaultDepotId
        const aTrailerId =
          typeof initialData.aTrailerId === 'object' ? initialData.aTrailerId.id : initialData.aTrailerId
        const bTrailerId =
          typeof initialData.bTrailerId === 'object' ? initialData.bTrailerId.id : initialData.bTrailerId
        const cTrailerId =
          typeof initialData.cTrailerId === 'object' ? initialData.cTrailerId.id : initialData.cTrailerId

        reset({
          fleetNumber: initialData.fleetNumber || '',
          rego: initialData.rego || '',
          regoExpiryDate: initialData.regoExpiryDate || '',
          gpsId: initialData.gpsId || '',
          description: initialData.description || '',
          defaultDepotId: depotId || undefined,
          aTrailerId: aTrailerId || undefined,
          bTrailerId: bTrailerId || undefined,
          cTrailerId: cTrailerId || undefined,
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
          sideloader: false,
        })
      }
    }
  }, [open, initialData, reset])

  const loadTrailers = async () => {
    try {
      const res = await fetch('/api/trailers?limit=1000')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.trailers) {
          setTrailers(data.trailers)
        }
      }
    } catch (error) {
      console.error('Error loading trailers:', error)
    }
  }

  const loadWarehouses = async () => {
    try {
      const res = await fetch('/api/warehouses?limit=1000')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.warehouses) {
          setWarehouses(data.warehouses)
        }
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
          onSuccess?.(responseData.vehicle)
          onOpenChange(false)
        } else {
          const responseData = await res.json()
          toast.error(responseData.message || 'Failed to update vehicle')
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
          onSuccess?.(responseData.vehicle)
          onOpenChange(false)
        } else {
          const responseData = await res.json()
          toast.error(responseData.message || 'Failed to create vehicle')
        }
      }
    } catch (error) {
      console.error('Error saving vehicle:', error)
      toast.error('An error occurred while saving the vehicle')
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
              {...register('defaultDepotId', { valueAsNumber: true })}
            />
            <FormInput
              label="Description"
              error={errors.description?.message}
              placeholder="Vehicle description"
              {...register('description')}
            />
            <FormSelect
              label="A Trailer"
              placeholder="Select trailer"
              options={[
                { value: '', label: 'None' },
                ...trailers.map((trailer) => ({
                  value: trailer.id.toString(),
                  label: `${trailer.fleetNumber} (${trailer.rego})`,
                })),
              ]}
              error={errors.aTrailerId?.message}
              {...register('aTrailerId', { valueAsNumber: true })}
            />
            <FormSelect
              label="B Trailer"
              placeholder="Select trailer"
              options={[
                { value: '', label: 'None' },
                ...trailers.map((trailer) => ({
                  value: trailer.id.toString(),
                  label: `${trailer.fleetNumber} (${trailer.rego})`,
                })),
              ]}
              error={errors.bTrailerId?.message}
              {...register('bTrailerId', { valueAsNumber: true })}
            />
            <FormSelect
              label="C Trailer"
              placeholder="Select trailer"
              options={[
                { value: '', label: 'None' },
                ...trailers.map((trailer) => ({
                  value: trailer.id.toString(),
                  label: `${trailer.fleetNumber} (${trailer.rego})`,
                })),
              ]}
              error={errors.cTrailerId?.message}
              {...register('cTrailerId', { valueAsNumber: true })}
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
                Equipped with sideloader
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




