'use client'

import { RoutingSection } from '../routing-section'

interface Step4RoutingImportProps {
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
  }
  step3Data?: {
    fromId?: number | string
    toId?: number | string
  }
  onUpdate: (data: Partial<Step4RoutingImportProps['formData']>) => void
  errors?: Record<string, string>
}

export function Step4RoutingImport({
  formData,
  step3Data,
  onUpdate,
  errors,
}: Step4RoutingImportProps) {
  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground mb-4">
        <p>Import routing order: Full Container → Empty Container</p>
        <p className="mt-1">
          Full containers are delivered first, then empty containers are returned.
        </p>
      </div>
      <RoutingSection
        order="full-first"
        formData={formData}
        onUpdate={onUpdate}
        step3Data={step3Data}
        errors={errors}
        isExport={false}
      />
    </div>
  )
}

