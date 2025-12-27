'use client'

import { DriverAllocationSection } from '../driver-allocation-section'
import { toast } from 'sonner'

type DriverAllocationData = {
  emptyContainer?: {
    date?: string
    time?: string
    vehicleId?: number
    driverId?: number
    legs?: Array<{ from: string | number; to: string | number }>
  }
  fullContainer?: {
    date?: string
    time?: string
    vehicleId?: number
    driverId?: number
    legs?: Array<{ from: string | number; to: string | number }>
  }
}

interface Step7DriverAllocationExportProps {
  bookingId: number
  formData: DriverAllocationData
  routingData?: {
    emptyRouting?: {
      pickupLocationId?: number | string
      viaLocations?: (number | string)[]
      dropoffLocationId?: number | string
    }
    fullRouting?: {
      pickupLocationId?: number | string
      viaLocations?: (number | string)[]
      dropoffLocationId?: number | string
    }
  }
  step3Data?: {
    fromId?: number | string
    toId?: number | string
  }
  onUpdate: (data: Partial<DriverAllocationData>) => void
  errors?: Record<string, string>
}

export function Step7DriverAllocationExport({
  bookingId,
  formData,
  routingData,
  step3Data,
  onUpdate,
  errors,
}: Step7DriverAllocationExportProps) {
  const handleSave = async () => {
    try {
      const res = await fetch(`/api/export-container-bookings/${bookingId}/driver-allocation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          toast.success('Driver allocation saved')
        }
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to save driver allocation')
      }
    } catch (error) {
      console.error('Error saving driver allocation:', error)
      toast.error('Failed to save driver allocation')
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground mb-4">
        <p>Export driver allocation order: Empty Container → Full Container</p>
        <p className="mt-1">
          Empty containers are picked up first, then filled and delivered.
        </p>
      </div>
      <DriverAllocationSection
        order="empty-first"
        formData={formData}
        routingData={routingData}
        step3Data={step3Data}
        onUpdate={onUpdate}
        errors={errors}
      />
      <div className="flex justify-end pt-4 border-t">
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
        >
          Save Driver Allocation
        </button>
      </div>
    </div>
  )
}

