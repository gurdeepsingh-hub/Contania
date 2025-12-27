'use client'

import { ProductLineForm } from '@/components/freight/product-line-form'

type ProductLine = {
  id?: number
  skuId?: number
  skuDescription?: string
  batchNumber?: string
  lpnQty?: string
  sqmPerSU?: number
  expectedQty?: number
  recievedQty?: number
  expectedWeight?: number
  recievedWeight?: number
  palletSpaces?: number
  weightPerHU?: number
  expectedCubicPerHU?: number
  recievedCubicPerHU?: number
  expiryDate?: string
  attribute1?: string
  attribute2?: string
}

interface ContainerProductLineFormImportProps {
  containerDetailId: number
  containerBookingId: number
  initialData?: ProductLine
  onSave: (productLine: ProductLine & { containerDetailId: number; containerBookingId: number; stage: string }) => Promise<void>
  onCancel: () => void
  stage?: 'expected' | 'received' | 'put_away'
}

export function ContainerProductLineFormImport({
  containerDetailId,
  containerBookingId,
  initialData,
  onSave,
  onCancel,
  stage = 'expected',
}: ContainerProductLineFormImportProps) {
  const handleSave = async (productLine: ProductLine) => {
    // Add container-specific fields
    const containerProductLine = {
      ...productLine,
      containerDetailId,
      containerBookingId,
      stage,
    }
    await onSave(containerProductLine)
  }

  // Use containerDetailId as inboundInventoryId for form compatibility
  // The form will save to container stock allocations via API
  return (
    <ProductLineForm
      inboundInventoryId={containerDetailId}
      initialData={initialData}
      onSave={handleSave}
      onCancel={onCancel}
    />
  )
}

