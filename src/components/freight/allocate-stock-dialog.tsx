'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StockAllocation } from './stock-allocation'

interface AllocateStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: number
}

export function AllocateStockDialog({ open, onOpenChange, jobId }: AllocateStockDialogProps) {
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
            Allocate available stock (LPNs) to product lines for this outbound job. Stock will be
            allocated from batches that match the product line requirements.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {jobId ? (
            <StockAllocation
              outboundInventoryId={jobId}
              onAllocationComplete={handleAllocationComplete}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Job ID not found.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}






