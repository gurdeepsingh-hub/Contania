'use client'

import { OutboundProductLineForm } from '@/components/freight/outbound-product-line-form'

type OutboundProductLine = {
  id?: number
  skuId?: number
  skuDescription?: string
  batchNumber?: string
  requiredQty?: number
  allocatedQty?: number
  requiredWeight?: number
  allocatedWeight?: number
  requiredCubicPerHU?: number
  containerNumber?: string
  location?: string
  expiry?: string
  attribute1?: string
  attribute2?: string
}

interface ContainerProductLineFormExportProps {
  containerDetailId: number
  containerBookingId: number
  warehouseId?: number
  initialData?: OutboundProductLine
  onSave: (productLine: OutboundProductLine & { containerDetailId: number; containerBookingId: number; stage: string }) => Promise<void>
  onCancel: () => void
  stage?: 'allocated' | 'picked' | 'dispatched'
}

export function ContainerProductLineFormExport({
  containerDetailId,
  containerBookingId,
  warehouseId,
  initialData,
  onSave,
  onCancel,
  stage = 'allocated',
}: ContainerProductLineFormExportProps) {
  const handleSave = async (productLine: OutboundProductLine) => {
    // Add container-specific fields
    const containerProductLine = {
      ...productLine,
      containerDetailId,
      containerBookingId,
      stage,
    }
    await onSave(containerProductLine)
  }

  // Use containerDetailId as outboundInventoryId for form compatibility
  // The form will save to container stock allocations via API
  return (
    <OutboundProductLineForm
      outboundInventoryId={containerDetailId}
      warehouseId={warehouseId}
      initialData={initialData}
      onSave={handleSave}
      onCancel={onCancel}
    />
  )
}

