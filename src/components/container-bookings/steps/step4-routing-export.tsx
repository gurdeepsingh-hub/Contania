'use client'

import { RoutingSection } from '../routing-section'

interface Step4RoutingExportProps {
  formData: {
    emptyRouting?: {
      shippingLineId?: number
      pickupLocationId?: number | string
      pickupDate?: string
      viaLocations?: (number | string)[]
      dropoffLocationId?: number | string
      dropoffDate?: string
      requestedDeliveryDate?: string
    }
    fullRouting?: {
      pickupLocationId?: number | string
      pickupDate?: string
      viaLocations?: (number | string)[]
      dropoffLocationId?: number | string
      dropoffDate?: string
    }
    instructions?: string
    jobNotes?: string
    releaseNumber?: string
    weight?: string
  }
  step3Data?: {
    fromId?: number | string
    toId?: number | string
  }
  onUpdate: (data: Partial<Step4RoutingExportProps['formData']>) => void
  errors?: Record<string, string>
}

export function Step4RoutingExport({
  formData,
  step3Data,
  onUpdate,
  errors,
}: Step4RoutingExportProps) {
  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground mb-4">
        <p>Export routing order: Empty Container → Full Container</p>
        <p className="mt-1">
          Empty containers are picked up first, then filled and delivered.
        </p>
      </div>
      <RoutingSection
        order="empty-first"
        formData={formData}
        onUpdate={onUpdate}
        step3Data={step3Data}
        errors={errors}
        isExport={true}
      />
    </div>
  )
}

