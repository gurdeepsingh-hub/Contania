'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PutAwayForm } from './put-away-form'
import { toast } from 'sonner'

type ProductLine = {
  id: number
  skuId?: number | { id: number; skuCode?: string; description?: string }
  skuDescription?: string
  batchNumber?: string
  lpnQty?: string
  recievedQty?: number
  palletSpaces?: number
}

type InboundJob = {
  id: number
  warehouseId?: number | { id: number }
  productLines?: ProductLine[]
}

interface PutAwayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId?: number
  productLineId?: number // Optional: if provided, only show this product line
  onComplete?: () => void // Optional: callback when putaway is successfully completed
}

export function PutAwayDialog({ open, onOpenChange, jobId, productLineId, onComplete }: PutAwayDialogProps) {
  const [job, setJob] = useState<InboundJob | null>(null)
  const [loading, setLoading] = useState(false)
  const [existingPutAwayRecords, setExistingPutAwayRecords] = useState<any[]>([])

  useEffect(() => {
    if (open && jobId) {
      loadJob()
      loadExistingPutAwayRecords()
    }
  }, [open, jobId, productLineId])

  const loadJob = async () => {
    if (!jobId) return

    setLoading(true)
    try {
      const res = await fetch(`/api/inbound-inventory/${jobId}?depth=2`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.job) {
          setJob(data.job)
        } else {
          toast.error('Failed to load job data')
        }
      } else {
        toast.error('Failed to load job data')
      }
    } catch (error) {
      console.error('Error loading job:', error)
      toast.error('Failed to load job data')
    } finally {
      setLoading(false)
    }
  }
  
  const loadExistingPutAwayRecords = async () => {
    if (!jobId) return
    
    try {
      let url = `/api/put-away-stock?jobId=${jobId}`
      if (productLineId) {
        url += `&productLineId=${productLineId}`
      }
      
      const res = await fetch(url)
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
    // If onComplete callback is provided, use it (e.g., for redirecting)
    // Otherwise, reload the page as before
    if (onComplete) {
      onComplete()
    } else if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  const getWarehouseId = (): number | null => {
    if (!job?.warehouseId) return null
    if (typeof job.warehouseId === 'object' && job.warehouseId.id) {
      return job.warehouseId.id
    }
    return job.warehouseId as number
  }

  const warehouseId = getWarehouseId()
  let productLines = job?.productLines || []
  
  // If productLineId is provided, filter to only that product line
  if (productLineId) {
    productLines = productLines.filter((line) => line.id === productLineId)
  }

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
          {loading ? (
            <div className="text-center py-8">Loading job data...</div>
          ) : !job ? (
            <div className="text-center py-8 text-muted-foreground">
              Job not found or failed to load.
            </div>
          ) : !warehouseId ? (
            <div className="text-center py-8 text-muted-foreground">
              Warehouse not found for this job.
            </div>
          ) : productLines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No product lines found for this job.
            </div>
          ) : (
            <PutAwayForm
              jobId={job.id}
              productLines={productLines}
              warehouseId={warehouseId}
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








