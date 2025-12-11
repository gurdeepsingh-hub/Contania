'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StockAllocation } from './stock-allocation'

interface ProductLineAllocateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: number
  productLineId: number
}

export function ProductLineAllocateDialog({
  open,
  onOpenChange,
  jobId,
  productLineId,
}: ProductLineAllocateDialogProps) {
  const handleAllocationComplete = () => {
    onOpenChange(false)
    // Optionally reload the page or refresh data
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Allocate Stock</DialogTitle>
          <DialogDescription>
            Allocate available stock (LPNs) to this product line. Stock will be allocated from
            batches that match the product line requirements.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {jobId && productLineId ? (
            <StockAllocation
              outboundInventoryId={jobId}
              productLineId={productLineId}
              onAllocationComplete={handleAllocationComplete}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Job ID or Product Line ID not found.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}





