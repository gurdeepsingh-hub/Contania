'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ContainerProductLineFormExport } from '@/components/container-bookings/container-product-line-form-export'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

type ContainerDetail = {
  id: number
  containerNumber: string
}

type StockAllocation = {
  id?: number
  containerDetailId: number
  containerBookingId: number
  stage: 'allocated' | 'picked' | 'dispatched'
  productLines?: any[]
}

interface Step6StockAllocationExportProps {
  bookingId: number
  formData: {
    containerDetails?: ContainerDetail[]
    stockAllocations?: StockAllocation[]
  }
  warehouseId?: number
  onUpdate: (data: Partial<Step6StockAllocationExportProps['formData']>) => void
  errors?: Record<string, string>
}

export function Step6StockAllocationExport({
  bookingId,
  formData,
  warehouseId,
  onUpdate,
  errors,
}: Step6StockAllocationExportProps) {
  const [allocations, setAllocations] = useState<StockAllocation[]>(
    formData.stockAllocations || [],
  )
  const [showProductLineModal, setShowProductLineModal] = useState(false)
  const [selectedContainerId, setSelectedContainerId] = useState<number | null>(null)
  const [selectedStage, setSelectedStage] = useState<'allocated' | 'picked' | 'dispatched'>('allocated')

  const containers = formData.containerDetails || []

  const addProductLine = (containerId: number, stage: 'allocated' | 'picked' | 'dispatched') => {
    setSelectedContainerId(containerId)
    setSelectedStage(stage)
    setShowProductLineModal(true)
  }

  const handleProductLineSave = async (productLine: any) => {
    if (!selectedContainerId) return

    try {
      const res = await fetch(`/api/export-container-bookings/${bookingId}/stock-allocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          containerDetailId: selectedContainerId,
          containerBookingId: bookingId,
          stage: selectedStage,
          productLines: [productLine],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          toast.success('Stock allocation saved')
          setShowProductLineModal(false)
          setSelectedContainerId(null)
          // Reload allocations
          loadAllocations()
        }
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to save stock allocation')
      }
    } catch (error) {
      console.error('Error saving stock allocation:', error)
      toast.error('Failed to save stock allocation')
    }
  }

  const loadAllocations = async () => {
    try {
      const res = await fetch(`/api/export-container-bookings/${bookingId}/stock-allocations`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.stockAllocations) {
          setAllocations(data.stockAllocations)
          onUpdate({ stockAllocations: data.stockAllocations })
        }
      }
    } catch (error) {
      console.error('Error loading allocations:', error)
    }
  }

  useEffect(() => {
    if (bookingId) {
      loadAllocations()
    }
  }, [bookingId])

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Stock Allocation</h3>

      {containers.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No containers defined. Please complete Step 5 first.</p>
        </div>
      )}

      <div className="space-y-4">
        {containers.map((container) => {
          const containerAllocations = allocations.filter(
            (a) => a.containerDetailId === container.id,
          )

          return (
            <Card key={container.id}>
              <CardHeader>
                <CardTitle>Container: {container.containerNumber}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(['allocated', 'picked', 'dispatched'] as const).map((stage) => {
                  const stageAllocations = containerAllocations.filter((a) => a.stage === stage)
                  return (
                    <div key={stage} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium capitalize">{stage}</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addProductLine(container.id, stage)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Product Line
                        </Button>
                      </div>
                      {stageAllocations.length > 0 && (
                        <div className="text-sm text-muted-foreground">
                          {stageAllocations.length} product line(s) allocated
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={showProductLineModal} onOpenChange={setShowProductLineModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Product Line - Stage: {selectedStage}</DialogTitle>
          </DialogHeader>
          {selectedContainerId && (
            <ContainerProductLineFormExport
              containerDetailId={selectedContainerId}
              containerBookingId={bookingId}
              warehouseId={warehouseId}
              stage={selectedStage}
              onSave={handleProductLineSave}
              onCancel={() => {
                setShowProductLineModal(false)
                setSelectedContainerId(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

