'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ReceiveStockForm } from '@/components/freight/receive-stock-form'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Save } from 'lucide-react'

type ProductLine = {
  id?: number
  skuId?: number | { id: number; skuCode?: string; description?: string }
  skuDescription?: string
  batchNumber?: string
  expectedQty?: number
  expectedQtyImport?: number
  recievedQty?: number
  expectedWeight?: number
  expectedWeightImport?: number
  recievedWeight?: number
  expectedCubicPerHU?: number
  recievedCubicPerHU?: number
  expiryDate?: string
  attribute1?: string
  attribute2?: string
}

type StockAllocation = {
  id: number
  containerDetailId?: number | { id: number; containerNumber?: string }
  productLines?: ProductLine[]
}

interface ReceiveStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: number
  allocationId: number
  onComplete?: () => void
}

export function ReceiveStockDialog({
  open,
  onOpenChange,
  bookingId,
  allocationId,
  onComplete,
}: ReceiveStockDialogProps) {
  const [allocation, setAllocation] = useState<StockAllocation | null>(null)
  const [productLines, setProductLines] = useState<ProductLine[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && allocationId) {
      loadAllocation()
    }
  }, [open, allocationId])

  const loadAllocation = async () => {
    if (!allocationId) return

    setLoading(true)
    try {
      const res = await fetch(
        `/api/import-container-bookings/${bookingId}/stock-allocations/${allocationId}?depth=2`,
      )
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.stockAllocation) {
          setAllocation(data.stockAllocation)
          // Map import-specific fields to standard fields for the form
          const mappedProductLines = (data.stockAllocation.productLines || []).map((line: any) => ({
            ...line,
            expectedQty: line.expectedQtyImport ?? line.expectedQty,
            expectedWeight: line.expectedWeightImport ?? line.expectedWeight,
          }))
          setProductLines(mappedProductLines)
        } else {
          toast.error('Failed to load allocation data')
        }
      } else {
        toast.error('Failed to load allocation data')
      }
    } catch (error) {
      console.error('Error loading allocation:', error)
      toast.error('Failed to load allocation data')
    } finally {
      setLoading(false)
    }
  }

  const updateProductLine = (
    index: number,
    field: keyof ProductLine,
    value: string | number | undefined,
  ) => {
    setProductLines((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(
        `/api/import-container-bookings/${bookingId}/stock-allocations/${allocationId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productLines: productLines.map((line) => ({
              ...line,
              recievedQty: line.recievedQty,
              recievedWeight: line.recievedWeight,
              recievedCubicPerHU: line.recievedCubicPerHU,
            })),
          }),
        },
      )

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          toast.success('Received values updated successfully')
          onOpenChange(false)
          if (onComplete) {
            onComplete()
          }
        } else {
          toast.error(data.message || 'Failed to save received values')
        }
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to save received values')
      }
    } catch (error) {
      console.error('Error saving received values:', error)
      toast.error('Failed to save received values')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive Stock</DialogTitle>
          <DialogDescription>
            Enter received quantities, weights, and cubic measurements for each product line.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {loading ? (
            <div className="text-center py-8">Loading allocation data...</div>
          ) : !allocation ? (
            <div className="text-center py-8 text-muted-foreground">
              Allocation not found or failed to load.
            </div>
          ) : productLines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No product lines found for this allocation.
            </div>
          ) : (
            <>
              <ReceiveStockForm
                productLines={productLines.filter((line): line is ProductLine & { id: number } => line.id !== undefined)}
                onProductLineChange={updateProductLine}
              />
              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button variant="outline" onClick={handleCancel} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Received Values'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
