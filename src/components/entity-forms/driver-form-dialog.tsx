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
import { X, Save } from 'lucide-react'
import { toast } from 'sonner'

const driverSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  vehicleId: z.number().optional(),
  defaultDepotId: z.number().optional(),
  abn: z.string().optional(),
  addressStreet: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  employeeType: z.enum(['Casual', 'Permanent']).refine((val) => val !== undefined, {
    message: 'Employee type is required',
  }),
  drivingLicenceNumber: z.string().min(1, 'Driving licence number is required'),
  licenceExpiry: z.string().optional(),
  licencePhotoUrl: z.number().optional(),
  dangerousGoodsCertNumber: z.string().optional(),
  dangerousGoodsCertExpiry: z.string().optional(),
  msicNumber: z.string().optional(),
  msicExpiry: z.string().optional(),
  msicPhotoUrl: z.number().optional(),
})

type DriverFormData = z.infer<typeof driverSchema>

type Driver = {
  id?: number
  name?: string
  phoneNumber?: string
  vehicleId?: number | { id: number; fleetNumber?: string }
  defaultDepotId?: number | { id: number; name?: string }
  abn?: string
  addressStreet?: string
  city?: string
  state?: string
  postcode?: string
  employeeType?: string
  drivingLicenceNumber?: string
  licenceExpiry?: string
  licencePhotoUrl?: number | { id: number; url?: string }
  dangerousGoodsCertNumber?: string
  dangerousGoodsCertExpiry?: string
  msicNumber?: string
  msicExpiry?: string
  msicPhotoUrl?: number | { id: number; url?: string }
}

type Vehicle = {
  id: number
  fleetNumber: string
}

type Warehouse = {
  id: number
  name: string
}

interface DriverFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: Driver | null
  mode?: 'create' | 'edit'
  onSuccess?: (driver: Driver) => void
}

export function DriverFormDialog({
  open,
  onOpenChange,
  initialData,
  mode = 'create',
  onSuccess,
}: DriverFormDialogProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<DriverFormData>({
    resolver: zodResolver(driverSchema),
    defaultValues: {
      name: '',
      phoneNumber: '',
      vehicleId: undefined,
      defaultDepotId: undefined,
      abn: '',
      addressStreet: '',
      city: '',
      state: '',
      postcode: '',
      employeeType: 'Casual',
      drivingLicenceNumber: '',
      licenceExpiry: '',
      licencePhotoUrl: undefined,
      dangerousGoodsCertNumber: '',
      dangerousGoodsCertExpiry: '',
      msicNumber: '',
      msicExpiry: '',
      msicPhotoUrl: undefined,
    },
  })

  useEffect(() => {
    if (open) {
      loadVehicles()
      loadWarehouses()
      if (initialData) {
        const vehicleId =
          typeof initialData.vehicleId === 'object'
            ? initialData.vehicleId.id
            : initialData.vehicleId
        const depotId =
          typeof initialData.defaultDepotId === 'object'
            ? initialData.defaultDepotId.id
            : initialData.defaultDepotId
        const licencePhotoId =
          typeof initialData.licencePhotoUrl === 'object'
            ? initialData.licencePhotoUrl.id
            : initialData.licencePhotoUrl
        const msicPhotoId =
          typeof initialData.msicPhotoUrl === 'object'
            ? initialData.msicPhotoUrl.id
            : initialData.msicPhotoUrl

        reset({
          name: initialData.name || '',
          phoneNumber: initialData.phoneNumber || '',
          vehicleId: vehicleId || undefined,
          defaultDepotId: depotId || undefined,
          abn: initialData.abn || '',
          addressStreet: initialData.addressStreet || '',
          city: initialData.city || '',
          state: initialData.state || '',
          postcode: initialData.postcode || '',
          employeeType: (initialData.employeeType as 'Casual' | 'Permanent') || 'Casual',
          drivingLicenceNumber: initialData.drivingLicenceNumber || '',
          licenceExpiry: initialData.licenceExpiry || '',
          licencePhotoUrl: licencePhotoId || undefined,
          dangerousGoodsCertNumber: initialData.dangerousGoodsCertNumber || '',
          dangerousGoodsCertExpiry: initialData.dangerousGoodsCertExpiry || '',
          msicNumber: initialData.msicNumber || '',
          msicExpiry: initialData.msicExpiry || '',
          msicPhotoUrl: msicPhotoId || undefined,
        })
      } else {
        reset({
          name: '',
          phoneNumber: '',
          vehicleId: undefined,
          defaultDepotId: undefined,
          abn: '',
          addressStreet: '',
          city: '',
          state: '',
          postcode: '',
          employeeType: 'Casual',
          drivingLicenceNumber: '',
          licenceExpiry: '',
          licencePhotoUrl: undefined,
          dangerousGoodsCertNumber: '',
          dangerousGoodsCertExpiry: '',
          msicNumber: '',
          msicExpiry: '',
          msicPhotoUrl: undefined,
        })
      }
    }
  }, [open, initialData, reset])

  const loadVehicles = async () => {
    try {
      const res = await fetch('/api/vehicles?limit=1000')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.vehicles) {
          setVehicles(data.vehicles)
        }
      }
    } catch (error) {
      console.error('Error loading vehicles:', error)
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

  const onSubmit = async (data: DriverFormData) => {
    setLoading(true)
    try {
      if (mode === 'edit' && initialData?.id) {
        const res = await fetch(`/api/drivers/${initialData.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (res.ok) {
          const responseData = await res.json()
          toast.success('Driver updated successfully')
          // Keep dialog open briefly showing success, then close automatically
          setTimeout(() => {
            onSuccess?.(responseData.driver)
            onOpenChange(false)
          }, 1500)
        } else {
          // Handle API error responses
          try {
            const responseData = await res.json()
            const errorMessage = responseData.message || responseData.error || 'Failed to update driver'
            toast.error(errorMessage)
          } catch (jsonError) {
            toast.error('Failed to update driver. Please try again.')
          }
        }
      } else {
        const res = await fetch('/api/drivers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (res.ok) {
          const responseData = await res.json()
          toast.success('Driver created successfully')
          // Keep dialog open briefly showing success, then close automatically
          setTimeout(() => {
            onSuccess?.(responseData.driver)
            onOpenChange(false)
          }, 1500)
        } else {
          // Handle API error responses
          try {
            const responseData = await res.json()
            const errorMessage = responseData.message || responseData.error || 'Failed to create driver'
            toast.error(errorMessage)
          } catch (jsonError) {
            toast.error('Failed to create driver. Please try again.')
          }
        }
      }
    } catch (error) {
      console.error('Error saving driver:', error)
      // Handle network errors and other exceptions
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error('Network error. Please check your connection and try again.')
      } else {
        toast.error('An error occurred while saving the driver. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit Driver' : 'Add New Driver'}</DialogTitle>
          <DialogDescription>
            {mode === 'edit' ? 'Update driver information' : 'Create a new driver'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 md:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              label="Name"
              required
              error={errors.name?.message}
              placeholder="Full name"
              {...register('name')}
            />
            <FormInput
              label="Phone Number"
              required
              error={errors.phoneNumber?.message}
              placeholder="Contact number"
              {...register('phoneNumber')}
            />
            <FormSelect
              label="Employee Type"
              required
              placeholder="Select type"
              options={[
                { value: 'Casual', label: 'Casual' },
                { value: 'Permanent', label: 'Permanent' },
              ]}
              error={errors.employeeType?.message}
              {...register('employeeType')}
            />
            <FormInput
              label="Driving Licence Number"
              required
              error={errors.drivingLicenceNumber?.message}
              placeholder="Licence number"
              {...register('drivingLicenceNumber')}
            />
            <FormInput
              label="Licence Expiry"
              type="date"
              error={errors.licenceExpiry?.message}
              {...register('licenceExpiry')}
            />
            <FormSelect
              label="Assigned Vehicle"
              placeholder="Select vehicle"
              options={[
                { value: '', label: 'None' },
                ...vehicles.map((vehicle) => ({
                  value: vehicle.id.toString(),
                  label: vehicle.fleetNumber,
                })),
              ]}
              error={errors.vehicleId?.message}
              {...register('vehicleId', { valueAsNumber: true })}
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
              label="ABN"
              error={errors.abn?.message}
              placeholder="Australian Business Number"
              {...register('abn')}
            />
            <FormInput
              label="Street Address"
              error={errors.addressStreet?.message}
              placeholder="Street address"
              {...register('addressStreet')}
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
              placeholder="Postcode"
              {...register('postcode')}
            />
            <FormInput
              label="Dangerous Goods Cert Number"
              error={errors.dangerousGoodsCertNumber?.message}
              placeholder="Certificate number"
              {...register('dangerousGoodsCertNumber')}
            />
            <FormInput
              label="DG Cert Expiry"
              type="date"
              error={errors.dangerousGoodsCertExpiry?.message}
              {...register('dangerousGoodsCertExpiry')}
            />
            <FormInput
              label="MSIC Number"
              error={errors.msicNumber?.message}
              placeholder="MSIC number"
              {...register('msicNumber')}
            />
            <FormInput
              label="MSIC Expiry"
              type="date"
              error={errors.msicExpiry?.message}
              {...register('msicExpiry')}
            />
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
                  ? 'Update Driver'
                  : 'Create Driver'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
