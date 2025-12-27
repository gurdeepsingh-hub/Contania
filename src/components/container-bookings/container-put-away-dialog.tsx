'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ContainerPutAwayForm } from './container-put-away-form'
import { toast } from 'sonner'

type ProductLine = {
  id?: number
  skuId?: number | { id: number; skuCode?: string; description?: string }
  skuDescription?: string
  batchNumber?: string
  lpnQty?: string
  recievedQty?: number
  palletSpaces?: number
  expectedQty?: number
}

type ContainerDetail = {
  id: number
  containerNumber?: string
  warehouseId?: number | { id: number }
}

type StockAllocation = {
  id: number
  productLines?: ProductLine[]
}

interface ContainerPutAwayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: number
  containerId: number
  allocationId?: number // Optional: filter to specific allocation
  onComplete?: () => void
}

export function ContainerPutAwayDialog({
  open,
  onOpenChange,
  bookingId,
  containerId,
  allocationId,
  onComplete,
}: ContainerPutAwayDialogProps) {
  const [container, setContainer] = useState<ContainerDetail | null>(null)
  const [allocations, setAllocations] = useState<StockAllocation[]>([])
  const [loading, setLoading] = useState(false)
  const [existingPutAwayRecords, setExistingPutAwayRecords] = useState<any[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    if (open && containerId) {
      // Reset state when dialog opens
      setContainer(null)
      setAllocations([])
      setExistingPutAwayRecords([])
      setDataLoaded(false)
      loadContainerData()
      loadExistingPutAwayRecords()
    } else if (!open) {
      // Reset when dialog closes
      setDataLoaded(false)
    }
  }, [open, containerId])

  const loadContainerData = async () => {
    if (!containerId) return

    setLoading(true)
    try {
      const [containerRes, allocationsRes] = await Promise.all([
        fetch(`/api/container-details/${containerId}?depth=2`),
        fetch(
          `/api/import-container-bookings/${bookingId}/stock-allocations?containerDetailId=${containerId}&depth=2`,
        ),
      ])

      if (containerRes.ok) {
        const data = await containerRes.json()
        if (data.success && data.containerDetail) {
          setContainer(data.containerDetail)
        } else {
          toast.error('Failed to load container data')
        }
      } else {
        toast.error('Failed to load container data')
      }

      if (allocationsRes.ok) {
        const data = await allocationsRes.json()
        if (data.success) {
          setAllocations(data.stockAllocations || data.containerStockAllocations || [])
        }
      }
    } catch (error) {
      console.error('Error loading container data:', error)
      toast.error('Failed to load container data')
    } finally {
      setLoading(false)
      setDataLoaded(true)
    }
  }

  const loadExistingPutAwayRecords = async () => {
    if (!containerId) return

    try {
      const res = await fetch(
        `/api/import-container-bookings/${bookingId}/containers/${containerId}/put-away`,
      )
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setExistingPutAwayRecords(data.records || [])
        }
      }
    } catch (error) {
      console.error('Error loading existing put-away records:', error)
    }
  }

  const handleComplete = () => {
    onOpenChange(false)
    if (onComplete) {
      onComplete()
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  const getWarehouseId = (): number | null => {
    if (!container?.warehouseId) return null
    if (typeof container.warehouseId === 'object' && container.warehouseId.id) {
      return container.warehouseId.id
    }
    return container.warehouseId as number
  }

  // Check if there are product lines with received quantities
  // Only check after data is loaded to avoid showing messages prematurely
  const hasProductLinesWithReceivedQty =
    dataLoaded &&
    allocations.some((allocation) => {
      // Filter allocations to only this container
      const allocationContainerId =
        typeof allocation.containerDetailId === 'object'
          ? (allocation.containerDetailId as any).id
          : allocation.containerDetailId

      if (allocationContainerId !== containerId) {
        return false
      }

      return (allocation.productLines || []).some(
        (line: ProductLine) => line.recievedQty && line.recievedQty > 0,
      )
    })

  const warehouseId = getWarehouseId()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Put Away Stock</DialogTitle>
          <DialogDescription>
            Assign storage locations for received stock pallets. Each pallet will receive a unique
            LPN number.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {loading || !dataLoaded ? (
            <div className="text-center py-8">Loading container data...</div>
          ) : !container ? (
            <div className="text-center py-8 text-muted-foreground">
              Container not found or failed to load.
            </div>
          ) : !warehouseId ? (
            <div className="text-center py-8 text-muted-foreground">
              Warehouse not found for this container. Please set a warehouse for the container.
            </div>
          ) : !hasProductLinesWithReceivedQty ? (
            <div className="text-center py-8 text-muted-foreground">
              No product lines with received quantities found for this container.
            </div>
          ) : (
            <ContainerPutAwayForm
              bookingId={bookingId}
              containerId={containerId}
              warehouseId={warehouseId}
              allocationId={allocationId}
              onComplete={handleComplete}
              onCancel={handleCancel}
              existingPutAwayRecords={existingPutAwayRecords}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
